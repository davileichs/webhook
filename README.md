<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/13fFlu3C2xlDLs6SVIk8v19pRielWm8Ky

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Prevent webhook abuse (recommended)

The ingest endpoint is `POST /hook/:id` (it accepts any HTTP method/content-type). To prevent public abuse/spam:

- **Require a shared secret**: set `HOOK_TOKEN` and include it in requests as either:
  - Header `x-hook-token: <HOOK_TOKEN>` (default), or
  - Query param `?token=<HOOK_TOKEN>` (default)
- **Rate limit**: configure `HOOK_RATE_LIMIT_WINDOW_MS` and `HOOK_RATE_LIMIT_MAX` (defaults: 60 seconds / 60 requests per IP)
- **Optional IP allowlist**: set `HOOK_IP_ALLOWLIST` to a comma-separated list of allowed IPs (exact match)

These can be set in `docker-compose.yml` under the `webhook` service `environment:`.
