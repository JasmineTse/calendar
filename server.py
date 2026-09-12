# 本地静态服务器（Python 3 标准库，无第三方依赖）
# 用法: python server.py [端口]，默认 8642
import http.server
import socketserver
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8642


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 安静模式


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), Handler) as s:
        print('万年历已在本地运行: http://127.0.0.1:%d' % PORT)
        print('按 Ctrl+C 停止')
        s.serve_forever()
