from fastapi import FastAPI
from .routers import chat
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Meetyo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rotas
app.include_router(chat.router, prefix="/api", tags=["chat"])

@app.get("/api/health")
def health():
    return {"status": "ok"}



