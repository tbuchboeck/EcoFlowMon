FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Expose Prometheus metrics port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:9090/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Run the application
CMD ["node", "src/index.js"]
