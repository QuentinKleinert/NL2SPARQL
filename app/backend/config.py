from pydantic import BaseModel
from functools import lru_cache
import os
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseModel):
    fuseki_base_url: str = os.getenv("FUSEKI_BASE_URL", "http://localhost:3030")
    fuseki_dataset: str  = os.getenv("FUSEKI_DATASET", "combined")
    fuseki_user: str     = os.getenv("FUSEKI_USER", "admin")
    fuseki_password: str = os.getenv("FUSEKI_PASSWORD", "admin")

@lru_cache
def get_settings() -> Settings:
    return Settings()
