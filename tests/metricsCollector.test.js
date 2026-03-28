// Mock the EcoFlowClient module
jest.mock('../src/ecoflowClient');
const EcoFlowClient = require('../src/ecoflowClient');

const MetricsCollector = require('../src/metricsCollector');

describe('MetricsCollector', () => {
    let collector;

    beforeEach(() => {
        EcoFlowClient.mockClear();
        collector = new MetricsCollector('accessKey', 'secretKey', 'https://api-e.ecoflow.com');
    });

    describe('extractNumericValue()', () => {
        it('should return numbers as-is', () => {
            expect(collector.extractNumericValue(42)).toBe(42);
            expect(collector.extractNumericValue(3.14)).toBe(3.14);
            expect(collector.extractNumericValue(0)).toBe(0);
            expect(collector.extractNumericValue(-5)).toBe(-5);
        });

        it('should parse numeric strings', () => {
            expect(collector.extractNumericValue('42')).toBe(42);
            expect(collector.extractNumericValue('3.14')).toBe(3.14);
            expect(collector.extractNumericValue('0')).toBe(0);
        });

        it('should return null for non-numeric strings', () => {
            expect(collector.extractNumericValue('hello')).toBeNull();
            expect(collector.extractNumericValue('')).toBeNull();
        });

        it('should return null for null and undefined', () => {
            expect(collector.extractNumericValue(null)).toBeNull();
            expect(collector.extractNumericValue(undefined)).toBeNull();
        });

        it('should return null for objects and arrays', () => {
            expect(collector.extractNumericValue({})).toBeNull();
            expect(collector.extractNumericValue([])).toBeNull();
            expect(collector.extractNumericValue({ value: 1 })).toBeNull();
        });

        it('should return NaN for NaN input (typeof number)', () => {
            // NaN is typeof 'number', so extractNumericValue returns it as-is
            expect(collector.extractNumericValue(NaN)).toBeNaN();
        });

        it('should return null for boolean values', () => {
            expect(collector.extractNumericValue(true)).toBeNull();
            expect(collector.extractNumericValue(false)).toBeNull();
        });
    });

    describe('parseQuotas()', () => {
        const device = {
            productName: 'Smart Plug',
            sn: 'SP001',
            online: 1,
        };

        it('should produce correct metric structure with labels', () => {
            // Note: "watts" triggers scaleMetricValue which divides by 10
            const quotas = { watts: 1500 };
            const metrics = collector.parseQuotas(device, quotas);

            const wattsMetric = metrics.find((m) => m.name === 'ecoflow_watts');
            expect(wattsMetric).toBeDefined();
            expect(wattsMetric.value).toBe(150);
            expect(wattsMetric.labels).toEqual({
                device_name: 'Smart Plug',
                device_sn: 'SP001',
                online: '1',
            });
            expect(wattsMetric.help).toContain('Smart Plug');
        });

        it('should flatten nested objects into metric names', () => {
            const quotas = {
                power: {
                    current: 5,
                    voltage: 2200,  // "voltage" triggers scaleMetricValue (divides by 10)
                },
            };
            const metrics = collector.parseQuotas(device, quotas);

            const currentMetric = metrics.find((m) => m.name === 'ecoflow_power_current');
            const voltageMetric = metrics.find((m) => m.name === 'ecoflow_power_voltage');

            expect(currentMetric).toBeDefined();
            expect(currentMetric.value).toBe(5);
            expect(voltageMetric).toBeDefined();
            // scaleMetricValue divides volt metrics by 10
            expect(voltageMetric.value).toBe(220);
        });

        it('should filter out non-numeric values', () => {
            const quotas = {
                watts: 100,
                status: 'active',
                info: { name: 'test' },
                count: 5,
            };
            const metrics = collector.parseQuotas(device, quotas);

            // Should have watts, count, and device_online (3 total)
            // 'status' is non-numeric string, 'info.name' is non-numeric string
            const metricNames = metrics.map((m) => m.name);
            expect(metricNames).toContain('ecoflow_watts');
            expect(metricNames).toContain('ecoflow_count');
            expect(metricNames).not.toContain('ecoflow_status');
            expect(metricNames).not.toContain('ecoflow_info_name');
        });

        it('should always add device_online metric', () => {
            const quotas = {};
            const metrics = collector.parseQuotas(device, quotas);

            const onlineMetric = metrics.find((m) => m.name === 'ecoflow_device_online');
            expect(onlineMetric).toBeDefined();
            expect(onlineMetric.value).toBe(1);
        });

        it('should set device_online to 0 when device is offline', () => {
            const offlineDevice = { ...device, online: 0 };
            const metrics = collector.parseQuotas(offlineDevice, {});

            const onlineMetric = metrics.find((m) => m.name === 'ecoflow_device_online');
            expect(onlineMetric).toBeDefined();
            expect(onlineMetric.value).toBe(0);
        });

        it('should set online label to "0" when device is offline', () => {
            const offlineDevice = { ...device, online: 0 };
            const metrics = collector.parseQuotas(offlineDevice, {});

            metrics.forEach((m) => {
                expect(m.labels.online).toBe('0');
            });
        });

        it('should handle empty quotas with only device_online metric', () => {
            const metrics = collector.parseQuotas(device, {});
            expect(metrics).toHaveLength(1);
            expect(metrics[0].name).toBe('ecoflow_device_online');
        });
    });

    describe('scaleMetricValue()', () => {
        it('should divide watts values by 10', () => {
            expect(collector.scaleMetricValue('totalWatts', 1500)).toBe(150);
        });

        it('should divide watth values by 10', () => {
            expect(collector.scaleMetricValue('totalWattH', 5000)).toBe(500);
        });

        it('should divide volt values by 10', () => {
            expect(collector.scaleMetricValue('inputVolt', 2200)).toBe(220);
        });

        it('should not scale non-power metrics', () => {
            expect(collector.scaleMetricValue('temperature', 25)).toBe(25);
            expect(collector.scaleMetricValue('count', 10)).toBe(10);
        });
    });

    describe('collectMetrics()', () => {
        it('should collect metrics for all devices', async () => {
            const mockGetAllDeviceQuotas = jest.fn().mockResolvedValue({ watts: 100 });
            EcoFlowClient.mockImplementation(() => ({
                getDeviceList: jest.fn(),
                getAllDeviceQuotas: mockGetAllDeviceQuotas,
            }));

            collector = new MetricsCollector('ak', 'sk', 'https://api-e.ecoflow.com');
            collector.devices = [
                { productName: 'Plug1', sn: 'SN001', online: 1 },
                { productName: 'Plug2', sn: 'SN002', online: 1 },
            ];

            const metrics = await collector.collectMetrics();

            expect(mockGetAllDeviceQuotas).toHaveBeenCalledTimes(2);
            expect(mockGetAllDeviceQuotas).toHaveBeenCalledWith('SN001');
            expect(mockGetAllDeviceQuotas).toHaveBeenCalledWith('SN002');
            // Should have watts + device_online for each device = 4
            expect(metrics.length).toBe(4);
        });

        it('should handle errors for individual devices gracefully', async () => {
            const mockGetAllDeviceQuotas = jest.fn()
                .mockResolvedValueOnce({ watts: 100 })
                .mockRejectedValueOnce(new Error('API error'));

            EcoFlowClient.mockImplementation(() => ({
                getDeviceList: jest.fn(),
                getAllDeviceQuotas: mockGetAllDeviceQuotas,
            }));

            collector = new MetricsCollector('ak', 'sk', 'https://api-e.ecoflow.com');
            collector.devices = [
                { productName: 'Plug1', sn: 'SN001', online: 1 },
                { productName: 'Plug2', sn: 'SN002', online: 1 },
            ];

            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            const metrics = await collector.collectMetrics();

            // Only first device metrics (watts + device_online = 2)
            expect(metrics.length).toBe(2);

            consoleSpy.mockRestore();
            consoleLogSpy.mockRestore();
        });
    });

    describe('caching', () => {
        it('should return undefined for uncached device', () => {
            expect(collector.getCachedMetrics('UNKNOWN')).toBeUndefined();
        });

        it('should return empty array when no metrics cached', () => {
            expect(collector.getAllCachedMetrics()).toEqual([]);
        });
    });
});
