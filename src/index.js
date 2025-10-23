const config = require('./config');
const MetricsCollector = require('./metricsCollector');
const PrometheusExporter = require('./prometheusExporter');

class EcoFlowMon {
    constructor() {
        this.collector = null;
        this.exporter = null;
        this.collectionInterval = null;
    }

    /**
     * Initialize the application
     */
    async initialize() {
        console.log('=== EcoFlowMon Starting ===');
        console.log(`Collection interval: ${config.collection.interval} seconds`);
        console.log(`Metrics port: ${config.prometheus.port}`);
        console.log('');

        // Validate configuration
        try {
            config.validate();
        } catch (error) {
            console.error('Configuration validation failed:');
            console.error(error.message);
            console.error('');
            console.error('Please check your .env file or environment variables.');
            process.exit(1);
        }

        // Initialize metrics collector
        this.collector = new MetricsCollector(
            config.ecoflow.accessKey,
            config.ecoflow.secretKey
        );

        try {
            await this.collector.initialize();
        } catch (error) {
            console.error('Failed to initialize metrics collector:');
            console.error(error.message);
            process.exit(1);
        }

        // Initialize Prometheus exporter
        this.exporter = new PrometheusExporter(config.prometheus.port);

        try {
            await this.exporter.start();
        } catch (error) {
            console.error('Failed to start Prometheus exporter:');
            console.error(error.message);
            process.exit(1);
        }

        console.log('');
        console.log('=== EcoFlowMon Initialized ===');
    }

    /**
     * Start metrics collection
     */
    async start() {
        console.log('Starting metrics collection...');
        console.log('');

        // Collect metrics immediately
        await this.collectAndExport();

        // Schedule periodic collection
        this.collectionInterval = setInterval(
            () => this.collectAndExport(),
            config.collection.interval * 1000
        );

        console.log(`Metrics collection started (every ${config.collection.interval}s)`);
    }

    /**
     * Collect metrics and update Prometheus exporter
     */
    async collectAndExport() {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Collecting metrics...`);

        try {
            const metrics = await this.collector.collectMetrics();
            this.exporter.updateMetrics(metrics);
            console.log(`[${timestamp}] Collection complete: ${metrics.length} metrics collected`);
        } catch (error) {
            console.error(`[${timestamp}] Collection failed:`, error.message);
        }

        console.log('');
    }

    /**
     * Stop the application
     */
    async stop() {
        console.log('Stopping EcoFlowMon...');

        if (this.collectionInterval) {
            clearInterval(this.collectionInterval);
        }

        if (this.exporter) {
            await this.exporter.stop();
        }

        console.log('EcoFlowMon stopped');
    }
}

// Create and start the application
const app = new EcoFlowMon();

// Handle shutdown signals
process.on('SIGTERM', async () => {
    await app.stop();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await app.stop();
    process.exit(0);
});

// Start the application
(async () => {
    try {
        await app.initialize();
        await app.start();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
