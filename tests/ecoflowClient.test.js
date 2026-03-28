const crypto = require('crypto');

// Mock axios before requiring the module
jest.mock('axios');
const axios = require('axios');

const EcoFlowClient = require('../src/ecoflowClient');

describe('EcoFlowClient', () => {
    let client;

    beforeEach(() => {
        client = new EcoFlowClient('testAccessKey', 'testSecretKey', 'https://api-e.ecoflow.com');
        jest.clearAllMocks();
    });

    describe('flattenKeys()', () => {
        it('should return flat object unchanged', () => {
            const input = { a: 1, b: 'hello' };
            expect(client.flattenKeys(input)).toEqual({ a: 1, b: 'hello' });
        });

        it('should flatten nested objects with dot notation', () => {
            const input = { params: { cmdSet: 11, id: 24 } };
            expect(client.flattenKeys(input)).toEqual({
                'params.cmdSet': 11,
                'params.id': 24,
            });
        });

        it('should flatten deeply nested objects', () => {
            const input = { a: { b: { c: 42 } } };
            expect(client.flattenKeys(input)).toEqual({ 'a.b.c': 42 });
        });

        it('should flatten arrays with bracket notation', () => {
            const input = { items: [10, 20, 30] };
            expect(client.flattenKeys(input)).toEqual({
                'items[0]': 10,
                'items[1]': 20,
                'items[2]': 30,
            });
        });

        it('should handle empty objects by returning empty result', () => {
            expect(client.flattenKeys({})).toEqual({});
        });

        it('should handle null values', () => {
            const input = { a: null, b: 1 };
            expect(client.flattenKeys(input)).toEqual({ a: null, b: 1 });
        });

        it('should handle mixed nested and flat keys', () => {
            const input = {
                sn: '123456789',
                params: { cmdSet: 11, id: 24, eps: 0 },
            };
            expect(client.flattenKeys(input)).toEqual({
                sn: '123456789',
                'params.cmdSet': 11,
                'params.id': 24,
                'params.eps': 0,
            });
        });
    });

    describe('generateSignature()', () => {
        it('should produce correct HMAC-SHA256 signature for known test vector', () => {
            // From EcoFlow documentation example (test-signature.js)
            const docClient = new EcoFlowClient(
                'Fp4SvIprYSDPXtYJidEtUAd1o',
                'WIbFEKre0s6sLnh4ei7SPUeYnptHG6V'
            );

            const dataStr =
                'params.cmdSet=11&params.eps=0&params.id=24&sn=123456789' +
                '&accessKey=Fp4SvIprYSDPXtYJidEtUAd1o&nonce=345164&timestamp=1671171709428';

            const signature = docClient.generateSignature(dataStr);
            expect(signature).toBe(
                '07c13b65e037faf3b153d51613638fa80003c4c38d2407379a7f52851af1473e'
            );
        });

        it('should return a 64-character hex string', () => {
            const sig = client.generateSignature('test data');
            expect(sig).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should produce different signatures for different inputs', () => {
            const sig1 = client.generateSignature('input1');
            const sig2 = client.generateSignature('input2');
            expect(sig1).not.toBe(sig2);
        });
    });

    describe('URL query parameter extraction in apiRequest', () => {
        it('should extract query params from URL and include them in signature', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: { key: 'value' } },
            });

            await client.apiRequest('get', '/iot-open/sign/device/quota/all?sn=ABC123');

            expect(axios).toHaveBeenCalledTimes(1);
            const callArgs = axios.mock.calls[0][0];

            // URL should be cleaned (no query string)
            expect(callArgs.url).toBe('/iot-open/sign/device/quota/all');
            // Query params should be passed separately
            expect(callArgs.params).toEqual({ sn: 'ABC123' });
        });

        it('should handle URL without query params', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: [] },
            });

            await client.apiRequest('get', '/iot-open/sign/device/list');

            const callArgs = axios.mock.calls[0][0];
            expect(callArgs.url).toBe('/iot-open/sign/device/list');
            expect(callArgs.params).toBeUndefined();
        });
    });

    describe('apiRequest()', () => {
        it('should return response data on success', async () => {
            const mockData = { code: '0', data: [{ sn: 'DEV001' }] };
            axios.mockResolvedValue({ status: 200, data: mockData });

            const result = await client.apiRequest('get', '/iot-open/sign/device/list');
            expect(result).toEqual(mockData);
        });

        it('should send correct auth headers', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: {} },
            });

            await client.apiRequest('get', '/iot-open/sign/device/list');

            const headers = axios.mock.calls[0][0].headers;
            expect(headers.accessKey).toBe('testAccessKey');
            expect(headers.nonce).toBeDefined();
            expect(headers.timestamp).toBeDefined();
            expect(headers.sign).toBeDefined();
            // GET requests should NOT have Content-Type
            expect(headers['Content-Type']).toBeUndefined();
        });

        it('should include Content-Type for POST requests with data', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: {} },
            });

            await client.apiRequest('post', '/iot-open/sign/device/quota', { sn: 'ABC' });

            const headers = axios.mock.calls[0][0].headers;
            expect(headers['Content-Type']).toBe('application/json;charset=UTF-8');
        });

        it('should throw on non-zero API error code', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '100003', message: 'Signature error' },
            });

            await expect(
                client.apiRequest('get', '/iot-open/sign/device/list')
            ).rejects.toThrow('API Error 100003: Signature error');
        });

        it('should throw on HTTP error with response', async () => {
            axios.mockRejectedValue({
                response: {
                    status: 401,
                    data: { message: 'Unauthorized' },
                },
            });

            await expect(
                client.apiRequest('get', '/iot-open/sign/device/list')
            ).rejects.toThrow('API Request Failed: 401 - Unauthorized');
        });

        it('should rethrow non-response errors', async () => {
            const networkError = new Error('Network timeout');
            axios.mockRejectedValue(networkError);

            await expect(
                client.apiRequest('get', '/iot-open/sign/device/list')
            ).rejects.toThrow('Network timeout');
        });
    });

    describe('getDeviceList()', () => {
        it('should return device array from API', async () => {
            const devices = [{ sn: 'DEV001', productName: 'Smart Plug' }];
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: devices },
            });

            const result = await client.getDeviceList();
            expect(result).toEqual(devices);
        });

        it('should return empty array when no data', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0' },
            });

            const result = await client.getDeviceList();
            expect(result).toEqual([]);
        });
    });

    describe('getAllDeviceQuotas()', () => {
        it('should pass serial number as query param', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0', data: { watts: 100 } },
            });

            await client.getAllDeviceQuotas('SN12345');

            const callArgs = axios.mock.calls[0][0];
            expect(callArgs.params).toEqual({ sn: 'SN12345' });
        });

        it('should return empty object when no data', async () => {
            axios.mockResolvedValue({
                status: 200,
                data: { code: '0' },
            });

            const result = await client.getAllDeviceQuotas('SN12345');
            expect(result).toEqual({});
        });
    });
});
