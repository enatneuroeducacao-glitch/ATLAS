FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models/huggingface \
    KOKORO_CACHE_DIR=/models/kokoro

WORKDIR /srv/atlas-voice
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libsndfile1 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY voice-engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY voice-engine/main.py ./main.py
RUN useradd --create-home --uid 10001 atlasvoice && \
    mkdir -p /models && chown -R atlasvoice:atlasvoice /srv/atlas-voice /models
USER atlasvoice

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/health', timeout=3)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787", "--workers", "1"]
