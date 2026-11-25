# DLMSF Firebase Instance Bootstrap

This guide defines trusted first-admin setup and member account linking for one DLMSF instance.

## Security model

- One Firebase project represents one DLMSF instance.
- The developer test instance and custodian production instance must use separate Firebase projects.
- Each instance has exactly one maintaining admin.
- The maintaining admin is identified by the Firebase Authentication UID stored in `system/config`.
- The APK must never create or modify `system/config`, assign the maintaining-admin UID, or grant itself an admin role.
- Firebase client configuration is public configuration, not an authorization credential. Firestore Security Rules and trusted Cloud Functions protect the records.
- Member identities are linked by Firebase Authentication UID, never by matching an email address in the client.

## One-time setup for a new instance

Perform these steps for each Firebase project.

1. Create a Firebase project owned by the person/organization responsible for that DLMSF instance.
2. Register the Android app in that Firebase project. Use the Android package name configured by the DLMSF mobile app. Downloading a new APK for each project is not required once runtime instance configuration is implemented.
3. Enable **Authentication → Sign-in method → Google** and configure the required support email.
4. Create the Cloud Firestore database in production mode.
5. Deploy the repository's `firebase/firestore.rules` rules to this project.
6. Deploy the Cloud Functions in the `functions/` directory. Functions require the Firebase project to be on the Blaze plan and the deploying account to have the required IAM permissions. Do not deploy until billing and the project owner are comfortable with the expected usage.
7. Have the intended maintaining admin complete Google sign-in in the DLMSF app. The test panel displays the Firebase UID.
8. In Firebase Console → Firestore Database → Data, create `system/config` with the required fields below. This console action is trusted provisioning and is intentionally unavailable to the mobile client.

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

Use a different stable `instanceId` for the developer test project and custodian production project. Do not copy production financial records into the developer project.

## Member invitation workflow

The trusted Cloud Functions expose three callable operations:

- `createMemberInvitation({ memberId })`: maintaining admin only. Reads the member's email from the existing member record, requires an active unlinked member, and creates a pending invitation that expires after seven days. It returns the invitation ID and intended email. It does not send an email yet.
- `acceptMemberInvitation({ invitationId })`: requires a signed-in Firebase account with a verified email matching the invitation and the existing member record. The function transactionally updates `members/{memberId}.authUid`, creates `memberAccounts/{authUid}`, and marks the invitation accepted.
- `revokeMemberInvitation({ invitationId })`: maintaining admin only. Revokes a pending invitation.

The mobile client cannot create invitations, accept them by writing Firestore directly, or write UID mappings. These operations must go through the callable functions. The member must first receive the invitation ID through a trusted channel; automated email delivery is a separate future phase.

The Functions verify the maintaining-admin UID against `system/config` on every admin operation. The invitation acceptance function checks the verified Google email, invitation expiry, member status, and existing account links before writing anything.

## Verification checklist

- [ ] The Firebase project is owned by the intended custodian/organization.
- [ ] Google sign-in is enabled and the intended admin has signed in.
- [ ] The UID shown by the app exactly matches `system/config.maintainingAdminUid`.
- [ ] The app displays **MAINTAINING ADMIN VERIFIED** for the intended admin.
- [ ] `system/config.instanceId` identifies the correct instance and status is `active`.
- [ ] Firestore Security Rules and Cloud Functions are deployed.
- [ ] A non-admin cannot create or revoke invitations.
- [ ] A Google account with an unverified or mismatched email cannot accept an invitation.
- [ ] An expired, revoked, or already accepted invitation cannot be reused.
- [ ] A member UID cannot be linked to multiple member records.
- [ ] A client cannot write `members.authUid`, `memberAccounts`, or invitation status directly.
- [ ] Financial writes remain blocked from mobile clients.

## Operational notes

- Cloud Functions use the Firebase Admin SDK and therefore bypass Firestore Security Rules. Every callable operation must enforce authorization and validate its inputs.
- The Functions do not send invitation emails in this phase. The invitation ID must be delivered through a trusted channel until email delivery is implemented.
- Never put a service-account JSON file, Admin SDK private key, provisioning secret, or other server credential in the APK or an `EXPO_PUBLIC_*` variable.
- If the maintaining admin changes, update the UID only through trusted project-owner/Admin SDK access after verifying the new custodian.
- If the instance is compromised or should no longer be used, set `status` to `suspended` through trusted project-owner access.
- The mobile app still uses Supabase for its production DLMSF experience. Firebase authentication and invitation foundations do not switch the active data provider.
