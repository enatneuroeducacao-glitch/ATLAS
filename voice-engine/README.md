# ATLAS VOICE ENGINE

Self-hosted neural TTS service for ATLAS/ENAT. This is an isolated CPU-first MVP; it does not replace the production TTS route until deployed and homologated.

## Current implementation

- FastAPI service with private Bearer-token authentication.
- OpenAI-compatible endpoint: POST /v1/audio/speech.
- Accepts either `text` (current ATLAS adapter) or `input`.
- Portuguese-Brazilian Kokoro pipeline (`lang_code=p`).
- Provisional male preset voice `pm_santa`; this is NOT yet the original institutional ENAT voice.
- Paragraph/sentence-aware chunking and WAV assembly.
- Configurable 30,000-character input limit.
- Health endpoint without exposing secrets.
- Single inference worker/lock for predictable CPU memory use.

## Run locally

1. Copy `.env.example` to `.env` and set a strong random `ATLAS_VOICE_ENGINE_TOKEN`.
2. Build and run:

```bash
docker build -t atlas-voice-engine ./voice-engine
docker run --rm -p 8787:8787 --env-file voice-engine/.env -v atlas-voice-models:/models atlas-voice-engine
```

3. Health check: GET http://localhost:8787/health
4. Synthesis:

```bash
curl -X POST http://localhost:8787/v1/audio/speech \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Olá. Esta é uma demonstração do motor neural de voz do ATLAS."}' \
  --output atlas-test.wav
```

The first request downloads/initializes the model and can take longer.

## Connect ATLAS

Set these secrets in the separate voice-service deployment and ATLAS web service:

- `ATLAS_VOICE_ENGINE_URL=https://YOUR-VOICE-HOST` (no trailing slash)
- `ATLAS_VOICE_ENGINE_TOKEN=the-same-long-random-secret`

ATLAS will call `/v1/audio/speech`. The web app must never contain the secret in client-side code.

## Model and licensing notes

Kokoro-82M is the provisional baseline because Brazilian Portuguese is listed with three preset voices, including male presets, and the model is distributed under Apache-2.0. The inference stack also includes dependencies with their own licenses (including eSpeak NG); retain third-party notices and perform a deployment-license review before commercial redistribution.

A preset speaker is not an ENAT-owned voice. A custom institutional voice requires:
1. written consent and documented rights from the speaker;
2. high-quality recordings with exact transcripts and usage scope;
3. a legally cleared training/fine-tuning workflow and speaker dataset;
4. evaluation for intelligibility, prosody, pronunciation and similarity;
5. versioned model artifacts and withdrawal/revocation procedure.

Do not upload third-party recordings or clone identifiable voices without explicit authorization.

## Production limitations of this MVP

- Synthesis is synchronous and serialized; use a durable queue for long-form production.
- Audio is returned as one WAV; background jobs, pause/resume, progress, storage and streaming download remain next phase.
- The 30,000-character limit is a text-input cap, not a promise of a fixed generation time.
- The initial preset voice is for technical evaluation only, not the final ENAT identity.
- Do not expose this service publicly without HTTPS, rate limiting, monitoring and secret rotation.
