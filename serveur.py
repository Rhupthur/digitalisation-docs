#!/usr/bin/env python3
"""
Serveur de développement avec headers COOP/COEP
nécessaires pour SharedArrayBuffer et wllama WASM multi-thread
"""
import http.server
import sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Ces headers activent SharedArrayBuffer
        # nécessaire pour wllama multi-thread
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'require-corp')
        super().end_headers()

    def log_message(self, format, *args):
        # Log plus lisible
        print(f"[{self.date_time_string()}] {format % args}")

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
print(f"Serveur démarré sur http://localhost:{port}")
print(f"Headers COOP/COEP activés pour wllama WASM")
http.server.HTTPServer(('', port), Handler).serve_forever()
