# Deploying GestureVoice to Vercel

This guide walks you through deploying **GestureVoice** to [Vercel](https://vercel.com) using the GitHub Git integration.

---

## 1. Prerequisites

- A [GitHub account](https://github.com)
- A [Vercel account](https://vercel.com/signup)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

---

## 2. Push Your Project to GitHub

If you haven't already pushed this project to a GitHub repository:

1. Initialize git and commit your files:
   ```bash
   git init
   git add .
   git commit -m "feat: setup GestureVoice with Vercel deployment configuration"
   ```

2. Create a new repository on [GitHub](https://github.com/new).

3. Link and push to your GitHub repo:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 3. Import Project into Vercel

1. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **"Add New..."** > **"Project"**.
3. Select your GitHub provider and find the repository you just pushed. Click **"Import"**.
4. In the **Configure Project** screen:
   - **Framework Preset**: Vercel will automatically detect `Vite`.
   - **Root Directory**: `./` (default).
   - **Build and Output Settings**: Automatically handled by `vercel.json`:
     - Build Command: `npm run build`
     - Output Directory: `dist`

---

## 4. Configure Environment Variables

Under the **Environment Variables** section before deploying:

| Key | Value | Description |
|---|---|---|
| `GEMINI_API_KEY` | `AIzaSy...` | Your Google Gemini API Key from Google AI Studio |

> **Note**: GestureVoice includes resilient on-device/local landmark heuristics as a fallback, but configuring `GEMINI_API_KEY` unlocks high-accuracy multimodal translation with Gemini 3.1 Flash.

Click **"Deploy"**.

---

## 5. Deployment Architecture on Vercel

This repository includes custom configuration files tailored for Vercel:

- **`vercel.json`**:
  - Automatically routes API requests (`/api/*`) to the serverless function handler.
  - Serves static assets from `dist/`.
  - Configures optimal MIME types (`application/wasm`) and CORS headers for MediaPipe hand tracking binaries in `/wasm/*`.
- **`api/index.ts`**:
  - The Vercel Serverless Function entry point powered by `@vercel/node`.
  - Re-exports the resilient Express API engine without port conflicts.
- **`server.ts`**:
  - Dual-mode server: operates as a full-stack dev server locally (`npm run dev`) and exports the Express app for Vercel serverless functions in production.

---

## 6. Testing Your Production Deployment

Once Vercel finishes the build:

1. Open your live URL (e.g. `https://your-project.vercel.app`).
2. Test the health check endpoint: `https://your-project.vercel.app/api/health` — it will return:
   ```json
   {
     "status": "ok",
     "hasKey": true,
     "timestamp": "2026-..."
   }
   ```
3. Allow camera access in the browser when prompted.
4. Try forming ASL gestures (e.g. wave hello, peace sign, thumbs up, fingerspelling).
5. Watch the real-time transcription and hear the synthesized voice playback!
