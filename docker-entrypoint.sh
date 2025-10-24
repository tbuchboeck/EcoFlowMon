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

# Update datasource to use localhost (both services in same container)
sed -i 's|PROMETHEUS_URL_PLACEHOLDER|http://localhost:9090|g' /grafana/conf/provisioning/datasources/prometheus.yml

echo "Configuration complete. Starting services..."
echo "Nginx reverse proxy will be available on port 8080"
echo "  - / -> Grafana dashboard"
echo "  - /metrics -> EcoFlowMon metrics"
echo "  - /health -> Health check"

# Start supervisord
exec /usr/bin/supervisord -c /etc/supervisord.conf
