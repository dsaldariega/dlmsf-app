# DLMSF Mobile

The DLMSF mobile client is built with React Native, Expo, and TypeScript. It lives in this repository alongside the existing Next.js frontend and Express API.

## Platform targets

- Android 10 (API 29) and newer
- iOS 15.1 and newer
- Android is the initial development and testing priority

The Android minimum is intentionally set to API 29. Expo SDK 58 supports older Android versions by default, but DLMSF's configured minimum is Android 10 to match the project's device-support requirement.

## Requirements

- Node.js 22.13 or newer
- npm
- Expo-compatible Android tooling or a physical Android device
- An Apple development environment for local iOS builds

## Install and run

From the repository root:

```sh
npm --prefix mobile install
npm --prefix mobile start
```

Or run the platform-specific Expo commands:

```sh
npm --prefix mobile run android
npm --prefix mobile run ios
```

Run the TypeScript check:

```sh
npm --prefix mobile run typecheck
```

## Builds

EAS Build profiles are defined in `eas.json`. Configure the Expo/EAS project and application signing credentials before creating distributable builds.

## Architecture

The mobile app is a separate client, not a replacement for the web application.

- `frontend/` remains the Next.js web client.
- `mobile/` contains the Expo React Native client.
- `backend/` remains the shared Express API and business-logic layer.
- `supabase/` remains the shared database and migration source.

The mobile app must use the existing backend API for DLMSF business operations. Do not embed Supabase service-role credentials or duplicate privileged business logic in the client.

## Development scope

The current commit establishes the Expo project foundation and a temporary launch screen. Authentication, API integration, role-based navigation, and member/administrator workflows will be implemented incrementally on the dedicated `mobile` branch.
