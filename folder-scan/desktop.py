"""Entry point for the standalone desktop build (PyInstaller target).

Runs the Flask app in a background thread and shows it inside a native
window via pywebview, instead of opening a browser tab.
"""
import socket
import threading

import webview

from app import app, set_webview_window


def get_free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def main():
    port = get_free_port()

    server_thread = threading.Thread(
        target=lambda: app.run(host="127.0.0.1", port=port, threaded=True, use_reloader=False),
        daemon=True,
    )
    server_thread.start()

    window = webview.create_window(
        "PDF Folder Scanner",
        f"http://127.0.0.1:{port}",
        width=1150,
        height=850,
        min_size=(700, 500),
    )
    set_webview_window(window)
    webview.start()


if __name__ == "__main__":
    main()
