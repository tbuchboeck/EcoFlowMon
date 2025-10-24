#!/bin/bash
set -e

# Substitute environment variables in datasource configuration
if [ -n "$PROMETHEUS_URL" ]; then
    echo "Configuring Prometheus datasource URL: $PROMETHEUS_URL"
    sed -i "s|PROMETHEUS_URL_PLACEHOLDER|${PROMETHEUS_URL}|g" /etc/grafana/provisioning/datasources/prometheus.yml
else
    echo "WARNING: PROMETHEUS_URL not set, using default"
fi

# Start Grafana using the official entrypoint
exec /run.sh "$@"
