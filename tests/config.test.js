describe('config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset modules so config.js re-reads process.env each time
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    function loadConfig() {
        return require('../src/config');
    }

    describe('default values', () => {
        it('should have empty access key by default', () => {
            delete process.env.ECOFLOW_ACCESS_KEY;
            const config = loadConfig();
            expect(config.ecoflow.accessKey).toBe('');
        });

        it('should have empty secret key by default', () => {
            delete process.env.ECOFLOW_SECRET_KEY;
            const config = loadConfig();
            expect(config.ecoflow.secretKey).toBe('');
        });

        it('should default API URL to EU endpoint', () => {
            delete process.env.ECOFLOW_API_URL;
            const config = loadConfig();
            expect(config.ecoflow.apiUrl).toBe('https://api-e.ecoflow.com');
        });

        it('should default collection interval to 60 seconds', () => {
            delete process.env.COLLECTION_INTERVAL;
            const config = loadConfig();
            expect(config.collection.interval).toBe(60);
        });

        it('should default metrics port to 9090', () => {
            delete process.env.METRICS_PORT;
            const config = loadConfig();
            expect(config.prometheus.port).toBe(9090);
        });
    });

    describe('env var overrides', () => {
        it('should use ECOFLOW_ACCESS_KEY from env', () => {
            process.env.ECOFLOW_ACCESS_KEY = 'my-access-key';
            const config = loadConfig();
            expect(config.ecoflow.accessKey).toBe('my-access-key');
        });

        it('should use ECOFLOW_SECRET_KEY from env', () => {
            process.env.ECOFLOW_SECRET_KEY = 'my-secret-key';
            const config = loadConfig();
            expect(config.ecoflow.secretKey).toBe('my-secret-key');
        });

        it('should use ECOFLOW_API_URL from env', () => {
            process.env.ECOFLOW_API_URL = 'https://api-a.ecoflow.com';
            const config = loadConfig();
            expect(config.ecoflow.apiUrl).toBe('https://api-a.ecoflow.com');
        });

        it('should use COLLECTION_INTERVAL from env', () => {
            process.env.COLLECTION_INTERVAL = '30';
            const config = loadConfig();
            expect(config.collection.interval).toBe(30);
        });

        it('should use METRICS_PORT from env', () => {
            process.env.METRICS_PORT = '8080';
            const config = loadConfig();
            expect(config.prometheus.port).toBe(8080);
        });
    });

    describe('validation', () => {
        it('should throw when access key is missing', () => {
            delete process.env.ECOFLOW_ACCESS_KEY;
            delete process.env.ECOFLOW_SECRET_KEY;
            const config = loadConfig();
            expect(() => config.validate()).toThrow('ECOFLOW_ACCESS_KEY is required');
        });

        it('should throw when secret key is missing', () => {
            process.env.ECOFLOW_ACCESS_KEY = 'some-key';
            delete process.env.ECOFLOW_SECRET_KEY;
            const config = loadConfig();
            expect(() => config.validate()).toThrow('ECOFLOW_SECRET_KEY is required');
        });

        it('should throw when interval is less than 10', () => {
            process.env.ECOFLOW_ACCESS_KEY = 'some-key';
            process.env.ECOFLOW_SECRET_KEY = 'some-secret';
            process.env.COLLECTION_INTERVAL = '5';
            const config = loadConfig();
            expect(() => config.validate()).toThrow(
                'COLLECTION_INTERVAL must be at least 10 seconds'
            );
        });

        it('should pass validation with valid config', () => {
            process.env.ECOFLOW_ACCESS_KEY = 'valid-key';
            process.env.ECOFLOW_SECRET_KEY = 'valid-secret';
            process.env.COLLECTION_INTERVAL = '60';
            const config = loadConfig();
            expect(config.validate()).toBe(true);
        });

        it('should list all errors when multiple validations fail', () => {
            delete process.env.ECOFLOW_ACCESS_KEY;
            delete process.env.ECOFLOW_SECRET_KEY;
            process.env.COLLECTION_INTERVAL = '5';
            const config = loadConfig();

            expect(() => config.validate()).toThrow('Configuration errors:');
        });
    });
});
