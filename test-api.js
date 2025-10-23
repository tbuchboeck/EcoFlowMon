require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

// Test different API endpoints
const API_ENDPOINTS = [
    'https://api.ecoflow.com',
    'https://api-e.ecoflow.com',
    'https://api-a.ecoflow.com'
];

const accessKey = process.env.ECOFLOW_ACCESS_KEY;
const secretKey = process.env.ECOFLOW_SECRET_KEY;

console.log('=== EcoFlow API Test ===');
console.log('Access Key:', accessKey ? `${accessKey.substring(0, 10)}...` : 'NOT SET');
console.log('Secret Key:', secretKey ? `${secretKey.substring(0, 10)}...` : 'NOT SET');
console.log('');

if (!accessKey || !secretKey) {
    console.error('ERROR: Please set ECOFLOW_ACCESS_KEY and ECOFLOW_SECRET_KEY in .env file');
    process.exit(1);
}

function flattenKeys(obj, prefix = '') {
    const getPrefix = (k) => {
        if (!prefix) return k;
        return Array.isArray(obj) ? `${prefix}[${k}]` : `${prefix}.${k}`;
    };

    let res = {};
    Object.keys(obj).forEach(k => {
        if (typeof obj[k] === 'object' && obj[k] !== null) {
            res = { ...res, ...flattenKeys(obj[k], getPrefix(k)) };
        } else {
            res[getPrefix(k)] = obj[k];
        }
    });

    return res;
}

async function testApiEndpoint(baseURL) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing endpoint: ${baseURL}`);
    console.log('='.repeat(60));

    const nonce = String(100000 + Math.floor(Math.random() * 100000));
    const timestamp = String(Date.now());

    // Test with no data (GET request)
    const uri = `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
    const sign = crypto.createHmac('sha256', secretKey).update(uri).digest('hex');

    console.log('\nRequest Details:');
    console.log('  Method: GET');
    console.log('  URL: /iot-open/sign/device/list');
    console.log('  Nonce:', nonce);
    console.log('  Timestamp:', timestamp);
    console.log('  Signature String:', uri.substring(0, 50) + '...');
    console.log('  Signature (HMAC-SHA256):', sign.substring(0, 20) + '...');

    try {
        const response = await axios({
            method: 'get',
            baseURL: baseURL,
            url: '/iot-open/sign/device/list',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                accessKey,
                nonce,
                timestamp,
                sign,
            },
            timeout: 10000,
        });

        console.log('\n✅ SUCCESS!');
        console.log('Status Code:', response.status);
        console.log('Response Code:', response.data.code);
        console.log('Response Message:', response.data.message);

        if (response.data.data) {
            console.log('Devices Found:', response.data.data.length);
            response.data.data.forEach((device, i) => {
                console.log(`  ${i + 1}. ${device.productName} (SN: ${device.sn}, Online: ${device.online})`);
            });
        }

        return true;
    } catch (error) {
        console.log('\n❌ FAILED');

        if (error.response) {
            console.log('Status Code:', error.response.status);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));

            if (error.response.data.code) {
                console.log('\nError Analysis:');
                console.log('  Code:', error.response.data.code);
                console.log('  Message:', error.response.data.message);

                // Common error codes
                switch(error.response.data.code) {
                    case '8524':
                        console.log('  → This usually means incorrect API endpoint or invalid credentials');
                        break;
                    case '100003':
                        console.log('  → This means signature verification failed');
                        break;
                    case '100001':
                        console.log('  → This means missing required parameters');
                        break;
                    default:
                        console.log('  → Unknown error code');
                }
            }
        } else if (error.request) {
            console.log('No response received from server');
            console.log('Error:', error.message);
        } else {
            console.log('Request setup error:', error.message);
        }

        return false;
    }
}

async function runTests() {
    let successCount = 0;

    for (const endpoint of API_ENDPOINTS) {
        const success = await testApiEndpoint(endpoint);
        if (success) {
            successCount++;
            console.log(`\n🎉 Working endpoint found: ${endpoint}`);
            break; // Stop on first success
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between tests
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Test Summary');
    console.log('='.repeat(60));

    if (successCount > 0) {
        console.log('✅ API connection successful!');
        console.log('\nNext steps:');
        console.log('1. Use the working endpoint in your ECOFLOW_API_URL environment variable');
        console.log('2. Deploy your application');
    } else {
        console.log('❌ All endpoints failed');
        console.log('\nTroubleshooting:');
        console.log('1. Verify your access key and secret key are correct');
        console.log('2. Check that credentials match your developer account region');
        console.log('3. Ensure your developer account has API access enabled');
        console.log('4. Try generating new credentials on the developer portal');
    }
}

runTests().catch(console.error);
