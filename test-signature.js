const crypto = require('crypto');

// Test with the EXACT example from EcoFlow documentation (Step 8)
const accessKey = 'Fp4SvIprYSDPXtYJidEtUAd1o';
const secretKey = 'WIbFEKre0s6sLnh4ei7SPUeYnptHG6V';
const nonce = '345164';
const timestamp = '1671171709428';

// Example body from docs
const body = {
    "sn": "123456789",
    "params": {
        "cmdSet": 11,
        "id": 24,
        "eps": 0
    }
};

// Flatten according to docs: params.cmdSet=11&params.eps=0&params.id=24&sn=123456789
const flatParams = {
    'params.cmdSet': 11,
    'params.eps': 0,
    'params.id': 24,
    'sn': '123456789'
};

// Sort and build string
const sortedKeys = Object.keys(flatParams).sort();
const paramStr = sortedKeys.map(k => `${k}=${flatParams[k]}`).join('&');
const fullStr = `${paramStr}&accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;

console.log('Building signature string:');
console.log('Param string:', paramStr);
console.log('Full string:', fullStr);
console.log('');

// Generate signature
const sign = crypto.createHmac('sha256', secretKey).update(fullStr).digest('hex');

console.log('Generated signature:', sign);
console.log('Expected signature: 07c13b65e037faf3b153d51613638fa80003c4c38d2407379a7f52851af1473e');
console.log('Match:', sign === '07c13b65e037faf3b153d51613638fa80003c4c38d2407379a7f52851af1473e' ? '✅ YES' : '❌ NO');
console.log('');

// Now test with device/list endpoint (no params)
console.log('='.repeat(60));
console.log('Testing /device/list endpoint (no parameters)');
console.log('='.repeat(60));

const testNonce = '234762';
const testTimestamp = '1681796503289';
const testAccessKey = 'OCHzRuj6NLF7o43';

// For GET /device/list with no body and no query params
const listStr = `accessKey=${testAccessKey}&nonce=${testNonce}&timestamp=${testTimestamp}`;
console.log('Signature string:', listStr);

// Now test with YOUR credentials on device/list
console.log('');
console.log('='.repeat(60));
console.log('Testing with YOUR credentials');
console.log('='.repeat(60));

const yourAccessKey = 'kzeO8XFTEwm8QbcOWd6Z7mxRUhsykvFK';
const yourSecretKey = 'XsJlt5Ec25A4dkZUuH30UqQXYrTnZQZg';
const yourNonce = '123456';
const yourTimestamp = String(Date.now());

const yourStr = `accessKey=${yourAccessKey}&nonce=${yourNonce}&timestamp=${yourTimestamp}`;
const yourSign = crypto.createHmac('sha256', yourSecretKey).update(yourStr).digest('hex');

console.log('AccessKey:', yourAccessKey);
console.log('Nonce:', yourNonce);
console.log('Timestamp:', yourTimestamp);
console.log('Signature string:', yourStr);
console.log('Signature:', yourSign);
