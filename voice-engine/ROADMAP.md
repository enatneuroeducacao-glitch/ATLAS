# ATLAS VOICE ENGINE — implementation roadmap

## Phase 1 — independent synthesis service (in progress)

- [x] Separate FastAPI microservice.
- [x] Private Bearer-token authentication.
- [x] Brazilian Portuguese Kokoro pipeline.
- [x] Long-text input up to 30,000 characters.
- [x] Paragraph/sentence-aware chunking and WAV assembly.
- [x] Voice allowlist.
- [x] Public metadata registry separating evaluation voices from institutional voice.
- [x] ATLAS server route prioritizes the first-party voice engine when configured.
- [ ] Local Docker build and smoke test.
- [ ] Deploy the service on a host with sufficient RAM/CPU or supported GPU.
- [ ] Configure ATLAS secrets and validate end-to-end synthesis.

## Phase 2 — ENAT institutional voice

- [ ] Obtain explicit written consent and scope from the selected speaker.
- [ ] Record and curate the dataset; preserve source recordings and exact transcripts.
- [ ] Select a training/fine-tuning route after license and quality review.
- [ ] Train a versioned institutional voice candidate.
- [ ] Evaluate pronunciation, intelligibility, prosody, naturalness, robustness and speaker similarity.
- [ ] Obtain institutional approval and register the approved model version.

## Phase 3 — long-form production

- [ ] Durable job queue and progress endpoint.
- [ ] Pause/resume/cancel and retry failed chunks.
- [ ] Persistent audio storage with expiration and access control.
- [ ] Streaming playback and resumable downloads.
- [ ] Audio stitching with silence/crossfade and loudness normalization.
- [ ] Integrate Audio Studio and Video Studio with job status and final asset IDs.

## Phase 4 — production hardening

- [ ] Rate limits per authenticated user.
- [ ] Metrics, structured logs, health/readiness probes and alerts.
- [ ] Secret rotation and service-to-service access policy.
- [ ] SBOM, dependency/license audit and reproducible image builds.
- [ ] Load testing with long texts and concurrent users.
- [ ] Disaster recovery and model version rollback.
