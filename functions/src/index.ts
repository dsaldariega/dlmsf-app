import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

type CallableAuth = {
  uid: string;
  email: string;
  emailVerified: boolean;
};

function requireAuth(request: {
  auth?: { uid: string; token: Record<string, unknown> } | null;
}): CallableAuth {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in before continuing.");
  }

  const email = request.auth.token.email;
  const emailVerified = request.auth.token.email_verified;

  if (typeof email !== "string" || !email.trim()) {
    throw new HttpsError("failed-precondition", "Your Google account must have an email address.");
  }

  return {
    uid: request.auth.uid,
    email: email.trim().toLowerCase(),
    emailVerified: emailVerified === true,
  };
}

async function requireActiveInstance() {
  const snapshot = await db.doc("system/config").get();

  if (!snapshot.exists) {
    throw new HttpsError("failed-precondition", "This DLMSF instance has not been initialized.");
  }

  const config = snapshot.data();
  if (
    !config ||
    typeof config.instanceId !== "string" ||
    config.status !== "active" ||
    typeof config.maintainingAdminUid !== "string" ||
    !config.maintainingAdminUid
  ) {
    throw new HttpsError("failed-precondition", "The DLMSF instance configuration is invalid or suspended.");
  }

  return config;
}

async function requireMaintainingAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> } | null;
}) {
  const identity = requireAuth(request);
  const config = await requireActiveInstance();

  if (identity.uid !== config.maintainingAdminUid) {
    throw new HttpsError("permission-denied", "Only the maintaining admin can manage member invitations.");
  }

  return identity;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpsError("invalid-argument", `A valid ${field} is required.`);
  }
  return value.trim();
}

/**
 * Creates a pending invitation for an existing, active member.
 * The invitation email is read from the member record, not supplied by the
 * caller, so the client cannot redirect an invitation to another address.
 */
export const createMemberInvitation = onCall(async (request) => {
  const admin = await requireMaintainingAdmin(request);
  const memberId = requireString(request.data?.memberId, "memberId");
  const memberRef = db.doc(`members/${memberId}`);
  const memberSnapshot = await memberRef.get();

  if (!memberSnapshot.exists) {
    throw new HttpsError("not-found", "The selected DLMSF member does not exist.");
  }

  const member = memberSnapshot.data();
  if (
    !member ||
    member.memberId !== memberId ||
    member.role !== "member" ||
    member.isActive !== true ||
    typeof member.email !== "string" ||
    !member.email.trim()
  ) {
    throw new HttpsError("failed-precondition", "The member must have a valid email and an active member profile.");
  }

  if (member.authUid) {
    throw new HttpsError("already-exists", "This member is already linked to a Google account.");
  }

  const email = member.email.trim().toLowerCase();
  const existing = await db.collection("invitations")
    .where("memberId", "==", memberId)
    .where("status", "==", "pending")
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new HttpsError("already-exists", "This member already has a pending invitation.");
  }

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + INVITATION_LIFETIME_MS);
  const invitationRef = db.collection("invitations").doc();

  await invitationRef.create({
    invitationId: invitationRef.id,
    memberId,
    email,
    status: "pending",
    createdBy: admin.uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  return {
    invitationId: invitationRef.id,
    memberId,
    email,
    expiresAt: expiresAt.toDate().toISOString(),
  };
});

/**
 * Accepts an invitation only when the signed-in Firebase account has a
 * verified email matching the invitation. UID/member links are written only
 * by this trusted callable function using the Admin SDK.
 */
export const acceptMemberInvitation = onCall(async (request) => {
  const identity = requireAuth(request);

  if (!identity.emailVerified) {
    throw new HttpsError("failed-precondition", "Verify your Google account email before accepting an invitation.");
  }

  const invitationId = requireString(request.data?.invitationId, "invitationId");
  const invitationRef = db.doc(`invitations/${invitationId}`);
  const memberAccountRef = db.doc(`memberAccounts/${identity.uid}`);

  return db.runTransaction(async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);

    if (!invitationSnapshot.exists) {
      throw new HttpsError("not-found", "This invitation does not exist.");
    }

    const invitation = invitationSnapshot.data();
    if (!invitation || invitation.status !== "pending") {
      throw new HttpsError("failed-precondition", "This invitation is no longer pending.");
    }

    if (
      typeof invitation.email !== "string" ||
      invitation.email.trim().toLowerCase() !== identity.email
    ) {
      throw new HttpsError("permission-denied", "This invitation belongs to a different Google account.");
    }

    if (
      !(invitation.expiresAt instanceof Timestamp) ||
      invitation.expiresAt.toMillis() <= Date.now()
    ) {
      throw new HttpsError("deadline-exceeded", "This invitation has expired. Ask the maintaining admin for a new one.");
    }

    const memberId = requireString(invitation.memberId, "invited memberId");
    const memberRef = db.doc(`members/${memberId}`);
    const [memberSnapshot, accountSnapshot] = await Promise.all([
      transaction.get(memberRef),
      transaction.get(memberAccountRef),
    ]);

    if (!memberSnapshot.exists) {
      throw new HttpsError("not-found", "The invited DLMSF member record no longer exists.");
    }

    const member = memberSnapshot.data();
    if (
      !member ||
      member.memberId !== memberId ||
      member.role !== "member" ||
      member.isActive !== true ||
      typeof member.email !== "string" ||
      member.email.trim().toLowerCase() !== identity.email
    ) {
      throw new HttpsError("failed-precondition", "The invited member record is inactive or no longer matches this email.");
    }

    if (member.authUid && member.authUid !== identity.uid) {
      throw new HttpsError("already-exists", "This DLMSF member is already linked to another Google account.");
    }

    if (accountSnapshot.exists) {
      const existingAccount = accountSnapshot.data();
      if (existingAccount?.memberId !== memberId || existingAccount?.status !== "active") {
        throw new HttpsError("already-exists", "This Google account is already linked to a different DLMSF member.");
      }
    }

    transaction.update(invitationRef, {
      status: "accepted",
      acceptedBy: identity.uid,
      acceptedAt: FieldValue.serverTimestamp(),
    });

    transaction.update(memberRef, {
      authUid: identity.uid,
    });

    transaction.set(memberAccountRef, {
      memberId,
      status: "active",
      linkedAt: FieldValue.serverTimestamp(),
    });

    return {
      memberId,
      status: "accepted",
    };
  });
});

/** Revokes a pending invitation; only the maintaining admin may do this. */
export const revokeMemberInvitation = onCall(async (request) => {
  const admin = await requireMaintainingAdmin(request);
  const invitationId = requireString(request.data?.invitationId, "invitationId");
  const invitationRef = db.doc(`invitations/${invitationId}`);
  const snapshot = await invitationRef.get();

  if (!snapshot.exists) {
    throw new HttpsError("not-found", "This invitation does not exist.");
  }

  if (snapshot.data()?.status !== "pending") {
    throw new HttpsError("failed-precondition", "Only pending invitations can be revoked.");
  }

  await invitationRef.update({
    status: "revoked",
    revokedBy: admin.uid,
    revokedAt: FieldValue.serverTimestamp(),
  });

  return { invitationId, status: "revoked" };
});
