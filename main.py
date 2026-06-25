import os
import sys
import threading
import webbrowser
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base
import models
from routers import customer, product, quotation, order, tax, contract

Base.metadata.create_all(bind=engine)

app = FastAPI(title="영업 ERP", version="1.1.0")

app.include_router(customer.router)
app.include_router(product.router)
app.include_router(quotation.router)
app.include_router(contract.router)
app.include_router(order.router)
app.include_router(tax.router)

def get_static_path():
    if getattr(sys, 'frozen', False):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "frontend", "dist")

static_path = get_static_path()

if os.path.exists(static_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_path, "assets")), name="assets")

    @app.get("/")
    def serve_root():
        return FileResponse(os.path.join(static_path, "index.html"))

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = os.path.join(static_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(static_path, "index.html"))

PORT = 18765

def open_browser():
    import time
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")

if __name__ == "__main__":
    print(f"🚀 영업 ERP 서버 시작 — http://localhost:{PORT}")
    if getattr(sys, 'frozen', False):
        t = threading.Thread(target=open_browser, daemon=True)
        t.start()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
