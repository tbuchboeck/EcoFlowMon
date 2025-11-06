#!/bin/bash
set -e

# Log everything
exec > >(tee -a /var/log/ecoflowmon-startup.log)
exec 2>&1

echo "=== Starting EcoFlowMon setup at $(date) ==="

# Install Docker and dependencies
echo "Installing Docker and dependencies..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  docker.io \
  docker-compose \
  git

# Enable Docker service
systemctl enable docker
systemctl start docker

# Create app directory
echo "Creating application directory..."
mkdir -p /opt/ecoflowmon
cd /opt/ecoflowmon

# Clone repository
echo "Cloning repository..."
if [ ! -d "/opt/ecoflowmon/.git" ]; then
  git clone https://github.com/tbuchboeck/EcoFlowMon.git tmp
  mv tmp/* tmp/.??* . 2>/dev/null || true
  rm -rf tmp
else
  git pull origin main
fi

# Get secrets from metadata
echo "Fetching secrets from metadata..."
ECOFLOW_ACCESS_KEY=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/ecoflow_access_key)
ECOFLOW_SECRET_KEY=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/ecoflow_secret_key)
GRAFANA_PASSWORD=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/grafana_password)

# Create .env file
echo "Creating environment file..."
cat > /opt/ecoflowmon/.env <<EOF
ECOFLOW_ACCESS_KEY=${ECOFLOW_ACCESS_KEY}
ECOFLOW_SECRET_KEY=${ECOFLOW_SECRET_KEY}
GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
EOF

# Create persistent data directory for Prometheus
echo "Creating data directories..."
mkdir -p /opt/ecoflowmon/prometheus-data
chmod 777 /opt/ecoflowmon/prometheus-data

# Start services with Docker Compose
echo "Starting Docker services..."
cd /opt/ecoflowmon
docker-compose -f docker-compose.gcp.yml up -d

# Setup systemd service for auto-restart
echo "Setting up systemd service..."
cat > /etc/systemd/system/ecoflowmon.service <<'SYSTEMD_EOF'
[Unit]
Description=EcoFlowMon Services
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/ecoflowmon
ExecStartPre=/usr/bin/git pull origin main
ExecStart=/usr/bin/docker-compose -f docker-compose.gcp.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.gcp.yml down

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl daemon-reload
systemctl enable ecoflowmon.service

echo "=== EcoFlowMon setup completed at $(date) ==="
echo "Services should be running. Check with: docker ps"
