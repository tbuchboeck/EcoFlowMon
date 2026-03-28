const supertest = require('supertest');
const PrometheusExporter = require('../src/prometheusExporter');

describe('PrometheusExporter', () => {
    let exporter;

    beforeEach(() => {
        exporter = new PrometheusExporter(0); // port 0 = random available port
    });

    afterEach(async () => {
        await exporter.stop();
    });

    describe('sanitizeMetricName()', () => {
        it('should replace invalid characters with underscores', () => {
            expect(exporter.sanitizeMetricName('metric-name.with/special')).toBe(
                'metric_name_with_special'
            );
        });

        it('should remove leading digits', () => {
            expect(exporter.sanitizeMetricName('123metric')).toBe('metric');
        });

        it('should collapse multiple underscores', () => {
            expect(exporter.sanitizeMetricName('a___b')).toBe('a_b');
        });

        it('should remove trailing underscores', () => {
            expect(exporter.sanitizeMetricName('metric_')).toBe('metric');
        });

        it('should handle combined invalid patterns', () => {
            // '123-foo..bar__baz_' -> replace invalid -> '123_foo__bar__baz_'
            // -> remove leading digits -> '_foo__bar__baz_'
            // -> collapse underscores -> '_foo_bar_baz_'
            // -> remove trailing -> '_foo_bar_baz'
            expect(exporter.sanitizeMetricName('123-foo..bar__baz_')).toBe('_foo_bar_baz');
        });

        it('should keep colons as valid characters', () => {
            expect(exporter.sanitizeMetricName('namespace:metric')).toBe('namespace:metric');
        });

        it('should leave valid names unchanged', () => {
            expect(exporter.sanitizeMetricName('valid_metric_name')).toBe('valid_metric_name');
        });
    });

    describe('updateMetrics()', () => {
        it('should create gauges and set values', () => {
            const metrics = [
                {
                    name: 'ecoflow_watts',
                    value: 150,
                    labels: { device_sn: 'SN001' },
                    help: 'Power in watts',
                },
            ];

            exporter.updateMetrics(metrics);

            expect(exporter.gauges.has('ecoflow_watts')).toBe(true);
        });

        it('should handle metrics without labels', () => {
            const metrics = [
                {
                    name: 'ecoflow_total',
                    value: 42,
                    labels: {},
                    help: 'Total value',
                },
            ];

            // Should not throw
            expect(() => exporter.updateMetrics(metrics)).not.toThrow();
            expect(exporter.gauges.has('ecoflow_total')).toBe(true);
        });

        it('should handle multiple metrics', () => {
            const metrics = [
                {
                    name: 'ecoflow_watts',
                    value: 150,
                    labels: { device_sn: 'SN001' },
                    help: 'Power in watts',
                },
                {
                    name: 'ecoflow_volts',
                    value: 220,
                    labels: { device_sn: 'SN001' },
                    help: 'Voltage',
                },
            ];

            exporter.updateMetrics(metrics);

            expect(exporter.gauges.size).toBe(2);
        });

        it('should reset gauges before updating', () => {
            const metrics1 = [
                {
                    name: 'ecoflow_watts',
                    value: 100,
                    labels: { device_sn: 'SN001' },
                    help: 'Power',
                },
            ];
            const metrics2 = [
                {
                    name: 'ecoflow_watts',
                    value: 200,
                    labels: { device_sn: 'SN001' },
                    help: 'Power',
                },
            ];

            exporter.updateMetrics(metrics1);
            exporter.updateMetrics(metrics2);

            // Gauge should exist and have been updated (no throw)
            expect(exporter.gauges.has('ecoflow_watts')).toBe(true);
        });
    });

    describe('HTTP endpoints', () => {
        it('GET / should return JSON with name "EcoFlowMon"', async () => {
            const response = await supertest(exporter.app).get('/');

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('EcoFlowMon');
            expect(response.body.description).toBeDefined();
            expect(response.body.endpoints).toBeDefined();
        });

        it('GET /health should return 200 "OK"', async () => {
            const response = await supertest(exporter.app).get('/health');

            expect(response.status).toBe(200);
            expect(response.text).toBe('OK');
        });

        it('GET /metrics should return text with Prometheus format markers', async () => {
            const response = await supertest(exporter.app).get('/metrics');

            expect(response.status).toBe(200);
            // Default metrics from prom-client produce # HELP and # TYPE lines
            expect(response.text).toMatch(/# HELP|# TYPE/);
        });

        it('GET /metrics should include custom metrics after updateMetrics()', async () => {
            exporter.updateMetrics([
                {
                    name: 'ecoflow_test_watts',
                    value: 42,
                    labels: {},
                    help: 'Test watts metric',
                },
            ]);

            const response = await supertest(exporter.app).get('/metrics');

            expect(response.status).toBe(200);
            expect(response.text).toContain('ecoflow_test_watts');
        });
    });

    describe('start() and stop()', () => {
        it('should start and stop the server', async () => {
            // Suppress console.log for this test
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await exporter.start();
            expect(exporter.server).toBeDefined();
            expect(exporter.server.listening).toBe(true);

            await exporter.stop();
            expect(exporter.server.listening).toBe(false);

            consoleSpy.mockRestore();
        });

        it('stop() should resolve even if server was never started', async () => {
            await expect(exporter.stop()).resolves.toBeUndefined();
        });
    });
});
