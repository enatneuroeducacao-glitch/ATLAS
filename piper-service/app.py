import os
import secrets
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

app = FastAPI(title="ATLAS Piper TTS", docs_url=None, redoc_url=None)
MODEL = os.getenv("PIPER_MODEL", "/models/pt_BR-faber-medium.onnx")
TOKEN = os.getenv("PIPER_API_TOKEN", "")

class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4096)

@app.get("/health")
def health():
    return {"status": "ok", "provider": "piper", "modelAvailable": Path(MODEL).is_file(), "authConfigured": bool(TOKEN)}

@app.get("/demo.wav")
def demo():
    # Staging-only fixed sample; no user-supplied text and no API token exposed.
    if os.getenv("PIPER_DEMO_ENABLED", "").lower() != "true":
        raise HTTPException(status_code=404, detail="Not found")
    if not Path(MODEL).is_file():
        raise HTTPException(status_code=503, detail="Piper voice model is unavailable")
    output_path = Path("/tmp/atlas-piper-demo.wav")
    if not output_path.is_file():
        try:
            result = subprocess.run(
                ["piper", "--model", MODEL, "--output_file", str(output_path)],
                input="Olá! Eu sou o ATLAS. Esta é uma demonstração da voz neural em português brasileiro.",
                text=True,
                capture_output=True,
                timeout=90,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Piper demo generation timed out")
        if result.returncode != 0 or not output_path.is_file():
            print("Piper demo generation failed:", result.stderr[-1000:])
            raise HTTPException(status_code=502, detail="Piper could not generate demo audio")
    return FileResponse(output_path, media_type="audio/wav", filename="atlas-piper-demo.wav", headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})


@app.post("/v1/audio/speech")
def speech(payload: SpeechRequest, authorization: str | None = Header(default=None)):
    if not TOKEN:
        raise HTTPException(status_code=503, detail="Piper service authentication is not configured")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not secrets.compare_digest(supplied, TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not Path(MODEL).is_file():
        raise HTTPException(status_code=503, detail="Piper voice model is unavailable")
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")
    with tempfile.TemporaryDirectory(prefix="atlas-piper-") as temp_dir:
        output = str(Path(temp_dir) / "speech.wav")
        try:
            result = subprocess.run(
                ["piper", "--model", MODEL, "--output_file", output],
                input=text,
                text=True,
                capture_output=True,
                timeout=90,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Piper speech generation timed out")
        if result.returncode != 0 or not Path(output).is_file():
            print("Piper generation failed:", result.stderr[-1000:])
            raise HTTPException(status_code=502, detail="Piper could not generate audio")
        # Read before the temporary directory is removed, so the response owns the bytes.
        audio = Path(output).read_bytes()
    from fastapi.responses import Response
    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
