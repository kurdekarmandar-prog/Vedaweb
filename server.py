import http.server
import socketserver
import urllib.request
import urllib.parse
import os
import sys

# Reconfigure stdout/stderr to support Unicode encoding (like Hindi characters) on Windows terminals
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
if sys.stderr.encoding != 'utf-8':
    try:
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

PORT = 8000
DIRECTORY = r"C:\Users\bhini\AppData\Roaming\antigravity-ide-session-scratch" # Will fallback or determine
# Let's dynamically resolve the folder name:
# The default project directory is at C:\Users\bhini\.gemini\antigravity-ide\scratch\hindi-learning-app
DEFAULT_DIR = r"C:\Users\bhini\.gemini\antigravity-ide\scratch\hindi-learning-app"

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DEFAULT_DIR, **kwargs)

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # Intercept TTS API calls
        if parsed_url.path == '/api/tts':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            text = query_params.get('text', [''])[0]
            
            if not text:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b"Missing text parameter")
                return
                
            try:
                # Encode text for Google TTS
                encoded_text = urllib.parse.quote(text)
                url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q={encoded_text}"
                
                # Setup request with a clean User-Agent to prevent 403 blocks
                req = urllib.request.Request(
                    url,
                    headers={
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': 'https://translate.google.com/'
                    }
                )
                
                # Fetch audio bytes from Google
                with urllib.request.urlopen(req, timeout=2.0) as response:
                    audio_data = response.read()
                
                # Send back to browser
                self.send_response(200)
                self.send_header('Content-Type', 'audio/mpeg')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'max-age=86400') # Cache locally for faster play
                self.end_headers()
                self.wfile.write(audio_data)
                print(f"TTS Proxy Success for text: {repr(text)}")
                
            except Exception as e:
                print(f"TTS Proxy Error: {repr(e)}", file=sys.stderr)
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"TTS Server Error: {str(e)}".encode())
            return

        # Serve static files normally
        return super().do_GET()

# Ensure target folder is working directory
if not os.path.exists(DEFAULT_DIR):
    os.makedirs(DEFAULT_DIR, exist_ok=True)
os.chdir(DEFAULT_DIR)

# Configure socket reuse to prevent port-in-use errors
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
    print(f"Server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
