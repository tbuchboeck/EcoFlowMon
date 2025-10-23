const crypto = require('crypto');
const axios = require('axios');

class EcoFlowClient {
    constructor(accessKey, secretKey, baseURL = 'https://api.ecoflow.com') {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.baseURL = baseURL;
    }

    /**
     * Flatten nested object keys for API signature
     */
    flattenKeys(obj, prefix = '') {
        const getPrefix = (k) => {
            if (!prefix) return k;
            return Array.isArray(obj) ? `${prefix}[${k}]` : `${prefix}.${k}`;
        };

        let res = {};
        Object.keys(obj).forEach(k => {
            if (typeof obj[k] === 'object' && obj[k] !== null) {
                res = { ...res, ...this.flattenKeys(obj[k], getPrefix(k)) };
            } else {
                res[getPrefix(k)] = obj[k];
            }
        });

        return res;
    }

    /**
     * Generate HMAC-SHA256 signature for API request
     */
    generateSignature(dataStr) {
        return crypto.createHmac('sha256', this.secretKey)
            .update(dataStr)
            .digest('hex');
    }

    /**
     * Make authenticated API request
     */
    async apiRequest(method, url, data = null) {
        const nonce = String(100000 + Math.floor(Math.random() * 100000));
        const timestamp = String(Date.now());

        // Generate data string (sorted by keys)
        let dataStr = '';
        if (data) {
            const flatData = this.flattenKeys(data);
            const flatDataKeys = Object.keys(flatData).sort();
            dataStr = flatDataKeys.map(k => `${k}=${flatData[k]}`).join('&') + '&';
        }

        const uri = `${dataStr}accessKey=${this.accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
        const sign = this.generateSignature(uri);

        try {
            const response = await axios({
                method,
                baseURL: this.baseURL,
                url,
                data,
                headers: {
                    'Content-Type': 'application/json;charset=UTF-8',
                    accessKey: this.accessKey,
                    nonce,
                    timestamp,
                    sign,
                },
            });

            if (response.status === 200 && response.data.code === '0') {
                return response.data;
            } else {
                throw new Error(`API Error ${response.data.code}: ${response.data.message}`);
            }
        } catch (error) {
            if (error.response) {
                throw new Error(`API Request Failed: ${error.response.status} - ${error.response.data?.message || error.message}`);
            }
            throw error;
        }
    }

    /**
     * Get list of all devices
     */
    async getDeviceList() {
        const response = await this.apiRequest('get', '/iot-open/sign/device/list');
        return response.data || [];
    }

    /**
     * Get all quotas for a specific device
     */
    async getAllDeviceQuotas(serialNumber) {
        const response = await this.apiRequest('get', `/iot-open/sign/device/quota/all?sn=${serialNumber}`);
        return response.data || {};
    }

    /**
     * Get specific quotas for a device
     */
    async getDeviceQuotas(serialNumber, quotas) {
        const response = await this.apiRequest('post', '/iot-open/sign/device/quota', {
            sn: serialNumber,
            params: { quotas }
        });
        return response.data || {};
    }

    /**
     * Set device parameters
     */
    async setDeviceParameters(serialNumber, moduleType, operateType, params) {
        const response = await this.apiRequest('put', '/iot-open/sign/device/quota', {
            id: Date.now(),
            version: '1.0',
            sn: serialNumber,
            moduleType,
            operateType,
            params
        });
        return response.data;
    }

    /**
     * Get MQTT credentials
     */
    async getMQTTCredentials() {
        const response = await this.apiRequest('get', '/iot-open/sign/certification');
        return response.data;
    }
}

module.exports = EcoFlowClient;
