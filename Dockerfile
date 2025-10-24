FROM node:20-alpine

# Install supervisord, nginx, and wget for Grafana
RUN apk add --no-cache supervisor nginx wget

# Install Grafana
RUN wget https://dl.grafana.com/oss/release/grafana-11.0.0.linux-amd64.tar.gz && \
    tar -zxvf grafana-11.0.0.linux-amd64.tar.gz && \
    mv grafana-v11.0.0 /grafana && \
    rm grafana-11.0.0.linux-amd64.tar.gz

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Copy Grafana provisioning
COPY grafana/provisioning /grafana/conf/provisioning

# Create supervisord config
COPY supervisord.conf /etc/supervisord.conf

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose nginx port
EXPOSE 8080

# Health check - check nginx endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run supervisord
CMD ["/docker-entrypoint.sh"]
