FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIPER_MODEL=/models/dii_pt-BR.onnx \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends curl libespeak-ng1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY piper-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p /models \
    && curl -fsSL https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_dii/resolve/main/dii_pt-BR.onnx -o /models/dii_pt-BR.onnx \
    && curl -fsSL https://huggingface.co/OpenVoiceOS/pipertts_pt-BR_dii/resolve/main/dii_pt-BR.onnx.json -o /models/dii_pt-BR.onnx.json
COPY piper-service/app.py ./app.py
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]