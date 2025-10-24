#!/bin/sh
set -e

echo "Starting EcoFlowMon + Grafana combined service..."

# Create nginx directories
mkdir -p /run/nginx /var/log/nginx

# Create Grafana directories
mkdir -p /grafana/data /grafana/logs /grafana/plugins

# Set Grafana admin credentials (use env vars or defaults)
export GF_SECURITY_ADMIN_USER=${GF_SECURITY_ADMIN_USER:-admin}
export GF_SECURITY_ADMIN_PASSWORD=${GF_SECURITY_ADMIN_PASSWORD:-admin}

# Set Grafana server settings
export GF_SERVER_HTTP_PORT=3000
export GF_PATHS_DATA=/grafana/data
export GF_PATHS_LOGS=/grafana/logs
export GF_PATHS_PLUGINS=/grafana/plugins
export GF_PATHS_PROVISIONING=/grafana/conf/provisioning

# Update datasource to point to Prometheus
sed -i 's|PROMETHEUS_URL_PLACEHOLDER|http://localhost:9091|g' /grafana/conf/provisioning/datasources/prometheus.yml

echo "Configuration complete. Starting services..."
echo "Services starting in order:"
echo "  1. EcoFlowMon (metrics collector) on port 9090"
echo "  2. Prometheus (time-series database) on port 9091"
echo "  3. Grafana (dashboard) on port 3000"
echo "  4. Nginx (reverse proxy) on port 8080"
echo ""
echo "Public endpoints via Nginx:"
echo "  - / -> Grafana dashboard"
echo "  - /metrics -> EcoFlowMon metrics"
echo "  - /health -> Health check"

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisord.conf
