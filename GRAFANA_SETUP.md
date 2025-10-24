# Grafana Setup Guide - EcoFlow Monitoring

Complete guide to visualize your EcoFlow Smart Plug and PowerStream solar data with Grafana!

## 🎯 What You'll Get:

### Dashboard Features:
- ✅ **Device Status** - Online/offline for Smart Plug & PowerStream
- 📊 **Power Consumption** - Real-time and historical from Smart Plug
- ⚡ **Energy Usage** - Total Wh consumed over time
- ☀️ **Solar Production** - PowerStream inverter output
- 🔄 **Net Energy** - Solar production minus consumption
- 📈 **Self-Sufficiency %** - How much of your consumption is covered by solar
- 🌡️ **Temperature Monitoring** - Device and solar panel temps
- ⚙️ **System Health** - Voltage, current, status

---

## Option 1: Local Setup with Docker Compose (Recommended)

### Prerequisites:
- Docker and Docker Compose installed
- This repository cloned locally

### Steps:

1. **Navigate to the project directory:**
   ```bash
   cd EcoFlowMon
   ```

2. **Start all services** (Prometheus + Grafana):
   ```bash
   docker-compose up -d
   ```

3. **Access Grafana:**
   - URL: http://localhost:3000
   - Username: `admin`
   - Password: `admin` (change on first login)

4. **Dashboard is auto-loaded!**
   - Go to **Dashboards** → **Browse**
   - Open: **"EcoFlow Energy Monitoring - Solar + Consumption"**

5. **You should see:**
   - Device status indicators
   - Power consumption graphs
   - Solar production charts
   - Net energy flow
   - Self-sufficiency gauge

### What's Running:

| Service | URL | Purpose |
|---------|-----|---------|
| Grafana | http://localhost:3000 | Visualization dashboards |
| Prometheus | http://localhost:9091 | Metrics database |
| EcoFlowMon Cloud | https://ecoflowmon.onrender.com | Live metrics collector |

---

## Option 2: Grafana Cloud (No Installation)

### Steps:

1. **Sign up for Grafana Cloud:**
   - Go to https://grafana.com
   - Click "Get started for free"
   - Free tier includes 10k metrics (more than enough!)

2. **Add Prometheus Data Source:**
   - In Grafana Cloud → **Connections** → **Data Sources**
   - Click **Add data source** → **Prometheus**
   - Configure:
     - **Name**: `EcoFlow Prometheus`
     - **URL**: `https://ecoflowmon.onrender.com`
     - **Scrape interval**: 60s
   - Click **Save & Test**

3. **Import the Dashboard:**
   - Go to **Dashboards** → **Import**
   - Click **Upload JSON file**
   - Upload: `grafana/provisioning/dashboards/ecoflow-complete.json` from this repo
   - Select data source: **EcoFlow Prometheus**
   - Click **Import**

4. **Done!** Your dashboard is live with cloud data!

---

## Understanding the Dashboard

### Panel Descriptions:

#### 📊 Top Row - Status Overview
- **Smart Plug Status** - Green = online, Red = offline
- **PowerStream Status** - Solar inverter connectivity
- **Current Power** - Real-time power draw (Watts)
- **Solar Output** - Current solar production (Watts)

#### 📈 Middle Section - Time Series
- **Power Consumption Over Time** - Historical power usage graph
  - Shows consumption patterns
  - Useful for identifying high-usage periods

- **Total Energy Consumption** - Cumulative energy (Wh)
  - Tracks total energy used
  - Great for monthly/daily tracking

- **Solar Production** - PowerStream output over time
  - Yellow line showing solar generation
  - See production peaks during sunny hours

- **Net Energy Flow** - Production minus consumption
  - **Positive** (above 0) = Producing more than consuming ✅
  - **Negative** (below 0) = Consuming more than producing ⚠️

#### 🎯 Bottom Row - Metrics
- **Self-Sufficiency %** - Gauge showing solar coverage
  - **100%+** = All consumption covered by solar ✅
  - **50-99%** = Partially covered 🟡
  - **<50%** = Mostly grid power 🔴

- **Temperatures** - Device health monitoring
- **Voltage** - Grid voltage monitoring

---

## Dashboard Customization

### Change Time Range:
- Top-right corner → **Time picker**
- Options: Last 6h, 12h, 24h, 7d, 30d
- Custom range available

### Add More Panels:
1. Click **Add panel** (top right)
2. Select **Prometheus** data source
3. Enter metric query (examples below)
4. Customize visualization

### Useful Metric Queries:

```promql
# Current power consumption
ecoflow_2_1_watts

# Energy over time
ecoflow_2_1_watth

# Solar production
ecoflow_20_1_invOutputWatts

# Net energy (solar - consumption)
ecoflow_20_1_invOutputWatts - ecoflow_2_1_watts

# Self-sufficiency percentage
(ecoflow_20_1_invOutputWatts / ecoflow_2_1_watts) * 100

# Temperature
ecoflow_2_1_temp

# Device online status
ecoflow_device_online

# Voltage
ecoflow_2_1_volt

# Current (convert mA to A)
ecoflow_2_1_current / 1000
```

---

## Setting Up Alerts

### Example: High Power Consumption Alert

1. **Edit a panel** (e.g., "Power Consumption")
2. Click **Alert** tab
3. **Create alert rule:**
   - Name: `High Power Consumption`
   - Condition: `WHEN avg() OF query(A, 5m) IS ABOVE 1500`
   - For: `5 minutes`
4. **Add notification:**
   - Email, Slack, Discord, etc.
5. **Save**

### Example: PowerStream Offline Alert

1. Create alert on "PowerStream Status" panel
2. Condition: `WHEN last() OF query(A) IS BELOW 1`
3. For: `2 minutes`
4. Notification: "PowerStream is offline!"

---

## Troubleshooting

### Dashboard shows "No data"

**Check Prometheus is scraping:**
1. Open Prometheus: http://localhost:9091 (or your Prometheus URL)
2. Go to **Status** → **Targets**
3. Verify `ecoflow-cloud` target shows **UP** (green)

**If target is DOWN:**
- Check https://ecoflowmon.onrender.com/metrics is accessible
- Verify URL in prometheus.yml is correct
- Check firewall/network settings

### Metrics not updating

1. **Check EcoFlowMon is running:**
   - Visit: https://ecoflowmon.onrender.com/health
   - Should return: `OK`

2. **Check Render logs:**
   - Go to Render dashboard
   - View service logs
   - Look for: "Collection complete: 3749 metrics collected"

3. **Prometheus scrape interval:**
   - Default: 60 seconds
   - Be patient, wait 1-2 minutes for new data

### PowerStream shows offline

Your PowerStream might be:
- Actually offline (normal at night for solar)
- In standby mode
- Check device in EcoFlow app

The dashboard will still show last-known values even when offline.

---

## Advanced: Custom Dashboard

### Create Your Own Panels:

**Monthly Energy Cost:**
```promql
# Assuming $0.15 per kWh
(ecoflow_2_1_watth / 1000) * 0.15
```

**Peak Power Hour:**
```promql
# Max power in last 24h
max_over_time(ecoflow_2_1_watts[24h])
```

**Solar Savings:**
```promql
# Energy produced by solar (Wh to kWh, then cost)
(ecoflow_20_1_invOutputWatts / 1000) * 0.15
```

**Daily Energy Comparison:**
```promql
# Today vs yesterday
increase(ecoflow_2_1_watth[24h])
```

---

## Integration Ideas

### Home Assistant:
- Import metrics via Prometheus integration
- Create automations based on power usage
- Display on dashboards

### Alerting Examples:
- **High Usage**: Alert when consumption > 2000W
- **Solar Peak**: Notification when production > 500W
- **Offline**: Alert when devices go offline
- **Temperature**: Warning when temp > 50°C

### Export Data:
- Prometheus can export to CSV
- Use for billing analysis
- Track monthly trends

---

## Dashboard Screenshots

The dashboard includes:
- 📊 12 panels covering all aspects
- 🎨 Dark theme (customizable)
- 📱 Mobile-responsive
- ⚡ Real-time updates every 60s
- 📈 Historical data retention (15d default)

---

## Support

### Useful Commands:

```bash
# View Grafana logs
docker-compose logs grafana

# View Prometheus logs
docker-compose logs prometheus

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# View all metrics in Prometheus
# Visit: http://localhost:9091/graph
```

### Documentation Links:
- [Grafana Docs](https://grafana.com/docs/)
- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [EcoFlow IoT API](https://developer-eu.ecoflow.com/us/document/introduction)

---

## Next Steps

1. ✅ Start docker-compose
2. ✅ Open Grafana at http://localhost:3000
3. ✅ Explore the pre-built dashboard
4. ✅ Customize panels to your needs
5. ✅ Set up alerts for important metrics
6. ✅ Share dashboard URL with family/roommates!

**Your EcoFlow system is now fully monitored with beautiful visualizations!** 🎉
