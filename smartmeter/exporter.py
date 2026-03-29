#!/usr/bin/env python3
"""Prometheus exporter for Netz Oberösterreich eService smart meter data.

Scrapes electricity consumption data from the Netz OÖ eService portal
and exposes it as Prometheus metrics.
"""

import logging
import os
import sys
import time
from datetime import date, timedelta
import requests
from prometheus_client import Gauge, start_http_server

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NETZOOE_USERNAME = os.environ.get("NETZOOE_USERNAME", "")
NETZOOE_PASSWORD = os.environ.get("NETZOOE_PASSWORD", "")
METRICS_PORT = int(os.environ.get("METRICS_PORT", "9091"))
SCRAPE_INTERVAL = int(os.environ.get("SCRAPE_INTERVAL", "21600"))  # 6 hours
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
# How many days of daily profile data to fetch (max useful range)
DAILY_PROFILE_DAYS = int(os.environ.get("DAILY_PROFILE_DAYS", "30"))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("smartmeter-exporter")

# ---------------------------------------------------------------------------
# API constants (reverse-engineered from the eService portal)
# ---------------------------------------------------------------------------

BASE_URL = "https://eservice.netzooe.at/service"
LOGIN_URL = f"{BASE_URL}/j_security_check"
DASHBOARD_URL = f"{BASE_URL}/v1.0/dashboard"
CONTRACT_ACCOUNT_URL = f"{BASE_URL}/v1.0/contract-accounts"
CONSUMPTION_PROFILE_URL = f"{BASE_URL}/v1.0/consumptions/profile/active"
CLIENT_ID_HEADER = {"client-id": "netzonline"}
REQUEST_TIMEOUT = 30  # seconds

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------

SMARTMETER_TOTAL_KWH = Gauge(
    "smartmeter_total_kwh",
    "Current meter reading in kWh",
)
SMARTMETER_DAILY_KWH = Gauge(
    "smartmeter_daily_kwh",
    "Daily electricity consumption in kWh",
    ["date"],
)
SMARTMETER_MONTHLY_KWH = Gauge(
    "smartmeter_monthly_kwh",
    "Monthly electricity consumption in kWh (from billing periods)",
    ["month"],
)
SMARTMETER_YEARLY_KWH = Gauge(
    "smartmeter_yearly_kwh",
    "Yearly electricity consumption in kWh (from billing periods)",
    ["year"],
)
SMARTMETER_DAILY_AVG_KWH = Gauge(
    "smartmeter_daily_avg_kwh",
    "Rolling 30-day average daily consumption in kWh",
)
SMARTMETER_MONTHLY_TREND_KWH = Gauge(
    "smartmeter_monthly_trend_kwh",
    "Current month consumption sum from monthly trend in kWh",
)
SMARTMETER_MONTHLY_TREND_PER_DAY = Gauge(
    "smartmeter_monthly_trend_per_day_kwh",
    "Current month per-day consumption from monthly trend in kWh",
)
SMARTMETER_MONTHLY_TREND_PREV_KWH = Gauge(
    "smartmeter_monthly_trend_prev_kwh",
    "Previous month consumption sum from monthly trend in kWh",
)
SMARTMETER_MONTHLY_TREND_CHANGE_PCT = Gauge(
    "smartmeter_monthly_trend_change_pct",
    "Month-over-month consumption change in percent",
)
SMARTMETER_MONTHLY_TREND_CHANGE_PER_DAY = Gauge(
    "smartmeter_monthly_trend_change_per_day_kwh",
    "Month-over-month change in kWh per day",
)
SMARTMETER_YEARLY_TREND_KWH = Gauge(
    "smartmeter_yearly_trend_kwh",
    "Current year consumption sum from yearly trend in kWh",
)
SMARTMETER_YEARLY_TREND_PREV_KWH = Gauge(
    "smartmeter_yearly_trend_prev_kwh",
    "Previous year consumption sum from yearly trend in kWh",
)
SMARTMETER_YEARLY_TREND_CHANGE_PCT = Gauge(
    "smartmeter_yearly_trend_change_pct",
    "Year-over-year consumption change in percent",
)
SMARTMETER_SCRAPE_SUCCESS = Gauge(
    "smartmeter_scrape_success",
    "1 if last scrape succeeded, 0 if failed",
)
SMARTMETER_LAST_SCRAPE_TIMESTAMP = Gauge(
    "smartmeter_last_scrape_timestamp",
    "Unix timestamp of last successful scrape",
)

# ---------------------------------------------------------------------------
# NetzOOE eService API client
# ---------------------------------------------------------------------------


class NetzOOEClient:
    """Synchronous client for the Netz OÖ eService REST API."""

    def __init__(self, username: str, password: str):
        self._username = username
        self._password = password
        self._session: requests.Session | None = None

    def login(self) -> bool:
        """Authenticate with the eService portal. Returns True on success."""
        if self._session is not None:
            self._session.close()
        self._session = requests.Session()
        self._session.headers.update(CLIENT_ID_HEADER)

        try:
            resp = self._session.post(
                LOGIN_URL,
                json={"j_username": self._username, "j_password": self._password},
                timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.error("Login request failed: %s", exc)
            self._session = None
            return False

        if resp.status_code != 200:
            logger.error("Login failed with status %d", resp.status_code)
            self._session = None
            return False

        logger.info("Login successful")
        return True

    def _get(self, url: str) -> dict | list | None:
        """GET request with automatic re-login on 401."""
        if self._session is None:
            logger.error("No active session for GET %s", url)
            return None

        try:
            resp = self._session.get(url, timeout=REQUEST_TIMEOUT)
        except requests.RequestException as exc:
            logger.error("GET %s failed: %s", url, exc)
            return None

        if resp.status_code == 401:
            logger.debug("Got 401 on GET, re-logging in")
            if self.login():
                try:
                    resp = self._session.get(url, timeout=REQUEST_TIMEOUT)
                except requests.RequestException as exc:
                    logger.error("GET %s failed after re-login: %s", url, exc)
                    return None

        if resp.status_code != 200:
            logger.error("GET %s returned status %d", url, resp.status_code)
            return None

        try:
            return resp.json()
        except ValueError:
            logger.error("Invalid JSON from GET %s", url)
            return None

    def _post(self, url: str, json_data: dict) -> dict | list | None:
        """POST request with XSRF token and automatic re-login on 401."""
        if self._session is None:
            logger.error("No active session for POST %s", url)
            return None

        xsrf = self._session.cookies.get("XSRF-TOKEN", "")
        headers = {}
        if xsrf:
            headers["X-XSRF-TOKEN"] = xsrf

        try:
            resp = self._session.post(
                url, json=json_data, headers=headers, timeout=REQUEST_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.error("POST %s failed: %s", url, exc)
            return None

        if resp.status_code == 401:
            logger.debug("Got 401 on POST, re-logging in")
            if self.login():
                # After re-login, fetch dashboard to get a fresh XSRF token
                try:
                    dash_resp = self._session.get(DASHBOARD_URL, timeout=REQUEST_TIMEOUT)
                    if dash_resp.status_code != 200:
                        logger.error("Failed to refresh XSRF token: %d", dash_resp.status_code)
                        return None
                except requests.RequestException as exc:
                    logger.error("Dashboard fetch for XSRF failed: %s", exc)
                    return None

                xsrf = self._session.cookies.get("XSRF-TOKEN", "")
                if xsrf:
                    headers["X-XSRF-TOKEN"] = xsrf

                try:
                    resp = self._session.post(
                        url, json=json_data, headers=headers, timeout=REQUEST_TIMEOUT,
                    )
                except requests.RequestException as exc:
                    logger.error("POST %s failed after re-login: %s", url, exc)
                    return None

        if resp.status_code != 200:
            logger.error("POST %s returned status %d", url, resp.status_code)
            return None

        try:
            return resp.json()
        except ValueError:
            logger.error("Invalid JSON from POST %s", url)
            return None

    def fetch_dashboard(self) -> dict | None:
        """Fetch the dashboard which contains business partner and contract info."""
        return self._get(DASHBOARD_URL)

    def fetch_contract_account(self, bpn: str, can: str) -> dict | None:
        """Fetch detailed contract account data (meter readings, trends, billing)."""
        return self._get(f"{CONTRACT_ACCOUNT_URL}/{bpn}/{can}")

    def fetch_daily_consumption(
        self, can: str, mpan: str, total_days: int = 30,
    ) -> list[dict]:
        """Fetch daily consumption profile values from the smart meter.

        The eService API returns monthly aggregates when the date range
        exceeds ~7 days.  To get actual daily granularity we request in
        7-day chunks and merge the results.

        The API returns UTC timestamps. For Austrian CET/CEST, the date
        represented by ``2026-03-21T23:00:00Z`` is actually 2026-03-22 local.
        Callers must add 1 day to the UTC date portion.

        Returns a list of profile-value dicts (may be empty on failure).
        """
        all_values: list[dict] = []
        today = date.today()
        chunk_size = 7  # days per request to get daily granularity

        remaining = total_days
        chunk_end = today
        while remaining > 0:
            days_this_chunk = min(remaining, chunk_size)
            chunk_start = chunk_end - timedelta(days=days_this_chunk)

            data = self._post(CONSUMPTION_PROFILE_URL, {
                "dimension": "ENERGY",
                "pods": [{
                    "contractAccountNumber": can,
                    "meterPointAdministrationNumber": mpan,
                    "type": "ACTIVE_CURRENT",
                    "timerange": {
                        "from": chunk_start.isoformat(),
                        "to": chunk_end.isoformat(),
                    },
                    "bestAvailableGranularity": "DAY",
                }],
            })

            if data and isinstance(data, list) and len(data) > 0:
                profile = data[0]
                for pv in profile.get("profileValues", []):
                    all_values.append(pv)

            remaining -= days_this_chunk
            chunk_end = chunk_start  # next chunk ends where this one started

        return all_values


# ---------------------------------------------------------------------------
# Scrape logic
# ---------------------------------------------------------------------------


def scrape_and_update(client: NetzOOEClient) -> bool:
    """Perform a full scrape and update all Prometheus metrics.

    Returns True on success, False on failure.
    """
    # Ensure we're logged in
    if client._session is None:
        if not client.login():
            logger.error("Cannot scrape: login failed")
            return False

    # ---- Step 1: Dashboard (to discover accounts) ----
    dashboard = client.fetch_dashboard()
    if not dashboard:
        logger.error("Failed to fetch dashboard")
        return False

    business_partners = dashboard.get("businessPartners", [])
    if not business_partners:
        logger.error("No business partners found")
        return False

    bpn = business_partners[0].get("businessPartnerNumber", "")
    contract_accounts = dashboard.get("contractAccounts", [])
    if not contract_accounts:
        logger.error("No contract accounts found")
        return False

    # Use the first active contract account
    active_account = None
    for acct in contract_accounts:
        if acct.get("active"):
            active_account = acct
            break

    if not active_account:
        logger.error("No active contract account found")
        return False

    can = active_account["contractAccountNumber"]
    logger.info("Processing account %s/%s", bpn, can)

    # ---- Step 2: Contract account details (meter reading, trends, billing) ----
    ca_data = client.fetch_contract_account(bpn, can)
    if not ca_data:
        logger.error("Failed to fetch contract account %s/%s", bpn, can)
        return False

    contracts = ca_data.get("contracts", [])
    if not contracts:
        logger.error("No contracts found in account")
        return False

    contract = contracts[0]
    pod = contract.get("pointOfDelivery", {})
    mpan = pod.get("meterPointAdministrationNumber", "")

    # -- Meter reading --
    readings = pod.get("lastReadings", {}).get("values", [])
    if readings:
        reading = readings[0]
        raw_value = reading.get("newResult", {}).get("readingValue")
        if raw_value is not None:
            try:
                meter_reading = float(raw_value)
                SMARTMETER_TOTAL_KWH.set(meter_reading)
                logger.info("Meter reading: %.3f kWh", meter_reading)
            except (TypeError, ValueError):
                logger.warning("Could not parse meter reading: %s", raw_value)
    else:
        logger.warning("No meter readings available")

    # -- Monthly trend --
    mt = pod.get("monthlyTrend")
    if mt:
        current = mt.get("consumptionNew", {})
        previous = mt.get("consumptionOld", {})
        cur_sum = current.get("sum", 0)
        cur_per_day = current.get("perDay", 0)
        prev_sum = previous.get("sum", 0)
        prev_per_day = previous.get("perDay", 0)

        SMARTMETER_MONTHLY_TREND_KWH.set(cur_sum)
        SMARTMETER_MONTHLY_TREND_PER_DAY.set(cur_per_day)
        SMARTMETER_MONTHLY_TREND_PREV_KWH.set(prev_sum)

        if prev_per_day > 0:
            change_pct = ((cur_per_day - prev_per_day) / prev_per_day) * 100
            SMARTMETER_MONTHLY_TREND_CHANGE_PCT.set(round(change_pct, 2))
            SMARTMETER_MONTHLY_TREND_CHANGE_PER_DAY.set(round(cur_per_day - prev_per_day, 3))
            logger.info(
                "Monthly trend: %.1f kWh (prev %.1f kWh), %+.1f%% change, %+.2f kWh/day",
                cur_sum, prev_sum, change_pct, cur_per_day - prev_per_day,
            )
        else:
            logger.info("Monthly trend: %.1f kWh total, %.2f kWh/day", cur_sum, cur_per_day)

    # -- Yearly trend --
    yt = pod.get("yearlyTrend")
    if yt:
        current_yearly = yt.get("consumptionNew", {})
        previous_yearly = yt.get("consumptionOld", {})
        cur_yr_sum = current_yearly.get("sum", 0)
        prev_yr_sum = previous_yearly.get("sum", 0)

        SMARTMETER_YEARLY_TREND_KWH.set(cur_yr_sum)
        SMARTMETER_YEARLY_TREND_PREV_KWH.set(prev_yr_sum)

        if prev_yr_sum > 0:
            yr_change_pct = ((cur_yr_sum - prev_yr_sum) / prev_yr_sum) * 100
            SMARTMETER_YEARLY_TREND_CHANGE_PCT.set(round(yr_change_pct, 2))
            logger.info(
                "Yearly trend: %.1f kWh (prev %.1f kWh), %+.1f%%",
                cur_yr_sum, prev_yr_sum, yr_change_pct,
            )

    # -- Billing period consumptions -> monthly/yearly aggregates --
    consumptions = contract.get("consumptions", {})
    billing_periods = consumptions.get("values", [])

    # Expose each billing period as a yearly metric (periods are roughly annual)
    for period in billing_periods:
        period_from = period.get("from", "")
        period_to = period.get("to", "")
        value = period.get("value", 0)
        # Use the "to" year as the label (billing year ending)
        if period_to:
            year_label = period_to[:4]
            SMARTMETER_YEARLY_KWH.labels(year=year_label).set(value)

    # ---- Step 3: Daily consumption profile from smart meter ----
    if mpan:
        profile_values = client.fetch_daily_consumption(
            can, mpan, total_days=DAILY_PROFILE_DAYS,
        )

        if profile_values:
            valid_daily_values: list[float] = []
            monthly_sums: dict[str, float] = {}
            monthly_day_counts: dict[str, int] = {}
            # De-duplicate by local date (overlapping chunks may repeat a day)
            seen_dates: set[str] = set()

            for pv in profile_values:
                dt_str = pv.get("datetime", "")
                value = pv.get("value")
                status = pv.get("status", "")

                if value is None or status not in ("VALID", "CALCULATED"):
                    continue

                # Convert UTC date to local Austrian date (add 1 day)
                utc_date_str = dt_str[:10] if "T" in dt_str else dt_str
                try:
                    local_date = date.fromisoformat(utc_date_str) + timedelta(days=1)
                    local_date_str = local_date.isoformat()
                except ValueError:
                    local_date_str = utc_date_str

                if local_date_str in seen_dates:
                    continue
                seen_dates.add(local_date_str)

                SMARTMETER_DAILY_KWH.labels(date=local_date_str).set(value)
                valid_daily_values.append(value)

                # Aggregate into monthly totals
                month_key = local_date_str[:7]  # YYYY-MM
                monthly_sums[month_key] = monthly_sums.get(month_key, 0) + value
                monthly_day_counts[month_key] = monthly_day_counts.get(month_key, 0) + 1

            for month_key, total in monthly_sums.items():
                days_in_month = monthly_day_counts.get(month_key, 0)
                if days_in_month >= 15:
                    SMARTMETER_MONTHLY_KWH.labels(month=month_key).set(total)
                else:
                    logger.info(
                        "Skipping month %s: only %d days of data (need 15+)",
                        month_key, days_in_month,
                    )

            # -- Rolling 30-day daily average --
            if valid_daily_values:
                avg = sum(valid_daily_values) / len(valid_daily_values)
                SMARTMETER_DAILY_AVG_KWH.set(avg)
                logger.info(
                    "Daily profile: %d valid days, avg %.2f kWh/day",
                    len(valid_daily_values),
                    avg,
                )
        else:
            logger.warning("No daily consumption profile data returned")
    else:
        logger.warning("No MPAN found, skipping daily profile")

    return True


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def collector_loop(client: NetzOOEClient):
    """Background thread that periodically scrapes data."""
    while True:
        logger.info("Starting scrape cycle")
        try:
            success = scrape_and_update(client)
            SMARTMETER_SCRAPE_SUCCESS.set(1 if success else 0)
            if success:
                SMARTMETER_LAST_SCRAPE_TIMESTAMP.set(time.time())
                logger.info("Scrape completed successfully")
            else:
                logger.error("Scrape failed")
        except Exception:
            logger.exception("Unexpected error during scrape")
            SMARTMETER_SCRAPE_SUCCESS.set(0)

        logger.info("Next scrape in %d seconds (%d hours)", SCRAPE_INTERVAL, SCRAPE_INTERVAL // 3600)
        time.sleep(SCRAPE_INTERVAL)


def main():
    if not NETZOOE_USERNAME or not NETZOOE_PASSWORD:
        logger.error(
            "NETZOOE_USERNAME and NETZOOE_PASSWORD environment variables must be set"
        )
        sys.exit(1)

    logger.info("Starting Netz OÖ Smart Meter Prometheus exporter")
    logger.info("Metrics port: %d", METRICS_PORT)
    logger.info("Scrape interval: %d seconds", SCRAPE_INTERVAL)
    logger.info("Daily profile days: %d", DAILY_PROFILE_DAYS)

    client = NetzOOEClient(NETZOOE_USERNAME, NETZOOE_PASSWORD)

    # Start Prometheus metrics HTTP server
    start_http_server(METRICS_PORT)
    logger.info("Prometheus metrics server started on port %d", METRICS_PORT)

    # Run the first scrape immediately, then loop
    collector_loop(client)


if __name__ == "__main__":
    main()
