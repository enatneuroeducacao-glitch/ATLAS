# ATLAS — Cloudflare Workers test

This branch is an isolated deployment experiment. It must not replace the Render staging or production services until homologation is complete.

## Platform adapter

This branch uses the Cloudflare OpenNext adapter for the existing Next.js 15 app. It keeps the normal Next.js development workflow and adds Cloudflare-specific preview/deploy commands.

## Local checks

1. Install dependencies: `npm install`
2. Build for Cloudflare: `npx opennextjs-cloudflare build`
3. Preview in the Workers runtime: `npx opennextjs-cloudflare preview`

## Cloudflare dashboard

Connect the GitHub repository `enatneuroeducacao-glitch/ATLAS` to Workers Builds and select branch `feat/cloudflare-workers-test`.

Build command: `npx opennextjs-cloudflare build`

Deploy command: `npx opennextjs-cloudflare deploy`

Add secrets in the Cloudflare dashboard, never commit them:
- `GEMINI_API_KEY`
- `PIPER_TTS_URL`
- `PIPER_API_TOKEN`

The Piper URL and token must point to the existing test Piper service and its matching token. Verify whether the Piper service permits requests from the Worker before considering this test successful.

## Custom domain

Do not change DNS for `atlas.hsi-doth-pg.com.br` yet. First deploy to the `workers.dev` test hostname and validate the build, Gemini chat, Piper Faber audio, conversation history, and tasks. Attach the custom domain only after approval and successful tests.

## Important limits

Cloudflare Workers Free currently has request and CPU limits, and the free Worker bundle size limit may affect Next.js builds. Check the actual build output and dashboard usage before relying on this deployment.
