require('dotenv').config();

const config = {
    // EcoFlow API credentials
    ecoflow: {
        accessKey: process.env.ECOFLOW_ACCESS_KEY || '',
        secretKey: process.env.ECOFLOW_SECRET_KEY || '',
        // EU: https://api-e.ecoflow.com (default for developer-eu.ecoflow.com)
        // US: https://api-a.ecoflow.com
        apiUrl: process.env.ECOFLOW_API_URL || 'https://api-e.ecoflow.com',
    },

    // Metrics collection settings
    collection: {
        // Interval in seconds
        interval: parseInt(process.env.COLLECTION_INTERVAL || '60', 10),
    },

    // Prometheus exporter settings
    prometheus: {
        port: parseInt(process.env.METRICS_PORT || '9090', 10),
    },

    // Validate configuration
    validate() {
        const errors = [];

        if (!this.ecoflow.accessKey) {
            errors.push('ECOFLOW_ACCESS_KEY is required');
        }

        if (!this.ecoflow.secretKey) {
            errors.push('ECOFLOW_SECRET_KEY is required');
        }

        if (this.collection.interval < 10) {
            errors.push('COLLECTION_INTERVAL must be at least 10 seconds');
        }

        if (errors.length > 0) {
            throw new Error(`Configuration errors:\n  - ${errors.join('\n  - ')}`);
        }

        return true;
    }
};

module.exports = config;
