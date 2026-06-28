import os
import sys
import logging
import threading
import webbrowser
import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine, Base, init_db
import models
from routers import customer, product, quotation, order, tax, contract, auth, receivable, payable, account, convert

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    init_db()
    logger.info("[APP] 영업 ERP 서버 시작")
    yield
    # shutdown
    logger.info("[APP] 영업 ERP 서버 종료")


app = FastAPI(title="영업 ERP", version="1.2.0", lifespan=lifespan)

# CORS (개발 편의)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(customer.router)
app.include_router(product.router)
app.include_router(quotation.router)
app.include_router(contract.router)
app.include_router(order.router)
app.include_router(tax.router)
app.include_router(receivable.router)
app.include_router(payable.router)
app.include_router(account.router)
app.include_router(convert.router)


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
        # /api/* 는 라우터에서 처리되므로 여기엔 도달하지 않음
        file_path = os.path.join(static_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        # SPA 라우팅: 알 수 없는 경로는 index.html 반환
        return FileResponse(os.path.join(static_path, "index.html"))


PORT = 18765


def open_browser():
    import time
    time.sleep(1.2)
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    print(f"ERP server starting - http://localhost:{PORT}")
    if getattr(sys, 'frozen', False):
        t = threading.Thread(target=open_browser, daemon=True)
        t.start()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
