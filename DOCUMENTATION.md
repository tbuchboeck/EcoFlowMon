# EcoFlowMon — Documentation

## Overview

Prometheus exporter for EcoFlow smart home devices (Smart Plugs, PowerStream, DELTA 2 Max) using the official EcoFlow IoT Platform API. Collects power consumption, solar production, battery state, and voltage metrics from all registered devices and exposes them in Prometheus format. Visualized via Grafana dashboards with 19 panels across 3 sections.

**Status:** Production — running on GCP Always Free Tier (e2-micro, us-east1-b).

## Architecture

```
EcoFlow Cloud API (HMAC-SHA256 auth)
    ↓ HTTP GET/POST (60s interval)
metricsCollector.js (Node.js)
    ↓ Collects quotas, flattens nested JSON, scales deciWatts→Watts
prometheusExporter.js (Express on :9090)
    ↓ /metrics endpoint
Prometheus (scrapes every 60s, 90-day retention)
    ↓
Grafana (dashboards on :3000)
```

**Key design decisions:**
- Dynamic metric discovery — recursively parses all numeric values from API quota responses, no hardcoded metric list
- Scaling at source — watts/volts divided by 10 in `metricsCollector.js` (EcoFlow API returns deciWatts/deciVolts)
- Offline device zeroing — power/voltage metrics for offline devices are zeroed to prevent stale cached values appearing as live data
- Template variables in Grafana — device filtering via `device_sn`, `device_name`, `smartplug_sn` instead of hardcoded serial numbers

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
| `grafana/provisioning/dashboards/ecoflow-dashboard.json` | 19-panel Grafana dashboard with template variables | Active |
| `grafana/provisioning/dashboards/dashboard.yml` | Dashboard provisioning config | Active |
| `grafana/provisioning/datasources/prometheus.yml` | Prometheus datasource config | Active |
| `prometheus.yml` | Prometheus scrape config (targets `ecoflow-collector:9090`) | Active |
| `docker-compose.yml` | Local dev: 3 services (app, prometheus, grafana) | Active |
| `docker-compose.gcp.yml` | GCP production: 3 services with logging, retention | Active |
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
| Speaker 1 (disconnected) | HW52ZDH59G893825 | Smart Plug | Offline |
| Speaker 2 (disconnected) | HW52ZDH59G895552 | Smart Plug | Offline |
| PowerStream | HW51ZEH4SF6F4072 | PowerStream | Offline |
| DELTA 2 Max | R351ZEB5HG7E0271 | Power Station | Offline |

## Grafana Dashboard (19 Panels)

### Template Variables
- `device_sn` — Filter by device serial number (multi-select)
- `device_name` — Filter by device name (multi-select)
- `smartplug_sn` — Filter smart plugs (multi-select)
- `electricity_price` — EUR/kWh for cost calculation (default: 0.35)

### Row 1: Real-Time Monitoring (9 panels)
1. Device Status (stat) — online/offline grid
2. Battery State of Charge (gauge) — BMS + system SoC %
3. Total Power Flow (timeseries) — input/output watts
4. Solar Power Input (timeseries) — MPPT PV1/PV2 + PowerStream PV1/PV2
5. Battery Power (timeseries) — charge/discharge centered at zero
6. Inverter Power (timeseries) — input/output + PowerStream inverter
7. Smart Plug Power Consumption (timeseries) — all plugs with friendly names + total
8. PowerStream Metrics (timeseries) — grid/plug/battery watts
9. System Voltages (timeseries) — battery/PV/plug voltages

### Row 2: Energy Summary (4 panels)
10. Daily Energy Production (stat) — solar kWh today
11. Daily Energy Consumption (stat) — total + plug kWh today
12. Solar Self-Consumption Ratio (gauge) — % of solar used directly
13. Energy Cost Estimation (stat) — grid cost + solar savings in EUR

### Row 3: Power Flow Analysis (3 panels)
14. Battery State Over Time (timeseries) — SoC + charge/discharge
15. Grid vs Solar vs Battery (timeseries) — stacked area, color-coded
16. Smart Plug Energy Ranking (bargauge) — top 10 consumers

## Lessons Learned

- **DeciWatt scaling**: EcoFlow API returns raw values in deciWatts. The original approach was dividing by 10 in every Grafana query — fragile and error-prone. Moving scaling to the exporter source was much cleaner.
- **Grafana datasource provisioning**: When running Grafana as a separate container (not the monolithic Dockerfile), the `PROMETHEUS_URL_PLACEHOLDER` in the datasource YAML doesn't get substituted. Must fix both via API (immediate) and provisioning file (persistent).
- **OOM on e2-micro**: The monolithic Dockerfile running 4 services in 1GB RAM causes OOM kills (exit 137). The 2GB swap file mitigates this. Separate containers via docker-compose.gcp.yml is more stable.
- **Stale API data for offline devices**: EcoFlow API returns the last known values for offline devices. Without zeroing, disconnected devices show phantom power consumption in dashboards.
- **Old docker-compose version bugs**: The GCP VM runs docker-compose 1.29.2 which has a `ContainerConfig` KeyError when recreating containers. Workaround: `docker rm -f` then `docker-compose up -d` instead of recreating.

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
