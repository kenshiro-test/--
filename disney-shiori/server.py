import http.server
import socketserver
import json
import os

PORT = 8000
DATA_FILE = 'database.json'

class JSONDataHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Cache-Control', 'no-store, must-revalidate')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.wfile.write(b'{}')
        else:
            return super().do_GET()

    def do_POST(self):
        if self.path == '/api/data':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                with open(DATA_FILE, 'wb') as f:
                    f.write(post_data)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"success"}')
        else:
            self.send_response(404)
            self.end_headers()

# To allow serving exactly from this directory
os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')

print(f"Starting server. Please open http://localhost:{PORT}/index.html in your browser.")
with socketserver.TCPServer(("", PORT), JSONDataHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
