class CGAuth {
    static API_URL = "https://cgauth.com/api/v1/";
    static YOUR_APP_NAME = "NatureSoftware";
    static API_KEY = "ffcc90ea46a2a2f75b0ea9cdf4c56730697deb415dfeddf7cb5542c7698c169e";
    static API_SECRET = "d9ddc48b80982ec7168633558ea4f318f1012e0b6d6d9b1475d6dd5a154207b3";

    static async generateRequestId() {
        const timestamp = Date.now().toString();
        const randomBytes = crypto.getRandomValues(new Uint8Array(16));
        const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const combined = timestamp + randomHex;
        const encoder = new TextEncoder();
        const data = encoder.encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.toLowerCase();
    }

    static async getHWID() {
        try {
            let hwid = '';
            hwid += navigator.userAgent;
            hwid += navigator.language;
            hwid += navigator.platform;
            hwid += screen.width + 'x' + screen.height;
            hwid += screen.colorDepth;
            hwid += new Date().getTimezoneOffset();
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('CGAuth', 2, 2);
            hwid += canvas.toDataURL();
            
            const gl = canvas.getContext('webgl');
            if (gl) {
                hwid += gl.getParameter(gl.RENDERER);
                hwid += gl.getParameter(gl.VENDOR);
            }
            
            hwid = hwid.replace(/[\s\-_]/g, '').toUpperCase();
            
            const encoder = new TextEncoder();
            const data = encoder.encode(hwid);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.toUpperCase();
        } catch (error) {
            const fallback = navigator.userAgent + Date.now();
            const encoder = new TextEncoder();
            const data = encoder.encode(fallback);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex.toUpperCase();
        }
    }

    static async encryptPayload(params) {
        const json = JSON.stringify(params);
        const encoder = new TextEncoder();
        const keyMaterial = encoder.encode(CGAuth.API_SECRET);
        const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
        
        const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-CBC' }, false, ['encrypt']);
        const iv = crypto.getRandomValues(new Uint8Array(16));
        const jsonData = encoder.encode(json);
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv }, key, jsonData);
        
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        
        return btoa(String.fromCharCode(...combined));
    }

    static async decryptPayload(encrypted) {
        const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
        const iv = combined.slice(0, 16);
        const ciphertext = combined.slice(16);
        
        const encoder = new TextEncoder();
        const keyMaterial = encoder.encode(CGAuth.API_SECRET);
        const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
        
        const key = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-CBC' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv }, key, ciphertext);
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    static async verifyHMAC(data, receivedHmac, requestId) {
        const combined = data + requestId;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(CGAuth.API_SECRET);
        
        const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const messageData = encoder.encode(combined);
        const signature = await crypto.subtle.sign('HMAC', key, messageData);
        
        const hashArray = Array.from(new Uint8Array(signature));
        const computed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return computed.toLowerCase() === receivedHmac.toLowerCase();
    }

    static async authLicense(licenseKey, hwid) {
        try {
            const requestId = await CGAuth.generateRequestId();
            
            const params = {
                api_secret: CGAuth.API_SECRET,
                type: 'license',
                key: licenseKey,
                hwid: hwid,
                request_id: requestId,
                timestamp: Math.floor(Date.now() / 1000).toString()
            };
            
            const encrypted = await CGAuth.encryptPayload(params);
            
            const response = await fetch(CGAuth.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    api_key: CGAuth.API_KEY,
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
            
            if (!await CGAuth.verifyHMAC(encData, receivedHmac, requestId)) {
                throw new Error('HMAC verification failed');
            }
            
            const decrypted = await CGAuth.decryptPayload(encData);
            const result = JSON.parse(decrypted);
            
            if (result.request_id && result.request_id !== requestId) {
                throw new Error('Request ID mismatch');
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
