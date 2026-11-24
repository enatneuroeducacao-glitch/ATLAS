# ATLAS Piper TTS service

A small, self-hosted Piper neural TTS API for Brazilian Portuguese. It is intentionally separate from the Next.js application so the voice model and its Python runtime do not inflate the main web service. The default voice is `pt_BR-faber-medium` from the `rhasspy/piper-voices` model repository; review the model card/license before commercial use.

## Deploy on Render (without touching the production ATLAS service)

1. Create a **separate** Web Service from this repository and select the `feat/piper-tts` branch during testing.
2. Set runtime to **Docker** and Dockerfile path to `piper-service/Dockerfile` (root directory can remain the repository root).
3. Add secret environment variable `PIPER_API_TOKEN` with a long random value. Do not commit it.
4. Deploy the service and test `GET /health`; it should report `status: ok`, `modelAvailable: true`, and `authConfigured: true`.
5. In a **test/staging** ATLAS instance only, set `PIPER_TTS_URL` to the service base URL and `PIPER_API_TOKEN` to the same secret. Do not configure these on production until the test passes.

## API

`POST /v1/audio/speech` with `Authorization: Bearer <PIPER_API_TOKEN>` and JSON `{ "text": "Olá, eu sou o ATLAS." }`. Returns `audio/wav`.

The Docker image downloads the approximately 63 MB voice model at build time. The service uses CPU inference and can be slower on small instances; free hosting availability and resource limits depend on the hosting provider. This service does not call OpenAI and has no per-character provider fee, but hosting itself may not be free.
