# Deploying the DLMSF Node API to Vercel

## Vercel project

Create a separate Vercel project named `dlmsf-api` from the `dsaldariega/dlmsf-app` Git repository.

- Root Directory: `backend`
- Framework Preset: Other
- Function Region: `sin1` (Singapore)
- Production Branch: `feat/node-api-integration` while validating this pull request; change to `main` after it is merged

The catch-all function in `api/[...path].ts` forwards `/api/*` requests to the Express app.

## Backend environment variables

Add these in the `dlmsf-api` Vercel project for Production, Preview, and Development:

- `SUPABASE_URL`: the same Supabase project URL used by the frontend
- `SUPABASE_ANON_KEY`: the Supabase anon/publishable key used by the frontend (never use a service-role key here)
- `FRONTEND_URL`: `https://dlmsf-app.vercel.app`
- `NODE_ENV`: `production`

Do not commit secrets or paste them into GitHub. Add them directly in Vercel Project Settings → Environment Variables.

## Frontend environment variable

In the existing `dlmsf-app` Vercel project, add `NEXT_PUBLIC_API_URL` with the deployed API origin, for example `https://dlmsf-api.vercel.app` (use the actual domain assigned by Vercel). Apply it to Production, Preview, and Development as appropriate, then redeploy the frontend.

The frontend's shared `frontend/lib/api.ts` client prefixes each endpoint with `NEXT_PUBLIC_API_URL`, obtains the current Supabase access token, and sends it as `Authorization: Bearer ...`. Frontend CRUD pages should call this client rather than querying the database directly.

## Smoke test

Open `https://<actual-api-domain>/api/health`. It should return a JSON success envelope. Authenticated endpoints should then be tested from the frontend after signing in.
