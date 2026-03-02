import crypto from 'crypto';

const API_URL = "https://cgauth.com/api/v1/";
const YOUR_APP_NAME = "NatureSoftware";
const API_KEY = "ffcc90ea46a2a2f75b0ea9cdf4c56730697deb415dfeddf7cb5542c7698c169e";
const API_SECRET = "d9ddc48b80982ec7168633558ea4f318f1012e0b6d6d9b1475d6dd5a154207b3";

function generateRequestId() {
    const timestamp = Date.now().toString();
    const randomHex = crypto.randomBytes(16).toString('hex');
    const combined = timestamp + randomHex;
    return crypto.createHash('sha256').update(combined).digest('hex').toLowerCase();
}

function encryptPayload(params) {
    const json = JSON.stringify(params);
    const key = crypto.createHash('sha256').update(API_SECRET).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(json, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const combined = Buffer.concat([iv, Buffer.from(encrypted, 'base64')]);
    return combined.toString('base64');
}

function decryptPayload(encrypted) {
    const combined = Buffer.from(encrypted, 'base64');
    const iv = combined.slice(0, 16);
    const ciphertext = combined.slice(16);
    
    const key = crypto.createHash('sha256').update(API_SECRET).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

function verifyHMAC(data, receivedHmac, requestId) {
    const combined = data + requestId;
    const hmac = crypto.createHmac('sha256', API_SECRET);
    hmac.update(combined);
    const computed = hmac.digest('hex').toLowerCase();
    return computed === receivedHmac.toLowerCase();
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { licenseKey, hwid } = req.body;
    
    if (!licenseKey || !hwid) {
        return res.status(400).json({ success: false, error: 'License key and HWID required' });
    }
    
    try {
        const requestId = generateRequestId();
        
        const params = {
            api_secret: API_SECRET,
            type: 'license',
            key: licenseKey,
            hwid: hwid,
            request_id: requestId,
            timestamp: Math.floor(Date.now() / 1000).toString()
        };
        
        const encrypted = encryptPayload(params);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                api_key: API_KEY,
                payload: encrypted
            })
        });
        
        const jsonResponse = await response.json();
        
        if (!jsonResponse.data || !jsonResponse.hmac || !jsonResponse.timestamp) {
            throw new Error('Invalid response structure');
        }
        
        const encData = jsonResponse.data;
        const receivedHmac = jsonResponse.hmac;
        const timestamp = jsonResponse.timestamp;
        
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > 120) {
            throw new Error('Response expired');
        }
        
        if (!verifyHMAC(encData, receivedHmac, requestId)) {
            throw new Error('HMAC verification failed');
        }
        
        const decrypted = decryptPayload(encData);
        const result = JSON.parse(decrypted);
        
        if (result.request_id && result.request_id !== requestId) {
            throw new Error('Request ID mismatch');
        }
        
        return res.json(result);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
