FROM python:3.13-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps (falls rdflib/SW braucht)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# App
COPY app /app/app

# Healthcheck script (optional)
RUN printf '#!/bin/sh\nwget -qO- http://127.0.0.1:8000/health || exit 1\n' > /health.sh && chmod +x /health.sh

EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=5s --retries=5 CMD /health.sh

CMD ["uvicorn", "app.backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

