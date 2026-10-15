# GestureVoice: Vercel Deployment Architecture

A comprehensive production deployment plan to host GestureVoice on Vercel with a high-performance Vite frontend, serverless Express API adapter for Gemini multimodal gesture recognition, and zero-downtime GitHub push-to-deploy integration.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters were selected during interactive clarification:

- **Confirmed Serverless Architecture**: Serverless Express handler (`api/index.ts`) integrated with `vercel.json` rewrites, preserving all existing Express middleware, multimodal timeouts, and `/api/translate-gesture` and `/api/translate-video` routes without client-side refactoring.
- **Confirmed Deployment Workflow**: Vercel GitHub integration (push-to-deploy on `main`/`master` branch), enabling automatic preview deployments on PRs and automated production builds upon merge.
- **Confirmed Key Management**: Server-side `GEMINI_API_KEY` configured securely via Vercel Project Environment Variables, ensuring zero key exposure to client bundles while maintaining graceful offline landmark fallbacks.

---

## 1. Overview & Core Concept

- **What It Does**: GestureVoice is an assistive sign language and universal hand gesture to voice translator. Deploying to Vercel enables globally distributed, edge-cached delivery of the React 19 frontend and MediaPipe WASM assets, with scalable serverless execution for Google Gemini 3 multimodal vision and video translation endpoints.
- **Target Audience & Production Environment**:
  - Deaf and non-verbal users accessing the app across mobile and desktop browsers with low latency.
  - Seamless CI/CD through GitHub where every commit triggers automated linting, Vite asset bundling, and serverless route optimization.
- **Key Value**: Provides a reliable, publicly shareable, production-ready URL on Vercel (`*.vercel.app`) with custom domain support, HTTPS by default, and continuous deployment.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Production Loading & Asset Verification**:
   - Immediate loading of the tactile, high-contrast UI (Nunito + JetBrains Mono typography, custom SVG mascot, pressable tactile buttons).
   - MediaPipe WASM binaries and models load smoothly from the Vercel static asset cache with correct MIME headers (`application/wasm`).
2. **Camera & Voice Translation**:
   - Client captures webcam frames and hand landmark telemetry, streaming requests to `/api/translate-gesture`.
   - Vercel Serverless Function invokes `@google/genai` (Gemini 3.1 Flash Lite) or triggers the resilient 21-landmark rule engine within the configured function timeout.
3. **Graceful Fallbacks & Offline Capability**:
   - If the Gemini API key is missing or quota is exceeded on Vercel, the app displays clear offline/local cues without crashing, continuing hand gesture detection via client and server fallback rules.

### Visual Identity & Theme Preservation
- Retains the newly overhauled "Playful Tiles" aesthetic:
  - Signer theme: High-visibility Emerald (`#22c55e`, `#15803d` bottom edge) for camera translation, active feedback, and vocabulary drills.
  - Partner theme: High-contrast Blue (`#3b82f6`, `#1d4ed8` bottom edge) for two-way mic transcription and partner replies.
  - Quiet, unboxed metadata adhering to the Zero-Pill discipline with subtle dot separators (`·`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Serverless Express Handler (`api/index.ts`) vs. Individual Endpoint Files**
  - *Chosen Approach*: Export a unified Express app through `api/index.ts` with a catch-all rewrite in `vercel.json`.
  - *Why*: The existing `server.ts` contains extensive gesture landmark processing, video frame aggregation logic, and resilient fallback classifiers. Re-exporting this logic via an Express handler avoids code duplication, simplifies testing between local dev (`tsx server.ts`) and Vercel serverless, and keeps client API contract paths identical.
  - *Trade-Off*: Serverless cold starts are slightly higher than micro-functions (~250ms), but offset by instant routing and unified error handling.

- **Decision 2: Separation of Development Server from Serverless Entry Point**
  - *Chosen Approach*: Maintain `server.ts` for local AI Studio development (`tsx server.ts` with Vite middleware) while creating a dedicated `api/index.ts` export for Vercel's serverless runtime.
  - *Why*: AI Studio requires an interactive Express dev server on port 3000 with Vite middleware, while Vercel expects an exported request listener without `app.listen()`. Splitting the entry wrappers preserves full compatibility in both environments.

- **Decision 3: MediaPipe WASM Static Asset Distribution**
  - *Chosen Approach*: Serve MediaPipe WASM files from `/public/wasm` with automatic static routing via Vite and Vercel CDN headers.
  - *Why*: WebAssembly binaries require exact `application/wasm` MIME type and cross-origin isolation headers for multithreaded SIMD performance.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Vercel Edge Network                   │
│                                                             │
│   ┌───────────────────────────┐  ┌───────────────────────┐  │
│   │   Static Assets & SPA     │  │   MediaPipe Binaries  │  │
│   │   (/dist/index.html & js) │  │   (/public/wasm/*.wasm)│ │
│   └─────────────┬─────────────┘  └───────────────────────┘  │
└─────────────────┼───────────────────────────────────────────┘
                  │
        /api/* Rewrites
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│        Vercel Serverless Function (api/index.ts)            │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Express App Handler (resilient middleware & routes) │   │
│   │   - GET  /api/health                                │   │
│   │   - POST /api/translate-gesture                     │   │
│   │   - POST /api/translate-video                       │   │
│   └───────────────────────┬─────────────────────────────┘   │
│                           │                                 │
│             ┌─────────────┴─────────────┐                   │
│             ▼                           ▼                   │
│   ┌───────────────────┐       ┌───────────────────┐         │
│   │  @google/genai    │       │ 21-Landmark Rule  │         │
│   │  Gemini 3.1 Flash │       │ Resilient Engine  │         │
│   │  (Cloud Vision)   │       │ (Offline Fallback)│         │
│   └───────────────────┘       └───────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Component & File Mapping

1. **`vercel.json`**:
   - Configures build command (`vite build`) and output directory (`dist`).
   - Defines route rewrites directing `/api/(.*)` to `/api/index.ts` and fallback to `/index.html` for client-side routing.
   - Configures custom headers for `/wasm/(.*)` to enforce `Content-Type: application/wasm` and CORS headers.
2. **`api/index.ts`**:
   - Modular serverless entry that imports and re-uses Express application logic.
   - Configures body size limits (35MB for frame collections).
   - Exports the Express request handler for `@vercel/node`.
3. **`package.json` updates**:
   - Ensures `"build": "vite build"` builds clean production bundles.
   - Adds `@vercel/node` type definitions if needed.
4. **`DEPLOYMENT.md`**:
   - Step-by-step GitHub repository creation, Vercel import instructions, environment variable setup (`GEMINI_API_KEY`), and deployment validation checklist.
