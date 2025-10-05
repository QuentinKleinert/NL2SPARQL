from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.backend.config import get_settings
from app.backend.routers.nl2sparql import router as nl2sparql_router
from app.backend.routers.ontology import router as ontology_router
from app.backend.routers.logs import router as logs_router
from app.backend.services.validator import refresh_allowed_cache
from app.backend.services.metrics import RequestTimingMiddleware
from app.backend.services.security import refresh_rate_limiter
from app.backend.routers.metrics import router as metrics_router
from app.backend.routers.kps import router as kps_router



app = FastAPI(title="NL2SPARQL API", version="0.1.0")
s = get_settings()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,           # ODER: ["*"] wenn dir das lieber ist
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nl2sparql_router)
app.include_router(ontology_router)
app.include_router(logs_router)
app.include_router(kps_router)

@app.get("/health")
def health():
    return {"ok": True}

@app.on_event("startup")
def _startup():
    refresh_allowed_cache()
    refresh_rate_limiter()

app.add_middleware(RequestTimingMiddleware)
app.include_router(metrics_router)
