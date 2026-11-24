# DLMSF Mobile

Expo + React Native client for the existing DLMSF application.

## Requirements

- Node.js 22.13 or newer
- Android 10+ (API 29+) or iOS 16.4+
- Access to the existing DLMSF Supabase project and Express API

## Setup

From the repository root:

```bash
cd mobile
npm install
```

Create `mobile/.env` using `.env.example` and provide:

- `EXPO_PUBLIC_SUPABASE_URL`: the existing DLMSF Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the existing Supabase anon/public key
- `EXPO_PUBLIC_API_URL`: the existing Express API base URL (currently `https://dlmsf-api.vercel.app`)

Only public client credentials belong in this file. Never add the Supabase service-role key to the mobile app.

## Run

```bash
npm start
npm run android
npm run ios
npm run typecheck
```

## Authentication architecture

- Members sign in with their existing email and password through Supabase Auth.
- The app resolves the account role from `public.members.roles`, linked by `auth_id`, matching the web application's source of truth.
- Supabase sessions are persisted with Expo SecureStore. Values are chunked to avoid the per-item size limits some iOS versions impose.
- Token refresh is enabled while the app is active.
- API requests use the current Supabase access token in the `Authorization: Bearer` header.
- The Express API remains responsible for authorization and all privileged business operations.

The current mobile milestone provides sign-in, session restoration, role verification, sign-out, and a reusable API client. Dashboard and feature screens will be added in later milestones.
