const express = require('express');
const promClient = require('prom-client');

class PrometheusExporter {
    constructor(port = 9090) {
        this.port = port;
        this.app = express();
        this.registry = new promClient.Registry();
        this.gauges = new Map();

        // Add default metrics (process and Node.js metrics)
        promClient.collectDefaultMetrics({ register: this.registry });

        // Setup routes
        this.setupRoutes();
    }

    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).send('OK');
        });

        // Metrics endpoint for Prometheus
        this.app.get('/metrics', async (req, res) => {
            try {
                res.set('Content-Type', this.registry.contentType);
                const metrics = await this.registry.metrics();
                res.end(metrics);
            } catch (error) {
                res.status(500).send(error.message);
            }
        });

        // Info endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'EcoFlowMon',
                description: 'Prometheus exporter for EcoFlow devices',
                endpoints: {
                    '/metrics': 'Prometheus metrics',
                    '/health': 'Health check',
                    '/': 'This info page'
                }
            });
        });
    }

    /**
     * Get or create a Prometheus Gauge
     */
    getOrCreateGauge(name, help, labelNames) {
        if (!this.gauges.has(name)) {
            const gauge = new promClient.Gauge({
                name: this.sanitizeMetricName(name),
                help: help || `Metric ${name}`,
                labelNames: labelNames || [],
                registers: [this.registry]
            });
            this.gauges.set(name, gauge);
        }
        return this.gauges.get(name);
    }

    /**
     * Sanitize metric name to comply with Prometheus naming rules
     */
    sanitizeMetricName(name) {
        // Replace invalid characters with underscores
        return name.replace(/[^a-zA-Z0-9_:]/g, '_')
            // Remove leading digits
            .replace(/^[0-9]+/, '')
            // Collapse multiple underscores
            .replace(/_+/g, '_')
            // Remove trailing underscores
            .replace(/_$/, '');
    }

    /**
     * Update metrics from collected data
     */
    updateMetrics(metrics) {
        // Reset all gauges first
        this.gauges.forEach(gauge => gauge.reset());

        // Update with new values
        metrics.forEach(metric => {
            try {
                const labelNames = Object.keys(metric.labels || {});
                const gauge = this.getOrCreateGauge(
                    metric.name,
                    metric.help,
                    labelNames
                );

                if (labelNames.length > 0) {
                    gauge.set(metric.labels, metric.value);
                } else {
                    gauge.set(metric.value);
                }
            } catch (error) {
                console.error(`Failed to update metric ${metric.name}:`, error.message);
            }
        });

        console.log(`Updated ${metrics.length} metrics`);
    }

    /**
     * Start the HTTP server
     */
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`Prometheus exporter listening on port ${this.port}`);
                    console.log(`Metrics available at http://localhost:${this.port}/metrics`);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop the HTTP server
     */
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Prometheus exporter stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = PrometheusExporter;
