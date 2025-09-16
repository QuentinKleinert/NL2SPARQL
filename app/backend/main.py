from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.backend.routers import nl2sparql, ontology

app = FastAPI(title="NL2SPARQL API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(nl2sparql.router)
app.include_router(ontology.router)

@app.get("/health")
def health():
    return {"ok": True}
