import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  users,
  sessions,
  organizations,
  workspaces,
  apiKeys,
  type User,
  type Workspace,
  type Organization,
} from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./password";

const SESSION_COOKIE_NAME = "relay_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "relay_secure_session_secret_2026";

/**
 * Sign session ID using HMAC-SHA256
 */
function signToken(sessionId: string): string {
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionId)
    .digest("hex");
  return `${sessionId}.${signature}`;
}

/**
 * Verify and unpack signed session ID
 */
function verifyToken(signedToken: string): string | null {
  const parts = signedToken.split(".");
  if (parts.length !== 2) return null;
  const [sessionId, signature] = parts;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(sessionId)
    .digest("hex");

  if (
    signature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    return null;
  }
  return sessionId;
}

export interface SessionContext {
  session: {
    id: string;
    isAnonymous: boolean;
    expiresAt: Date;
  };
  user: User | null;
  workspace: Workspace;
  organization: Organization | null;
}

/**
 * Get current session and active workspace from cookie
 */
export async function getSession(): Promise<SessionContext | null> {
  const cookieStore = cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!signedToken) return null;

  const sessionId = verifyToken(signedToken);
  if (!sessionId) return null;

  const now = new Date();

  // Find active session
  const [sessionRecord] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!sessionRecord) return null;

  // Find workspace
  const [workspaceRecord] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, sessionRecord.workspaceId))
    .limit(1);

  if (!workspaceRecord) return null;

  // Find user if non-anonymous
  let userRecord: User | null = null;
  if (sessionRecord.userId) {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.id, sessionRecord.userId))
      .limit(1);
    userRecord = u || null;
  }

  // Find organization if attached
  let orgRecord: Organization | null = null;
  if (workspaceRecord.orgId) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, workspaceRecord.orgId))
      .limit(1);
    orgRecord = org || null;
  }

  return {
    session: {
      id: sessionRecord.id,
      isAnonymous: sessionRecord.isAnonymous,
      expiresAt: sessionRecord.expiresAt,
    },
    user: userRecord,
    workspace: workspaceRecord,
    organization: orgRecord,
  };
}

/**
 * Set HTTP-only signed session cookie
 */
export function setSessionCookie(sessionId: string, expiresAt: Date) {
  const signedToken = signToken(sessionId);
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Clear session cookie
 */
export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Sign up a new developer
 */
export async function registerDeveloper(params: {
  name: string;
  email: string;
  password: string;
  company: string;
  role: "Backend dev" | "Mobile dev" | "Data/CDP" | "Other";
  intent: "Evaluating Relay" | "Already a Relay customer";
}): Promise<SessionContext> {
  const normalizedEmail = params.email.trim().toLowerCase();

  // Check if email already registered
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingUser) {
    throw new Error("An account with this email address already exists.");
  }

  const passwordHash = await hashPassword(params.password);
  const userId = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const orgId = `org_${crypto.randomBytes(8).toString("hex")}`;
  const workspaceId = `ws_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date();

  // 1. Create Organization
  const companySlug = params.company
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const orgSlug = `${companySlug || "org"}-${crypto.randomBytes(3).toString("hex")}`;

  await db.insert(organizations).values({
    id: orgId,
    name: params.company,
    legalName: `${params.company} Private Limited`,
    slug: orgSlug,
    industry: "Fintech",
    city: "Bengaluru",
    status: "active",
    planId: "plan_starter",
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create Workspace
  await db.insert(workspaces).values({
    id: workspaceId,
    orgId: orgId,
    organizationId: orgId,
    name: `${params.company} Sandbox`,
    slug: `${companySlug || "workspace"}-sandbox`,
    status: "active",
    kycStatus: "not_started", // kyc_pending by default
    senderIds: JSON.stringify(["RELAYI"]),
    planTier: "sandbox",
    rateLimitPerMin: 60,
    monthlyQuota: 10000,
    walletBalance: 0,
    isAnonymous: false,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Create User
  await db.insert(users).values({
    id: userId,
    name: params.name,
    email: normalizedEmail,
    passwordHash: passwordHash,
    company: params.company,
    role: params.role,
    intent: params.intent,
    createdAt: now,
  });

  // 4. Create default Test API Key
  const testKeyRaw = `rk_test_${crypto.randomBytes(16).toString("hex")}`;
  const testKeyHash = crypto.createHash("sha256").update(testKeyRaw).digest("hex");
  const maskedKey = `rk_test_${"•".repeat(16)}${testKeyRaw.slice(-4)}`;

  await db.insert(apiKeys).values({
    id: `key_test_${crypto.randomBytes(8).toString("hex")}`,
    workspaceId: workspaceId,
    name: "Default Test API Key",
    prefix: "rk_test_",
    hashedSecret: testKeyHash,
    secretMasked: maskedKey,
    fullKeyForDev: testKeyRaw,
    environment: "test",
    scopes: JSON.stringify(["messages:send", "events:write", "profiles:read"]),
    status: "active",
    createdAt: now,
    createdBy: userId,
  });

  // 5. Create Session (30 days validity)
  const sessionId = `ses_${crypto.randomBytes(24).toString("hex")}`;
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: userId,
    workspaceId: workspaceId,
    isAnonymous: false,
    expiresAt: sessionExpiresAt,
    createdAt: now,
  });

  setSessionCookie(sessionId, sessionExpiresAt);

  const session = await getSession();
  if (!session) throw new Error("Failed to initialize user session");
  return session;
}

/**
 * Sign in existing developer
 */
export async function authenticateDeveloper(
  email: string,
  password: string
): Promise<SessionContext> {
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error("Invalid email or password.");
  }

  // Find primary workspace for user's organization
  // Find organizations matching user's company or user session history
  let [workspace] = await db
    .select()
    .from(workspaces)
    .limit(1);

  // If user has existing session, use that workspace
  const [existingSession] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, user.id))
    .limit(1);

  if (existingSession) {
    const [ws] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, existingSession.workspaceId))
      .limit(1);
    if (ws) workspace = ws;
  }

  if (!workspace) {
    throw new Error("No active workspace found for this account.");
  }

  // Create new session
  const sessionId = `ses_${crypto.randomBytes(24).toString("hex")}`;
  const sessionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    workspaceId: workspace.id,
    isAnonymous: false,
    expiresAt: sessionExpiresAt,
    createdAt: new Date(),
  });

  setSessionCookie(sessionId, sessionExpiresAt);

  const session = await getSession();
  if (!session) throw new Error("Failed to initialize user session");
  return session;
}

/**
 * "Try without signing up"
 * Creates an anonymous, time-limited (24h) evaluation workspace with a sandbox key
 */
export async function createAnonymousEvaluationWorkspace(): Promise<SessionContext> {
  const randomHex = crypto.randomBytes(4).toString("hex");
  const orgId = `org_eval_${randomHex}`;
  const workspaceId = `ws_eval_${randomHex}`;
  const now = new Date();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // 1. Create Evaluation Organization
  await db.insert(organizations).values({
    id: orgId,
    name: `Sandbox Evaluation (${randomHex})`,
    legalName: `Sandbox Evaluation (${randomHex})`,
    slug: `eval-${randomHex}`,
    industry: "Fintech",
    city: "Bengaluru",
    status: "active",
    planId: "plan_starter",
    createdAt: now,
    updatedAt: now,
  });

  // 2. Create 24h Evaluation Workspace
  await db.insert(workspaces).values({
    id: workspaceId,
    orgId: orgId,
    organizationId: orgId,
    name: `Evaluation Sandbox (${randomHex})`,
    slug: `eval-sandbox-${randomHex}`,
    status: "active",
    kycStatus: "not_started",
    senderIds: JSON.stringify(["RELAYI"]),
    planTier: "sandbox",
    rateLimitPerMin: 50,
    monthlyQuota: 5000,
    walletBalance: 0,
    isAnonymous: true,
    expiresAt: expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Create Sandbox Key for Evaluation Workspace
  const testKeyRaw = `rk_test_eval_${crypto.randomBytes(12).toString("hex")}`;
  const testKeyHash = crypto.createHash("sha256").update(testKeyRaw).digest("hex");
  const maskedKey = `rk_test_${"•".repeat(16)}${testKeyRaw.slice(-4)}`;

  await db.insert(apiKeys).values({
    id: `key_eval_${randomHex}`,
    workspaceId: workspaceId,
    name: "Evaluation Sandbox Key (24h)",
    prefix: "rk_test_",
    hashedSecret: testKeyHash,
    secretMasked: maskedKey,
    fullKeyForDev: testKeyRaw,
    environment: "test",
    scopes: JSON.stringify(["messages:send", "events:write", "profiles:read"]),
    status: "active",
    expiresAt: expiresAt,
    createdAt: now,
    createdBy: "anonymous_evaluator",
  });

  // 4. Create Anonymous Session (24h)
  const sessionId = `ses_anon_${crypto.randomBytes(20).toString("hex")}`;

  await db.insert(sessions).values({
    id: sessionId,
    userId: null,
    workspaceId: workspaceId,
    isAnonymous: true,
    expiresAt: expiresAt,
    createdAt: now,
  });

  setSessionCookie(sessionId, expiresAt);

  const session = await getSession();
  if (!session) throw new Error("Failed to create evaluation session");
  return session;
}

/**
 * Sign out current session
 */
export async function logoutDeveloper(): Promise<void> {
  const cookieStore = cookies();
  const signedToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (signedToken) {
    const sessionId = verifyToken(signedToken);
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
    }
  }
  clearSessionCookie();
}
