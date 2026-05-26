import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from app.api import admin, auth, cards, comments, groups, leaderboard, users, votes
from app.core.errors import AppError, app_error_handler

app = FastAPI(title="CHOK API", version="0.1.0")

_ADMIN_HTML = Path(__file__).resolve().parent / "static" / "admin.html"
_CARDS_DIR = Path("/tmp/cards") if os.environ.get("AWS_LAMBDA_FUNCTION_NAME") else (Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "cards")
_CARDS_DIR.mkdir(parents=True, exist_ok=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(auth.router)
app.include_router(cards.router)
app.include_router(votes.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(leaderboard.router)
app.include_router(comments.router)
app.include_router(groups.router)


@app.get("/", include_in_schema=False)
def admin_page():
    return FileResponse(_ADMIN_HTML, headers={"Cache-Control": "no-cache, no-store, must-revalidate"})


@app.get("/cards/{filename}", include_in_schema=False)
def serve_card_image(filename: str):
    file_path = _CARDS_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)


@app.get("/static/{filename}", include_in_schema=False)
def serve_static(filename: str):
    static_dir = Path(__file__).resolve().parent / "static"
    file_path = static_dir / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/db")
def health_check_db():
    import traceback
    url_raw = os.environ.get("DATABASE_URL", "NOT_SET")
    url_safe = url_raw[:30] + "..." if len(url_raw) > 30 else url_raw
    try:
        import psycopg2
        from urllib.parse import urlparse
        p = urlparse(url_raw)
        conn = psycopg2.connect(
            host=p.hostname, port=p.port or 5432,
            user=p.username, password=p.password,
            dbname=p.path.lstrip("/"),
            connect_timeout=5,
        )
        conn.close()
        return {"status": "ok", "db": "connected", "host": p.hostname, "user": p.username}
    except Exception as e:
        return {"status": "error", "error": str(e)[:300], "url_prefix": url_safe, "trace": traceback.format_exc()[-300:]}


# AWS Lambda 핸들러
try:
    from mangum import Mangum
    handler = Mangum(app)
except ImportError:
    pass
