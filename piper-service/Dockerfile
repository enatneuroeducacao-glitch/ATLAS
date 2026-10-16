FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIPER_MODEL=/models/pt_BR-faber-medium.onnx \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends curl libespeak-ng1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /models \
    && curl -fsSL https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx -o /models/pt_BR-faber-medium.onnx \
    && curl -fsSL https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json -o /models/pt_BR-faber-medium.onnx.json
COPY app.py ./app.py
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
