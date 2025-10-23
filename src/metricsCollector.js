const EcoFlowClient = require('./ecoflowClient');

class MetricsCollector {
    constructor(accessKey, secretKey) {
        this.client = new EcoFlowClient(accessKey, secretKey);
        this.devices = [];
        this.metricsCache = new Map();
    }

    /**
     * Initialize collector by fetching device list
     */
    async initialize() {
        try {
            console.log('Fetching device list...');
            this.devices = await this.client.getDeviceList();
            console.log(`Found ${this.devices.length} device(s):`);

            this.devices.forEach(device => {
                console.log(`  - ${device.productName} (SN: ${device.sn}, Online: ${device.online})`);
            });

            return this.devices;
        } catch (error) {
            console.error('Failed to initialize collector:', error.message);
            throw error;
        }
    }

    /**
     * Extract numeric value from quota data
     */
    extractNumericValue(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return isNaN(parsed) ? null : parsed;
        }
        return null;
    }

    /**
     * Collect metrics from all devices
     */
    async collectMetrics() {
        const metrics = [];

        for (const device of this.devices) {
            try {
                console.log(`Collecting metrics for ${device.productName} (${device.sn})...`);

                const quotas = await this.client.getAllDeviceQuotas(device.sn);

                // Store raw data in cache
                this.metricsCache.set(device.sn, {
                    device,
                    quotas,
                    timestamp: Date.now()
                });

                // Parse and structure metrics
                const deviceMetrics = this.parseQuotas(device, quotas);
                metrics.push(...deviceMetrics);

            } catch (error) {
                console.error(`Failed to collect metrics for ${device.sn}:`, error.message);
            }
        }

        return metrics;
    }

    /**
     * Parse quota data into structured metrics
     */
    parseQuotas(device, quotas) {
        const metrics = [];
        const labels = {
            device_name: device.productName,
            device_sn: device.sn,
            online: device.online ? '1' : '0'
        };

        // Recursively parse nested quota structure
        const parseObject = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                const metricName = prefix ? `${prefix}_${key}` : key;

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    // Recurse into nested objects
                    parseObject(value, metricName);
                } else {
                    // Try to extract numeric value
                    const numericValue = this.extractNumericValue(value);

                    if (numericValue !== null) {
                        metrics.push({
                            name: `ecoflow_${metricName}`,
                            value: numericValue,
                            labels,
                            help: `EcoFlow ${metricName} for ${device.productName}`
                        });
                    }
                }
            }
        };

        parseObject(quotas);

        // Add device online status as metric
        metrics.push({
            name: 'ecoflow_device_online',
            value: device.online ? 1 : 0,
            labels,
            help: 'Device online status (1=online, 0=offline)'
        });

        return metrics;
    }

    /**
     * Get cached metrics for a specific device
     */
    getCachedMetrics(serialNumber) {
        return this.metricsCache.get(serialNumber);
    }

    /**
     * Get all cached metrics
     */
    getAllCachedMetrics() {
        return Array.from(this.metricsCache.values());
    }
}

module.exports = MetricsCollector;
