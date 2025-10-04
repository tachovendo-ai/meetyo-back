from fastapi import FastAPI
from .routers import chat

app = FastAPI(title="Meetyou API", version="0.1.0")

# Rotas
app.include_router(chat.router, prefix="/api", tags=["chat"])

@app.get("/api/health")
def health():
    return {"status": "ok"}

