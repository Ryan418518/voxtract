# Voxtract

تطبيق موبايل لتفريغ الملفات الصوتية العربية إلى نص كامل باستخدام Groq Whisper AI.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo dev server
- `pnpm run typecheck` — full typecheck across all packages
- Required env: none (users provide their own API keys in-app)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo (SDK 54) + React Native + Expo Router
- AI: Groq Whisper API (free tier) or OpenAI Whisper
- Storage: AsyncStorage (settings persistence)
- File handling: expo-file-system/legacy, expo-document-picker

## Where things live

- `artifacts/mobile/app/index.tsx` — Main transcription screen
- `artifacts/mobile/app/settings.tsx` — API key & provider settings
- `artifacts/mobile/services/transcription.ts` — Transcription logic with chunking
- `artifacts/mobile/context/AppContext.tsx` — Global settings context
- `artifacts/mobile/constants/colors.ts` — Purple dark/light theme tokens

## Architecture decisions

- Uses Groq Whisper API (free) as the default provider — fastest + Arabic support
- Large files (>20MB) are split into 20MB chunks using `expo-file-system/legacy` byte-range reads, each chunk transcribed separately and concatenated
- `expo-file-system/legacy` is used instead of the new v19 API because `readAsStringAsync` with `position`/`length` for chunking is only available there
- Settings (API key, provider, model) stored via AsyncStorage, loaded on startup

## Product

- Pick any audio file (MP3, WAV, M4A, OGG, FLAC, etc.)
- Transcribes Arabic speech to full text, no truncation
- Handles files up to ~100MB by splitting into 20MB chunks
- Copy or export transcription as a .txt file
- Settings screen to configure Groq/OpenAI/Custom API key and model

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always use `expo-file-system/legacy` (not `expo-file-system`) for the old `cacheDirectory`, `EncodingType`, `readAsStringAsync` etc. — v19 of expo-file-system deprecated all of these and they throw at runtime
- Expo SDK 54 compatible versions: expo-file-system ~19.0.23, expo-document-picker ~14.0.8, expo-clipboard ~8.0.8, expo-sharing ~14.0.8

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
