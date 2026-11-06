"""Serve the extension folder on 127.0.0.1:8766 with CORS + private-network headers,
so a live feed page (opened for testing) can fetch the content scripts."""
import http.server, functools, pathlib

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()
    def log_message(self, *a): pass

root = pathlib.Path(__file__).resolve().parent.parent
http.server.ThreadingHTTPServer(("127.0.0.1", 8766), functools.partial(H, directory=str(root))).serve_forever()
