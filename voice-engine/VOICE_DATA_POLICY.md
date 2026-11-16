# ATLAS Voice Bank — consent and data governance

## Non-negotiable rule

No identifiable person's voice may be recorded, cloned, trained, published, or used in production without explicit, documented authorization from the speaker (or a legally authorized representative where applicable). Consent must cover the specific purposes, training, hosting, generation, distribution, retention, and withdrawal process.

## Required record for each voice

- Voice ID and version.
- Speaker/rights-holder identity kept in restricted administrative storage (not in public registry).
- Signed consent and permitted-use scope.
- Source recording provenance and recording date.
- Exact transcripts and dataset manifest.
- Training run, model checksum, and license inventory.
- Quality evaluation and approval.
- Revocation contact and deletion/retirement procedure.

## Voice states

- `evaluation_only`: preset or temporary voice for engineering evaluation; never describe as the ENAT-owned institutional voice.
- `consent_pending`: recordings exist but authorization or scope is incomplete; not usable.
- `training`: approved dataset is being prepared or trained.
- `homologation`: candidate model under quality and legal review.
- `approved`: authorized for the exact documented scope.
- `revoked`: disabled immediately; model and derived assets handled under the consent agreement and retention policy.

## Recording guidance

Record in a quiet, acoustically treated room with a consistent microphone, distance, gain, sample rate and bit depth. Keep unprocessed original files, do not apply denoising or compression destructively, and transcribe every utterance verbatim. Capture natural sentences, questions, lists, numbers, dates, acronyms, technical/legal vocabulary and different punctuation patterns. Avoid background music, clipping, reverberation and overlapping speakers.

## Privacy and security

Store raw recordings, consent documents and training datasets in private, access-controlled storage. Never commit them to the public source repository. Encrypt storage and transport, limit access by role, log access and maintain a deletion/retirement workflow. The public voice registry contains only non-sensitive technical metadata.
