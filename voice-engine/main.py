from __future__ import annotations

import io
import os
import re
import secrets
import threading
from typing import Iterator

import numpy as np
import soundfile as sf
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

APP_NAME = "ATLAS VOICE ENGINE"
API_TOKEN = os.getenv("ATLAS_VOICE_ENGINE_TOKEN", "").strip()
VOICE_ID = os.getenv("ATLAS_VOICE_ID", "pm_santa").strip()
LANG_CODE = os.getenv("ATLAS_VOICE_LANGUAGE", "p").strip()
MAX_TEXT_CHARS = int(os.getenv("ATLAS_VOICE_MAX_CHARS", "30000"))
CHUNK_TARGET_CHARS = int(os.getenv("ATLAS_VOICE_CHUNK_CHARS", "650"))
SAMPLE_RATE = int(os.getenv("ATLAS_VOICE_SAMPLE_RATE", "24000"))
SPEED = float(os.getenv("ATLAS_VOICE_SPEED", "1.0"))

app = FastAPI(title=APP_NAME, version="0.1.0")
_pipeline = None
_pipeline_lock = threading.Lock()
_generation_lock = threading.Lock()


class SpeechRequest(BaseModel):
    text: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    input: str | None = Field(default=None, max_length=MAX_TEXT_CHARS)
    voice: str | None = None
    speed: float | None = Field(default=None, ge=0.75, le=1.25)


def require_token(authorization: str | None) -> None:
    if not API_TOKEN:
        raise HTTPException(status_code=503, detail="ATLAS_VOICE_ENGINE_TOKEN não configurado.")
    expected = f"Bearer {API_TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="Credencial inválida.")


def get_pipeline():
    global _pipeline
    if _pipeline is None:
        with _pipeline_lock:
            if _pipeline is None:
                from kokoro import KPipeline
                _pipeline = KPipeline(lang_code=LANG_CODE)
    return _pipeline


def split_text(text: str, target: int = CHUNK_TARGET_CHARS) -> list[str]:
    text = re.sub(r"\r\n?", "\n", text).strip()
    if not text:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    for paragraph in paragraphs:
        sentences = re.split(r"(?<=[.!?;:])\s+", paragraph)
        current = ""
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            if len(sentence) > target:
                if current:
                    chunks.append(current)
                    current = ""
                words = sentence.split()
                piece = ""
                for word in words:
                    candidate = f"{piece} {word}".strip()
                    if len(candidate) > target and piece:
                        chunks.append(piece)
                        piece = word
                    else:
                        piece = candidate
                if piece:
                    chunks.append(piece)
                continue
            candidate = f"{current} {sentence}".strip()
            if len(candidate) > target and current:
                chunks.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            chunks.append(current)
    return chunks


def audio_chunks(pipeline, text: str, voice: str, speed: float) -> Iterator[np.ndarray]:
    for chunk in split_text(text):
        for _graphemes, _phonemes, audio in pipeline(chunk, voice=voice, speed=speed):
            if audio is None:
                continue
            if hasattr(audio, "detach"):
                audio = audio.detach().cpu().numpy()
            arr = np.asarray(audio, dtype=np.float32).reshape(-1)
            if arr.size:
                yield arr


@app.get("/health")
def health():
    return {
        "service": APP_NAME,
        "status": "ready",
        "model_loaded": _pipeline is not None,
        "language": LANG_CODE,
        "voice": VOICE_ID,
        "max_characters": MAX_TEXT_CHARS,
    }


@app.post("/v1/audio/speech")
def speech(payload: SpeechRequest, authorization: str | None = Header(default=None)):
    require_token(authorization)
    text = (payload.text or payload.input or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Informe o texto para narração.")
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Limite de {MAX_TEXT_CHARS} caracteres excedido.")

    voice = (payload.voice or VOICE_ID).strip()
    speed = payload.speed if payload.speed is not None else SPEED
    try:
        pipeline = get_pipeline()
        generated: list[np.ndarray] = []
        # Kokoro pipeline/model state is shared; serialize inference in this first CPU MVP.
        with _generation_lock:
            for part in audio_chunks(pipeline, text, voice, speed):
                generated.append(part)
        if not generated:
            raise RuntimeError("O modelo não retornou segmentos de áudio.")
        silence = np.zeros(int(SAMPLE_RATE * 0.12), dtype=np.float32)
        merged: list[np.ndarray] = []
        for index, part in enumerate(generated):
            if index:
                merged.append(silence)
            merged.append(part)
        audio = np.concatenate(merged)
        buffer = io.BytesIO()
        sf.write(buffer, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-store",
                "X-ATLAS-Voice-Engine": "kokoro-self-hosted",
                "X-ATLAS-Voice-ID": voice,
                "X-ATLAS-Text-Chars": str(len(text)),
                "X-ATLAS-Audio-Duration": f"{len(audio) / SAMPLE_RATE:.2f}",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        # Do not expose stack traces or local paths through the public API.
        print(f"ATLAS Voice Engine generation error: {type(exc).__name__}: {exc}", flush=True)
        raise HTTPException(status_code=503, detail="Falha interna na geração de voz.") from exc
