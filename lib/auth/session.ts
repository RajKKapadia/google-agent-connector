import { createHmac } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { adminSessions } from "@/lib/db/schema";

const SESSION_COOKIE_NAME = "ces_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getSessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is required");
  }

  return secret;
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function serializeCookieValue(sessionId: string, expiresAt: Date) {
  const payload = `${sessionId}.${expiresAt.getTime()}`;
  return `${payload}.${signValue(payload)}`;
}

function parseCookieValue(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length < 3) return null;

  const signature = parts.pop();
  const expiresAtRaw = parts.pop();
  const sessionId = parts.join(".");

  if (!signature || !expiresAtRaw || !sessionId) return null;

  const payload = `${sessionId}.${expiresAtRaw}`;
  if (signValue(payload) !== signature) return null;

  const expiresAt = new Date(Number(expiresAtRaw));
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return null;

  return { sessionId, expiresAt };
}

export async function hasAdminUser() {
  const adminUser = await db.query.adminUsers.findFirst({
    columns: { id: true },
  });

  return Boolean(adminUser);
}

export async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, serializeCookieValue(sessionId, expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function createAdminSession(adminUserId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [session] = await db
    .insert(adminSessions)
    .values({
      adminUserId,
      expiresAt,
      updatedAt: new Date(),
    })
    .returning();

  await setSessionCookie(session.id, expiresAt);

  return session;
}

export async function getCurrentAdmin() {
  const cookieStore = await cookies();
  const parsed = parseCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!parsed) return null;

  const session = await db.query.adminSessions.findFirst({
    where: and(
      eq(adminSessions.id, parsed.sessionId),
      gt(adminSessions.expiresAt, new Date())
    ),
    with: {
      adminUser: true,
    },
  });

  if (!session) {
    await clearSessionCookie();
    return null;
  }

  return session.adminUser;
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function destroyCurrentAdminSession() {
  const cookieStore = await cookies();
  const parsed = parseCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (parsed) {
    await db.delete(adminSessions).where(eq(adminSessions.id, parsed.sessionId));
  }

  await clearSessionCookie();
}

export async function redirectForBootstrapState() {
  const setupComplete = await hasAdminUser();
  if (!setupComplete) {
    redirect("/setup");
  }

  const admin = await getCurrentAdmin();
  if (!admin) {
    redirect("/login");
  }

  redirect("/dashboard");
}
