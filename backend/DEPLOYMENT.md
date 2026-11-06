# Deploying the DLMSF Node API

The repository is a monorepo with two independent applications:

- `frontend/`: Next.js web application
- `backend/`: Express API

## Vercel backend project

Create or configure a separate Vercel project connected to this repository:

- Project root directory: `backend`
- Framework preset: Other
- Production branch: `dev` while developing this branch; change only when your team promotes the code
- The catch-all function in `api/[...path].ts` forwards API requests to the Express app.

Set these environment variables in the backend Vercel project for the required environments:

- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anon/publishable key (never use a service-role key)
- `FRONTEND_URL`: deployed frontend origin, e.g. `https://dlmsf-app.vercel.app`
- `NODE_ENV`: `production`

Do not commit secrets. Add them in Vercel Project Settings → Environment Variables.

## Vercel frontend project

Configure the existing frontend Vercel project with:

- Project root directory: `frontend`
- Production branch: `dev` while developing this branch
- `NEXT_PUBLIC_API_URL`: deployed backend origin, e.g. `https://dlmsf-api.vercel.app`

Set the variable for Production, Preview, and Development as needed, then redeploy.

The frontend API client in `frontend/lib/api.ts` obtains the current Supabase session token and sends it as a Bearer token to the Node API.

## Local development

From the repository root:

```sh
npm install
npm run dev
```

The root scripts run the frontend and backend concurrently. Each application also has its own package manifest and lockfile.

## Smoke tests

- Backend health: `https://<api-domain>/api/health`
- After signing in, verify authenticated members, loans, payments, dashboard, and audit pages in the frontend.
