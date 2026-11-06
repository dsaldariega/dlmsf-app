# DLMSF Monitoring App

This repository is a small monorepo containing two separate applications.

## Repository layout

```text
.
├── frontend/          # Next.js web application
├── backend/           # Express + TypeScript API
├── .github/           # CI workflows
├── package.json       # Root scripts for running/building both apps
└── package-lock.json  # Root orchestration dependencies
```

Keep frontend source code inside `frontend/` and backend source code inside `backend/`. Do not add duplicate `app/`, `components/`, or `lib/` directories at the repository root.

## Requirements

- Node.js 22 or later
- npm

## Install

```sh
npm install
npm --prefix frontend ci
npm --prefix backend ci
```

## Run both applications

```sh
npm run dev
```

- Frontend: http://localhost:3000
- Backend health endpoint: http://localhost:4000/api/health

You can also run either app independently:

```sh
npm run dev:frontend
npm run dev:backend
```

## Build

```sh
npm run build
```

## Environment variables

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the Supabase and API values.

Copy `backend/.env-example` to `backend/.env` and fill in the Supabase values.

Never commit real environment files, credentials, or Supabase service-role keys.

## Deployment

Deploy the frontend and backend as separate Vercel projects:

- Frontend project root: `frontend`
- Backend project root: `backend`

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for the API deployment configuration.
