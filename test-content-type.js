const crypto = require('crypto');
const axios = require('axios');

const accessKey = '2a017V20pgTAQ5GVyuatJNq5CQ34PaDS';
const secretKey = 'o2OruwhoWoks77vYwLdaBVbhXsNxvpPe';
const baseURL = 'https://api-e.ecoflow.com';

async function testDeviceList() {
    console.log('Testing /iot-open/sign/device/list with EXACT documentation format');
    console.log('='.repeat(70));

    const nonce = '123456';
    const timestamp = String(Date.now());

    // According to docs: for GET with no body/params, signature is just:
    // accessKey=XXX&nonce=XXX&timestamp=XXX
    const signatureString = `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
    const sign = crypto.createHmac('sha256', secretKey).update(signatureString).digest('hex');

    console.log('Request details:');
    console.log('  URL:', `${baseURL}/iot-open/sign/device/list`);
    console.log('  Method: GET');
    console.log('  AccessKey:', accessKey);
    console.log('  Nonce:', nonce);
    console.log('  Timestamp:', timestamp);
    console.log('  Signature String:', signatureString);
    console.log('  Signature:', sign);
    console.log('');

    // Test 1: WITHOUT Content-Type header (as per docs - GET has no Content-Type)
    console.log('Test 1: Without Content-Type header (matching docs)');
    console.log('-'.repeat(70));
    try {
        const response = await axios({
            method: 'get',
            url: `${baseURL}/iot-open/sign/device/list`,
            headers: {
                'accessKey': accessKey,
                'nonce': nonce,
                'timestamp': timestamp,
                'sign': sign,
            },
            timeout: 10000,
        });

        console.log('✅ SUCCESS!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ FAILED');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }

    console.log('');

    // Test 2: WITH Content-Type header (what we're currently doing)
    console.log('Test 2: With Content-Type header (current implementation)');
    console.log('-'.repeat(70));
    try {
        const response = await axios({
            method: 'get',
            url: `${baseURL}/iot-open/sign/device/list`,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'accessKey': accessKey,
                'nonce': nonce,
                'timestamp': timestamp,
                'sign': sign,
            },
            timeout: 10000,
        });

        console.log('✅ SUCCESS!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.log('❌ FAILED');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
}

testDeviceList().catch(console.error);
