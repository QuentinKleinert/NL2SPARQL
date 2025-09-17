from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.backend.routers.nl2sparql import router as nl2sparql_router
from app.backend.routers.ontology import router as ontology_router
from app.backend.services.validator import refresh_allowed_cache
from app.backend.routers.logs import router as logs_router

app = FastAPI(title="NL2SPARQL API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nl2sparql_router)
app.include_router(ontology_router)
app.include_router(logs_router)

@app.get("/health")
def health():
    return {"ok": True}

@app.on_event("startup")
def _startup():
    refresh_allowed_cache()
