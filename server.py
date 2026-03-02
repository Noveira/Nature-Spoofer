from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import urllib.request
import urllib.error

API_KEY = 'ffcc90ea46a2a2f75b0ea9cdf4c56730697deb415dfeddf7cb5542c7698c169e'
API_SECRET = 'd9ddc48b80982ec7168633558ea4f318f1012e0b6d6d9b1475d6dd5a154207b3'
API_BASE_URL = 'https://cgauth.com/api/v1'

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        SimpleHTTPRequestHandler.end_headers(self)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
    
    def do_POST(self):
        if self.path == '/proxy-server.php':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            license_key = data.get('licenseKey', '')
            
            if not license_key:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': 'License key required'}).encode())
                return
            
            # cgauth API call
            try:
                req = urllib.request.Request(
                    f'{API_BASE_URL}/licenses/validate',
                    data=json.dumps({'license_key': license_key}).encode(),
                    headers={
                        'Authorization': f'Bearer {API_KEY}',
                        'Content-Type': 'application/json',
                        'X-API-Secret': API_SECRET
                    },
                    method='POST'
                )
                
                with urllib.request.urlopen(req) as response:
                    result = json.loads(response.read().decode())
                    
                    if result.get('valid'):
                        response_data = {
                            'success': True,
                            'valid': True,
                            'duration': result.get('expires_in', 24),
                            'unit': 'hours',
                            'isAdmin': result.get('is_admin', False)
                        }
                    else:
                        response_data = {'success': False, 'error': 'Invalid license'}
                    
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response_data).encode())
                    
            except urllib.error.HTTPError as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': f'API error: {e.code}'}).encode())
            except Exception as e:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8000), CORSRequestHandler)
    print('Server running on http://localhost:8000')
    print('Press Ctrl+C to stop')
    server.serve_forever()
