# EcoFlowMon — Documentation

## Overview

Prometheus-based home energy monitoring system combining two data sources:
1. **EcoFlow exporter** (Node.js) — real-time power consumption from 11 active Smart Plugs (+ 2 disconnected), plus solar/battery data from PowerStream and DELTA 2 Max via the EcoFlow IoT Platform API
2. **Smart meter exporter** (Python) — daily/monthly/yearly electricity consumption from the Netz OOE grid operator eService portal

Visualized via 3 Grafana dashboards with 40 panels total: Smart Plug Monitor (11 panels), Household Electricity (16 panels), Solar & Battery (13 panels).

**Status:** Production — running on GCP Always Free Tier (e2-micro, us-east1-b). 4 Docker containers (prometheus, grafana, ecoflow-collector, smartmeter-exporter).

## Architecture

```
EcoFlow Cloud API (HMAC-SHA256 auth)          Netz OÖ eService Portal (session auth)
    ↓ HTTP GET/POST (60s interval)                ↓ HTTP POST/GET (6h interval)
metricsCollector.js (Node.js)                 exporter.py (Python)
    ↓ Collects quotas, flattens nested JSON       ↓ Login, dashboard, contract, daily profile
prometheusExporter.js (Express on :9090)          ↓ prometheus_client on :9091
    ↓ /metrics endpoint                           ↓ /metrics endpoint
    ↓                                             ↓
Prometheus (scrapes ecoflow@60s + smartmeter@300s, 90-day retention)
    ↓
Grafana (3 dashboards on :3000)
```

**Key design decisions:**
- Dynamic metric discovery — recursively parses all numeric values from API quota responses, no hardcoded metric list
- Scaling at source — watts/volts divided by 10 in `metricsCollector.js` (EcoFlow API returns deciWatts/deciVolts)
- Offline device zeroing — power/voltage metrics for offline devices are zeroed to prevent stale cached values appearing as live data
- Template variables in Grafana — device filtering via `device_sn`, `device_name`, `smartplug_sn` instead of hardcoded serial numbers
- Two-exporter design — EcoFlow and smart meter are separate containers with independent scrape intervals (60s vs 300s) and independent failure domains
- Smart meter chunked fetching — daily consumption fetched in 7-day chunks to get daily granularity (the API returns monthly aggregates for ranges >7 days)

## File Inventory

| File | Purpose | Status |
|------|---------|--------|
| `src/index.js` | Main orchestrator — init, collect loop, graceful shutdown | Active |
| `src/config.js` | Environment-based config with validation | Active |
| `src/ecoflowClient.js` | EcoFlow API client with HMAC-SHA256 signing | Active |
| `src/metricsCollector.js` | Device discovery, metric collection, scaling, offline zeroing | Active |
| `src/prometheusExporter.js` | Express server with /metrics, /health, / endpoints | Active |
| `tests/config.test.js` | Config validation tests (13 tests) | Active |
| `tests/ecoflowClient.test.js` | API client tests incl. signature verification (18 tests) | Active |
| `tests/metricsCollector.test.js` | Collector tests incl. scaling, offline zeroing (19 tests) | Active |
| `tests/prometheusExporter.test.js` | HTTP endpoint + metric update tests (14 tests) | Active |
| `test-api.js` | Manual API endpoint discovery script | Reference |
| `test-content-type.js` | Manual Content-Type header testing | Reference |
| `test-signature.js` | Manual HMAC signature verification | Reference |
| `grafana/provisioning/dashboards/ecoflow-dashboard.json` | Smart Plug Monitor dashboard (11 panels) | Active |
| `grafana/provisioning/dashboards/ecoflow-solar-battery.json` | Solar & Battery dashboard (13 panels, devices offline) | Active |
| `grafana/provisioning/dashboards/ecoflow-smartmeter.json` | Household Electricity dashboard (16 panels) | Active |
| `grafana/provisioning/dashboards/dashboard.yml` | Dashboard provisioning config | Active |
| `grafana/provisioning/datasources/prometheus.yml` | Prometheus datasource config | Active |
| `prometheus.yml` | Prometheus scrape config (ecoflow@60s + smartmeter@300s) | Active |
| `smartmeter/exporter.py` | Netz OOE smart meter Prometheus exporter (Python) | Active |
| `smartmeter/Dockerfile` | Python 3.12-slim image for smart meter exporter | Active |
| `smartmeter/requirements.txt` | Python deps: prometheus_client, requests | Active |
| `docker-compose.yml` | Local dev: 3 services (app, prometheus, grafana) | Active |
| `docker-compose.gcp.yml` | GCP production: 4 services with logging, retention | Active |
| `Dockerfile` | Monolithic image (supervisord: node + prometheus + grafana + nginx) | Active |
| `Dockerfile.grafana` | Custom Grafana image with provisioning | Active |
| `docker-entrypoint.sh` | Monolithic container entrypoint (sed URL substitution) | Active |
| `grafana-entrypoint.sh` | Grafana entrypoint (Prometheus URL substitution) | Active |
| `supervisord.conf` | Process manager for monolithic container | Active |
| `nginx.conf` | Reverse proxy config for monolithic container | Active |
| `fly.toml` | Fly.io deployment config (Frankfurt region) | Active |
| `render.yaml` | Render.com deployment config | Archive |
| `railway.json` | Railway deployment config | Archive |
| `.github/workflows/deploy.yml` | CI/CD: Docker build + Fly.io deploy | Active |
| `.github/workflows/gcp-deploy.yml` | CI/CD: GCP VM deploy via SSH | Active |
| `terraform/gcp/main.tf` | GCP infrastructure (e2-micro VM, firewall) | Active |
| `terraform/gcp/variables.tf` | Terraform variable definitions | Active |
| `terraform/gcp/startup-script.sh` | VM startup: install Docker, clone repo, start services | Active |
| `terraform/gcp/cloud-init.yaml` | Cloud-init config for VM provisioning | Active |
| `terraform/gcp/terraform.tfvars` | Terraform variables (contains credentials!) | Active |
| `DEPLOYMENT.md` | Platform comparison (GCP, AWS, Fly.io, Render) | Active |
| `FLY_DEPLOYMENT_GUIDE.md` | Fly.io setup guide | Active |
| `RENDER_DEPLOY.md` | Render.com setup guide | Archive |
| `README.md` | Project overview and quick start | Active |

## Usage

### Prerequisites

- Node.js 20+ (Node.js 12 on GCP VM is system default; use nvm)
- npm
- EcoFlow API credentials from https://developer-eu.ecoflow.com/
- Docker + Docker Compose (for containerized deployment)

### Running Locally

```bash
cd /home/miraculix/git/tbuchboeck/EcoFlowMon
cp .env.example .env
# Edit .env with ECOFLOW_ACCESS_KEY and ECOFLOW_SECRET_KEY
npm install
npm start
# Metrics at http://localhost:9090/metrics
```

### Running with Docker Compose (Local)

```bash
docker-compose up -d
# Grafana: http://localhost:3000 (admin/admin)
# Prometheus: http://localhost:9091
# Metrics: http://localhost:9090/metrics
```

### Running Tests

```bash
npm test              # Run all 76 tests
npx jest --coverage   # With coverage report (~90%)
```

### Deploying to GCP

```bash
# From local machine
ssh miraculix@35.237.68.210
cd /opt/ecoflowmon
sudo git pull origin main
sudo docker rm -f ecoflow-collector
sudo docker-compose -f docker-compose.gcp.yml build ecoflow-collector
sudo docker-compose -f docker-compose.gcp.yml up -d ecoflow-collector
sudo docker ps
```

### Health Check

```bash
# Container status
ssh miraculix@35.237.68.210 "sudo docker ps -a"

# Prometheus scrape targets
ssh miraculix@35.237.68.210 "curl -s http://localhost:9090/api/v1/targets"

# Device count
ssh miraculix@35.237.68.210 "curl -s http://localhost:9090/api/v1/query?query=ecoflow_device_online"

# Grafana health
curl http://35.237.68.210:3000/api/health
```

## Technical Patterns

- **HMAC-SHA256 API signing** (`ecoflowClient.js:35-38`): All EcoFlow API requests require sorted parameter string + accessKey + nonce + timestamp, signed with HMAC-SHA256. The `flattenKeys()` method handles nested object serialization for the signature.

- **Dynamic metric discovery** (`metricsCollector.js:100-123`): Instead of hardcoding metric names, recursively traverses the entire quota response object. Any numeric value at any nesting depth becomes a Prometheus gauge with the key path as the metric name (e.g., `ecoflow_20_1_pv1InputWatts`).

- **DeciWatt scaling** (`metricsCollector.js:47-56`): EcoFlow API returns power in deciWatts (10x actual). The `scaleMetricValue()` method divides by 10 for metrics containing "watts", "watth", or "volt" in the name. This keeps Grafana queries clean.

- **Offline device zeroing** (`metricsCollector.js:113-116`): Power/voltage/current metrics for offline devices (`device.online === false`) are set to 0. Prevents stale cached API values (which the API keeps returning) from appearing as live data in dashboards.

- **Grafana display name overrides**: Smart plug serial numbers are mapped to friendly names (Fridge, Gaming Station, etc.) via `fieldConfig.overrides` with `byRegexp` matchers. This keeps the Prometheus data clean (uses real SNs) while showing human names in the UI.

- **Prometheus URL placeholder pattern**: The datasource provisioning uses `PROMETHEUS_URL_PLACEHOLDER` which gets `sed`-replaced in the entrypoint script. When using separate containers (docker-compose), this must be manually set to `http://prometheus:9090` via the Grafana API.

- **Netz OOE eService API pattern** (`smartmeter/exporter.py`): The Netz OOE portal exposes a REST API at `https://eservice.netzooe.at/service/`. Authentication is via `j_security_check` (POST with JSON `{j_username, j_password}`). Subsequent requests require the session cookie plus an `X-XSRF-TOKEN` header (from the `XSRF-TOKEN` cookie) for POST requests. A `client-id: netzonline` header is required on all requests. The API has three key endpoints:
  - `GET /v1.0/dashboard` — returns business partners and contract accounts
  - `GET /v1.0/contract-accounts/{bpn}/{can}` — meter readings, monthly/yearly trends, billing period history
  - `POST /v1.0/consumptions/profile/active` — daily consumption profile from the smart meter (requires 7-day chunks for daily granularity; larger ranges return monthly aggregates). API returns UTC timestamps where the date portion is 1 day behind Austrian local time (CET/CEST).

- **Two-exporter Prometheus pattern**: The EcoFlow and smart meter exporters run as independent containers with different scrape intervals. Prometheus scrapes `ecoflow-collector:9090` every 60s and `smartmeter-exporter:9091` every 300s. The smart meter exporter itself only fetches from the Netz OOE portal every 6 hours (data updates slowly), but Prometheus scrapes the cached metrics every 5 minutes.

- **Disconnected device exclusion**: The 2 disconnected speaker Smart Plugs are excluded from all dashboard panels via regex-based query filters that match only the 11 active plug serial numbers. Their metrics are still collected and zeroed but not displayed.

## Devices

| Device | Serial Number | Type | Status |
|--------|---------------|------|--------|
| Fridge | HW52ZDH59G892017 | Smart Plug | Online |
| Dryer | HW52ZDH59G855542 | Smart Plug | Online |
| Router & Charging Station | HW52ZDH59G892037 | Smart Plug | Online |
| Dishwasher | HW52ZDH59G892149 | Smart Plug | Online |
| Microwave | HW52ZDH59G892165 | Smart Plug | Online |
| Washing Machine | HW52ZDH59G894218 | Smart Plug | Online |
| TV Station | HW52ZDH59G894302 | Smart Plug | Online |
| Coffee Machine | HW52ZDH59G894556 | Smart Plug | Online |
| Workstation | HW52ZDH59G894798 | Smart Plug | Online |
| Gaming Station | HW52ZDH59G890652 | Smart Plug | Online |
| Deco Wozi | HW52ZDH59G852886 | Smart Plug | Online |
| Speaker 1 (disconnected) | HW52ZDH59G893825 | Smart Plug | Offline — removed from app, zeroed, excluded from dashboards |
| Speaker 2 (disconnected) | HW52ZDH59G895552 | Smart Plug | Offline — removed from app, zeroed, excluded from dashboards |
| PowerStream | HW51ZEH4SF6F4072 | PowerStream | Offline — solar/battery dashboard shows placeholder |
| DELTA 2 Max | R351ZEB5HG7E0271 | Power Station | Offline — solar/battery dashboard shows placeholder |

## Grafana Dashboards (3 dashboards, 40 panels total)

All panels have info tooltips explaining what the panel shows and how to read it.

### Template Variables (shared across EcoFlow dashboards)
- `device_sn` — Filter by device serial number (multi-select)
- `device_name` — Filter by device name (multi-select)
- `smartplug_sn` — Filter smart plugs (multi-select)
- `electricity_price` — EUR/kWh for cost calculation (default: 0.35)

### Dashboard 1: EcoFlow Smart Plug Monitor (11 panels)

**Top row (4 panels):**
1. Device Status (stat) — online/offline grid, shows device names on tiles
2. Daily Smart Plug Consumption (stat) — total kWh across all plugs today
3. Estimated Daily Cost (stat) — EUR cost based on electricity_price variable
4. Smart Plug Energy Ranking (bargauge) — top consumers ranked by kWh

**Main chart (1 panel):**
5. Smart Plug Power Consumption (timeseries) — stacked area with all plugs using friendly names + thick total line, lighter fills

**Cost & Energy Projections row (3 panels):**
6. Smart Plug Cost Projection (stat) — monthly/yearly cost estimates
7. Smart Plug Energy Projection (stat) — monthly/yearly kWh estimates
8. Peak Power 24h (bargauge) — highest wattage per device in last 24 hours

**Device Health row (3 panels):**
9. Plug Temperature (timeseries) — temperature readings per plug
10. WiFi Signal Strength (bargauge) — signal quality per device
11. Device Uptime (bargauge) — uptime duration per device, includes current year

### Dashboard 2: Household Electricity / Smart Meter (16 panels)

**Current Status row (4 panels):**
1. Meter Reading (stat) — current total meter reading in kWh
2. Daily Average 30d (stat) — rolling 30-day average daily consumption
3. This Month (stat) — current month consumption sum
4. Last 12 Months (stat) — yearly consumption total

**Daily Consumption row (1 panel):**
5. Daily Consumption kWh (bargauge) — bar chart with daily values

**Trends row (1 panel):**
6. 30-Day Trend (stat) — month-over-month change percentage

**Smart Plug Coverage row (3 panels):**
7. Smart Plug vs Total daily avg kWh (bargauge) — compares monitored vs total
8. Smart Plug Coverage (gauge) — percentage of total consumption covered by smart plugs
9. Unmonitored daily avg (stat) — estimated unmonitored consumption

**Historical Comparison row (2 panels):**
10. Yearly Consumption History (bargauge) — multi-year kWh comparison
11. Yearly Cost History (bargauge) — multi-year EUR comparison

**Cost Projection row (5 panels):**
12. This Month's Cost so far (stat) — cost based on current month data
13. Yearly Cost 12 months (stat) — rolling 12-month cost
14. Data Age (stat) — time since last successful smart meter scrape
15. Month Comparison kWh (bargauge) — current vs previous month
16. Yearly Trend (stat) — year-over-year change percentage

### Dashboard 3: EcoFlow Solar & Battery (13 panels, devices offline)

**Device Status row (1 panel):**
1. Info text panel — explains that PowerStream and DELTA 2 Max are currently offline

**Battery & Solar row (8 panels):**
2. Battery State of Charge (gauge) — BMS + system SoC %
3. Solar Self-Consumption Ratio (gauge) — % of solar used directly
4. Total Power Flow (timeseries) — input/output watts
5. Solar Power Input (timeseries) — MPPT PV1/PV2 + PowerStream PV1/PV2
6. Battery Power Charge/Discharge (timeseries) — centered at zero
7. Inverter Power (timeseries) — input/output + PowerStream inverter
8. PowerStream Metrics (timeseries) — grid/plug/battery watts
9. System Voltages (timeseries) — battery/PV/plug voltages

**Energy Analysis row (4 panels):**
10. Daily Energy Production kWh (stat) — solar production today
11. Energy Cost Estimation (stat) — grid cost + solar savings in EUR
12. Battery State Over Time (timeseries) — SoC + charge/discharge
13. Grid vs Solar vs Battery Power Flow (timeseries) — stacked area, color-coded

## Lessons Learned

- **DeciWatt scaling**: EcoFlow API returns raw values in deciWatts. The original approach was dividing by 10 in every Grafana query — fragile and error-prone. Moving scaling to the exporter source was much cleaner.
- **Grafana datasource provisioning**: When running Grafana as a separate container (not the monolithic Dockerfile), the `PROMETHEUS_URL_PLACEHOLDER` in the datasource YAML doesn't get substituted. Must fix both via API (immediate) and provisioning file (persistent).
- **OOM on e2-micro**: The monolithic Dockerfile running 4 services in 1GB RAM causes OOM kills (exit 137). The 2GB swap file mitigates this. Separate containers via docker-compose.gcp.yml is more stable.
- **Stale API data for offline devices**: EcoFlow API returns the last known values for offline devices. Without zeroing, disconnected devices show phantom power consumption in dashboards.
- **Old docker-compose version bugs**: The GCP VM runs docker-compose 1.29.2 which has a `ContainerConfig` KeyError when recreating containers. Workaround: `docker rm -f` then `docker-compose up -d` instead of recreating.
- **increase() on gauges is wrong**: Using `increase()` on Prometheus gauges (like smart plug power) gives incorrect energy totals. Gauges report instantaneous values, not counters. For energy estimation from power gauges, use `avg_over_time()` multiplied by hours instead.
- **Smart meter API chunking**: The Netz OOE consumption profile API returns monthly aggregates when the date range exceeds ~7 days. Must request in 7-day chunks and merge results to get actual daily granularity.
- **UTC-to-local date offset**: The Netz OOE API returns UTC timestamps where `2026-03-21T23:00:00Z` actually represents 2026-03-22 in Austrian local time (CET/CEST). The exporter adds 1 day to the UTC date portion.
- **Incomplete month filtering**: Monthly aggregation from daily smart meter data must skip months with fewer than 15 days of data, otherwise partial months show misleadingly low totals.
- **Dashboard splitting pays off**: The original 19-panel monolithic dashboard was unwieldy. Splitting into 3 focused dashboards (smart plugs, household electricity, solar/battery) makes each one cleaner and faster to load.
- **Smart plug coverage metric**: Comparing EcoFlow smart plug totals against the Netz OOE smart meter total reveals the percentage of household electricity that is actually monitored — a useful cross-validation between the two data sources.
- **Metric audit results**: 824 EcoFlow metrics + 15 smart meter metrics = 839 total. All useful metrics are covered by at least one dashboard panel. The high EcoFlow count comes from dynamic metric discovery across 15 devices.

## Timeline

| Date | Change |
|------|--------|
| 2025-11-06 | Initial project creation, EcoFlow API client, Prometheus exporter, Grafana dashboard |
| 2025-11-06 | Added Docker Compose, Render deployment, GitHub Actions CI/CD |
| 2025-11-06 | Grafana dashboard iterations: friendly names, power scaling fix (/10), Deco Wozi + Gaming Station |
| 2025-11-06 | Prometheus retention config, Fly.io deployment with persistent storage |
| 2025-11-06 | GCP Always Free Tier deployment via Terraform, CI/CD pipeline |
| 2026-03-28 | Fixed /10 metric scaling at exporter level (removed from all Grafana queries) |
| 2026-03-28 | Added 7 new Grafana panels: energy summary, cost estimation, power flow analysis |
| 2026-03-28 | Added 4 template variables (device_sn, device_name, smartplug_sn, electricity_price) |
| 2026-03-28 | Added Jest test framework: 76 tests, ~90% coverage |
| 2026-03-28 | Restored friendly names for smart plugs via Grafana overrides |
| 2026-03-28 | Labeled 2 disconnected speakers, zeroed stale offline metrics |
| 2026-03-28 | Fixed Grafana datasource URL (was PROMETHEUS_URL_PLACEHOLDER) |
| 2026-03-28 | Restarted crashed ecoflow-collector on GCP (dead 2 weeks, exit 137) |
| 2026-03-28 | Updated .gitignore (Terraform state, test coverage) |
| 2026-03-29 | Split dashboard into 3: Smart Plug Monitor (main), Solar & Battery (separate), Household Electricity (new) |
| 2026-03-29 | Added cost/energy projections, peak power (24h), and device health panels (temperature, WiFi, uptime) |
| 2026-03-29 | Built Netz OOE smart meter Python exporter (15 Prometheus metrics, 6h scrape, 7-day chunked daily profiles) |
| 2026-03-29 | Added smartmeter-exporter Docker container to docker-compose.gcp.yml and prometheus.yml |
| 2026-03-29 | Added Household Electricity dashboard with coverage comparison (smart plug % of total consumption) |
| 2026-03-29 | Fixed critical calculation errors: replaced increase() on gauges with avg_over_time(), fixed coverage queries |
| 2026-03-29 | Added info tooltips to all panels on all dashboards |
| 2026-03-29 | Device names shown on status tiles instead of Online/Offline text |
| 2026-03-29 | Removed disconnected speakers from all dashboard panel queries |
| 2026-03-29 | Added month-over-month and year-over-year trend comparisons to Household Electricity dashboard |
| 2026-03-29 | Stacked smart plug power chart with lighter fills and thick total line |
| 2026-03-29 | Metric audit: 824 EcoFlow + 15 smartmeter = 839 metrics, all useful ones covered by dashboards |
