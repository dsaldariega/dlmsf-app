# DLMSF Firebase Instance Bootstrap

This guide defines the trusted first-admin setup for one DLMSF instance.

## Security model

- One Firebase project represents one DLMSF instance.
- The developer test instance and custodian production instance must use separate Firebase projects.
- Each instance has exactly one maintaining admin.
- The maintaining admin is identified by the Firebase Authentication UID stored in `system/config`.
- The APK must never create or modify `system/config`, assign the maintaining-admin UID, or grant itself an admin role.
- Firebase and Google OAuth client configuration are public identifiers, not authorization credentials. Firestore Security Rules and trusted server-side authorization protect the records.

## One-time setup for a new instance

Perform these steps for each Firebase project.

1. Create a Firebase project owned by the person/organization responsible for that DLMSF instance.
2. Register the Android app in that Firebase project. Use the Android package name configured by the DLMSF mobile app. Downloading a new APK for each project is not required once runtime instance configuration is implemented.
3. Enable **Authentication → Sign-in method → Google** and configure the required support email.
4. Create the Cloud Firestore database in production mode.
5. Deploy the repository's `firebase/firestore.rules` rules to this project.
6. Configure Google OAuth client IDs for the app platform(s). For Android, register the package name and the signing certificate SHA-1 fingerprint(s) used by the APK. Keep client IDs with the Firebase instance configuration; never include a Google client secret in the app.
7. Create the Firestore database and complete the trusted maintaining-admin bootstrap below.
8. Once the Google sign-in flow is integrated, the authorized maintaining admin signs in. During the initial bootstrap milestone, this may require a developer-assisted test build; do not work around this by allowing client-side admin creation.
9. In Firebase Console → Authentication → Users, locate that Google account and copy its Firebase **UID**. Verify the email belongs to the intended custodian/admin.
10. In Firebase Console → Firestore Database → Data, create the `system` collection and its `config` document with the fields below. This console action is trusted project-owner provisioning and is intentionally not available to the mobile client.

## Runtime instance configuration

Each installation stores a DLMSF instance configuration locally. The shape is:

```ts
{
  configVersion: 1,
  instanceId: "dlmsf-custodian-production",
  displayName: "DLMSF Production",
  firebase: {
    apiKey: "FIREBASE_WEB_API_KEY",
    authDomain: "PROJECT_ID.firebaseapp.com",
    projectId: "PROJECT_ID",
    messagingSenderId: "SENDER_ID",
    appId: "FIREBASE_APP_ID"
  },
  googleOAuth: {
    androidClientId: "ANDROID_OAUTH_CLIENT_ID",
    webClientId: "WEB_OAUTH_CLIENT_ID"
  }
}
```

The `googleOAuth` object is optional until Google sign-in is enabled in the mobile app. Supply only the client IDs required by the platform. Client IDs are not secrets; never store client secrets or service-account keys in this configuration.

## Required `system/config` document

Document path: `system/config`

```json
{
  "maintainingAdminUid": "FIREBASE_AUTH_UID_FROM_AUTHENTICATION",
  "instanceId": "dlmsf-custodian-production",
  "schemaVersion": 1,
  "status": "active"
}
```

Field requirements:

| Field | Type | Requirement |
| --- | --- | --- |
| `maintainingAdminUid` | string | Exact Firebase Authentication UID of the one authorized maintaining admin |
| `instanceId` | string | Stable unique identifier for this DLMSF instance |
| `schemaVersion` | number | Start at `1` |
| `status` | string | `active` or `suspended` |

Use a different stable `instanceId` for the developer's test project and the custodian's production project. Do not copy production financial records into the developer project.

## Verification checklist

Before using the instance with real records:

- [ ] The Firebase project is owned by the intended custodian/organization.
- [ ] Google sign-in is enabled and the intended admin has signed in.
- [ ] The UID in `system/config.maintainingAdminUid` exactly matches the admin's Authentication UID.
- [ ] `system/config.instanceId` identifies the correct instance.
- [ ] Firestore Security Rules are deployed.
- [ ] A signed-in account with a different UID cannot read admin-only data or write `system/config`.
- [ ] An unauthenticated client cannot read instance metadata or member/financial records.
- [ ] Financial writes remain blocked from mobile clients; trusted server operations will enforce business rules in a later migration phase.

## Important operational notes

- Selecting or storing a Firebase project configuration on a device does not grant access to that project.
- Never put a service-account JSON file, Firebase Admin SDK private key, Google OAuth client secret, provisioning secret, or other server credential in the APK or an `EXPO_PUBLIC_*` variable.
- Do not let a user claim the first-admin role from the app. The first admin must be provisioned by the Firebase project owner through the trusted console process above. A future secured provisioning service may replace this manual step.
- If the maintaining admin changes, update the UID only through a trusted project-owner/Admin SDK operation after verifying the new custodian. Do not expose this as a normal member-edit action.
- If the instance is compromised or should no longer be used, set `status` to `suspended` through trusted project-owner access. The app must later enforce this status before opening protected screens.
- This is a bootstrap runbook, not an implemented onboarding screen. The current app still uses Supabase; Firebase authentication, runtime instance selection, and enforcement of this document are future migration work.
