# EcoFlowMon

Prometheus exporter for EcoFlow devices (Smart Plugs, Power Stations, etc.) using the official EcoFlow IoT Platform API.

## Features

- Collects metrics from all EcoFlow devices in your account
- Exports metrics in Prometheus format
- Ready-to-use Grafana dashboard
- Docker support with docker-compose
- Automatic device discovery
- Configurable collection intervals

## Prerequisites

1. EcoFlow device(s) registered in the EcoFlow app
2. EcoFlow Developer account (use same credentials as app)
3. API Access Key and Secret Key from [EcoFlow Developer Platform](https://developer-eu.ecoflow.com/us/security)

## Quick Start

### Using Docker Compose (Recommended)

1. Clone this repository:
```bash
git clone <repository-url>
cd EcoFlowMon
```

2. Create `.env` file with your credentials:
```bash
cp .env.example .env
# Edit .env and add your EcoFlow API credentials
```

3. Start all services (EcoFlowMon, Prometheus, Grafana):
```bash
docker-compose up -d
```

4. Access the services:
   - **Grafana**: http://localhost:3000 (admin/admin)
   - **Prometheus**: http://localhost:9091
   - **Metrics endpoint**: http://localhost:9090/metrics

### Manual Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Start the application:
```bash
npm start
```

## Configuration

All configuration is done via environment variables in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `ECOFLOW_ACCESS_KEY` | Your EcoFlow API Access Key | (required) |
| `ECOFLOW_SECRET_KEY` | Your EcoFlow API Secret Key | (required) |
| `COLLECTION_INTERVAL` | Metrics collection interval in seconds | `60` |
| `METRICS_PORT` | Port for Prometheus metrics endpoint | `9090` |

## API Credentials Setup

1. Go to [EcoFlow Developer Platform](https://developer-eu.ecoflow.com/)
2. Log in with your EcoFlow app credentials
3. Navigate to Security section
4. Create new Access Key and Secret Key
5. Copy them to your `.env` file

## Metrics

The exporter automatically discovers and exports all numeric metrics from your EcoFlow devices. Common metrics include:

- `ecoflow_device_online` - Device online status (1=online, 0=offline)
- `ecoflow_watts` - Current power consumption in watts
- `ecoflow_watth` - Total energy consumption in watt-hours
- Device-specific metrics (varies by device type)

All metrics include labels:
- `device_name` - Product name
- `device_sn` - Serial number
- `online` - Online status

## Grafana Dashboard

A pre-configured Grafana dashboard is included and automatically provisioned when using docker-compose.

To access:
1. Open http://localhost:3000
2. Login with `admin` / `admin`
3. Navigate to Dashboards → EcoFlow Smart Plug Monitoring

## Project Structure

```
EcoFlowMon/
├── src/
│   ├── index.js              # Main application
│   ├── config.js             # Configuration management
│   ├── ecoflowClient.js      # EcoFlow API client
│   ├── metricsCollector.js   # Metrics collection service
│   └── prometheusExporter.js # Prometheus exporter
├── grafana/
│   └── provisioning/         # Grafana auto-provisioning config
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Docker image definition
├── prometheus.yml            # Prometheus scrape configuration
└── package.json              # Node.js dependencies
```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## API Reference

Based on the [EcoFlow IoT Platform API](https://developer-eu.ecoflow.com/). The implementation includes:

- Device list retrieval
- Device quota (metrics) querying
- HMAC-SHA256 authentication
- Automatic request signing

## Troubleshooting

### No devices found
- Ensure devices are registered in the EcoFlow app
- Verify API credentials are correct
- Check that you're using the same account for app and developer platform

### Connection errors
- Check your internet connection
- Verify API endpoint is accessible
- Ensure credentials have not expired

### Metrics not updating
- Check collection interval configuration
- Review application logs for errors
- Verify devices are online in the EcoFlow app

## Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f ecoflowmon

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

## License

MIT

## Credits

Based on the EcoFlow IoT Platform API documentation from [haus-automatisierung.com](https://haus-automatisierung.com/hardware/2024/11/06/ecoflow-iot-api.html)