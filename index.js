export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    
    const { licenseKey } = req.body;
    if (!licenseKey) return res.status(400).json({ success: false, error: 'License key required' });
    
    try {
        const response = await fetch('https://cgauth.com/api/v1/licenses/validate', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ffcc90ea46a2a2f75b0ea9cdf4c56730697deb415dfeddf7cb5542c7698c169e',
                'Content-Type': 'application/json',
                'X-API-Secret': 'd9ddc48b80982ec7168633558ea4f318f1012e0b6d6d9b1475d6dd5a154207b3'
            },
            body: JSON.stringify({ license_key: licenseKey })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            return res.json({ success: true, valid: true, duration: data.expires_in || 24, unit: 'hours', isAdmin: data.is_admin || false });
        }
        
        return res.json({ success: false, error: 'Invalid license' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
