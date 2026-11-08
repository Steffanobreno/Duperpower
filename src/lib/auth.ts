import "server-only";
import { regionOf, type Region } from "./region";
import { setRegion } from "./region-store";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS, type Permission, type Role } from "./permissions";
import { createBusiness } from "./new-business";
import { recordTermsAcceptance } from "./data/terms";
import { fromAcceptLanguage, isLang, type Lang } from "./i18n";

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "wds_session";
const SESSION_DAYS = 60;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function verifyPassword(password: string, stored: string) {
  const [scheme, saltB64, keyB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const key = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(key, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`insert into sessions (user_id, token_hash, expires_at)
            values (${userId}, ${hashToken(token)}, ${expires})`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Too many wrong passwords for this email lately. */
export async function loginLocked(email: string) {
  const [r] = await sql`select count(*)::int as n from login_failures
                        where email = ${email.trim().toLowerCase()} and at > now() - interval '15 minutes'`;
  return r.n >= 8;
}

/** Returns true when the email and password match a user, and logs them in. */
export async function login(email: string, password: string) {
  const address = email.trim().toLowerCase();
  const [user] = await sql`select id, password_hash from users where email = ${address}`;
  // Hash anyway when the user does not exist so timing does not reveal valid emails.
  const ok = user
    ? await verifyPassword(password, user.password_hash)
    : (await hashPassword(password), false);
  if (!ok) {
    await sql`insert into login_failures (email) values (${address})`;
    await sql`delete from login_failures where at < now() - interval '1 day'`;
    return false;
  }
  await sql`delete from login_failures where email = ${address}`;
  await startSession(user.id);
  return true;
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await sql`delete from sessions where token_hash = ${hashToken(token)}`;
  jar.delete(COOKIE);
}

/** First run only: creates the owner's login and links it to the owner staff row. */
export async function createOwner(email: string, password: string) {
  const [{ count }] = await sql`select count(*)::int as count from users`;
  if (count > 0) throw new Error("An owner account already exists.");
  const [user] = await sql`insert into users (email, password_hash)
    values (${email.trim().toLowerCase()}, ${await hashPassword(password)}) returning id`;
  await sql`update staff set user_id = ${user.id}
            where id = (select id from staff where role = 'owner' and user_id is null order by created_at limit 1)`;
  await startSession(user.id);
}

/** A unique booking link name from the business name: "Happy Paws" → "happy-paws" (or "happy-paws-2"). */
async function freeSlug(name: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 40) || "groomer";
  const taken = new Set((await sql<{ s: string }[]>`
    select booking_slug as s from businesses where booking_slug = ${base} or booking_slug like ${base + "-%"}`).map((r) => r.s));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

/**
 * Signup from the sales page: a new business with its owner login, ready to book (services,
 * hours, messages and agreement from the starter set), and the owner logged in.
 * Returns an error message, or null when done.
 */
export async function signUpBusiness(input: { businessName: string; ownerName: string; email: string; password: string;
  phone: string | null; zip: string | null; timezone: string; country?: string; currency?: string; source?: string | null; lang?: Lang; metric?: boolean;
  /** Where the Terms were accepted from (the box on the signup form). */ termsIp?: string | null }) {
  const email = input.email.trim().toLowerCase();
  const [exists] = await sql`select 1 from users where email = ${email}`;
  if (exists) return "There's already an account with that email. Log in instead.";
  const slug = await freeSlug(input.businessName);
  const hash = await hashPassword(input.password);
  const userId = await sql.begin(async (tx) => {
    const [user] = await tx`insert into users (email, password_hash) values (${email}, ${hash}) returning id`;
    const { businessId } = await createBusiness(tx, {
      name: input.businessName.trim(), phone: input.phone, slug, timezone: input.timezone, zip: input.zip,
      country: input.country, currency: input.currency, source: input.source ?? null,
      lang: input.lang, metric: input.metric, needsSetup: true,
      ownerName: input.ownerName.trim(), ownerUserId: user.id,
    });
    await recordTermsAcceptance(tx, { businessId, userId: user.id, context: "signup", ip: input.termsIp ?? null });
    return user.id as string;
  });
  await startSession(userId);
  return null;
}

export async function hasAnyUser() {
  const [{ count }] = await sql`select count(*)::int as count from users`;
  return count > 0;
}

export type StaffContext = {
  staffId: string;
  staffName: string;
  businessId: string;
  businessName: string;
  businessPhone: string | null;
  timezone: string;
  bookingSlug: string;
  role: Role;
  /** What this person may do (the owner: everything). */
  can: Record<Permission, boolean>;
  /** The language they see the app in: the one they picked, else their phone's. */
  lang: Lang;
  /** Whether they picked it (false: it follows the phone). */
  langPicked: boolean;
  /** The business's country and currency, with this person's language (for money and dates). */
  region: Region;
};

/** The logged-in staff member, or null. Cached per request. */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await sql`
    select s.id as staff_id, s.name as staff_name, s.role, s.language, b.id as business_id, b.name as business_name,
           b.phone as business_phone, b.timezone, b.booking_slug, b.roles_seeded, b.country, b.currency, b.size_by, b.length_unit, b.weight_unit,
           (b.last_active_at is null or b.last_active_at < now() - interval '1 hour') as stale,
           -- In the same trip: what this role may do (the owner may do everything).
           array(select rp.perm from role_permissions rp where rp.business_id = b.id and rp.role = s.role) as perms
    from sessions se
    join staff s on s.user_id = se.user_id and s.active
    join businesses b on b.id = s.business_id
    where se.token_hash = ${hashToken(token)} and se.expires_at > now()`;
  if (!row) return null;
  // For the app owner's dashboard: when the business last used the app (at most once an hour).
  if (row.stale) await sql`update businesses set last_active_at = now() where id = ${row.business_id}`.catch(() => null);
  let perms = row.perms as string[];
  if (!row.roles_seeded) {
    await seedRoles(row.business_id);
    perms = (await sql`select perm from role_permissions where business_id = ${row.business_id} and role = ${row.role}`).map((r) => r.perm as string);
  }
  const allowed = row.role === "owner" ? new Set<string>(ALL_PERMISSIONS) : new Set(perms);
  const langPicked = isLang(row.language);
  const lang = langPicked ? (row.language as Lang) : fromAcceptLanguage((await headers()).get("accept-language"));
  const region = regionOf(row.country, row.currency, lang, row);
  setRegion(region);
  return {
    staffId: row.staff_id,
    staffName: row.staff_name,
    businessId: row.business_id,
    businessName: row.business_name,
    businessPhone: row.business_phone,
    timezone: row.timezone,
    bookingSlug: row.booking_slug,
    role: row.role,
    can: Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, allowed.has(p)])) as Record<Permission, boolean>,
    lang,
    langPicked,
    region,
  };
});

async function seedRoles(businessId: string) {
  await sql.begin(async (tx) => {
    const [b] = await tx`update businesses set roles_seeded = true where id = ${businessId} and not roles_seeded returning id`;
    if (!b) return;
    for (const [role, perms] of Object.entries(DEFAULT_PERMISSIONS)) {
      for (const perm of perms) {
        await tx`insert into role_permissions (business_id, role, perm) values (${businessId}, ${role}, ${perm}) on conflict do nothing`;
      }
    }
  });
}

/**
 * Like requireStaff, for pages and actions that need a permission. Without it, the person
 * lands on Today with a note.
 */
export async function requirePermission(perm: Permission): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!staff.can[perm]) redirect("/today?denied=1");
  return staff;
}

/** Every owner page and action calls this first. All queries then filter by businessId. */
export async function requireStaff(): Promise<StaffContext> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  return staff;
}

/** The app's own admins (ADMIN_EMAILS, comma separated, in the server settings). */
const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

/** Whether this staff member is one of the app's own admins. */
export async function isAdmin(staffId: string) {
  const list = adminEmails();
  if (!list.length) return false;
  return list.includes(((await accountEmail(staffId)) ?? "").toLowerCase());
}

/** The app owner's dashboard: only people whose login email is in ADMIN_EMAILS. Others get a 404. */
export async function requireAdmin(): Promise<StaffContext & { email: string }> {
  const staff = await getStaff();
  if (!staff) redirect("/login");
  const email = ((await accountEmail(staff.staffId)) ?? "").toLowerCase();
  if (!email || !adminEmails().includes(email)) notFound();
  return { ...staff, email };
}

/** The login email of the logged-in staff member. */
export async function accountEmail(staffId: string) {
  const [r] = await sql`select u.email from staff s join users u on u.id = s.user_id where s.id = ${staffId}`;
  return (r?.email as string | undefined) ?? null;
}

/** Changes the login email; false when another login already uses it. */
export async function changeEmail(staffId: string, email: string) {
  const address = email.trim().toLowerCase();
  const [taken] = await sql`select 1 from users u where u.email = ${address}
                            and u.id <> (select user_id from staff where id = ${staffId})`;
  if (taken) return false;
  await sql`update users set email = ${address}, updated_at = now()
            where id = (select user_id from staff where id = ${staffId})`;
  return true;
}

/**
 * Changes the password after checking the current one, and logs out every other device.
 * Returns false when the current password is wrong.
 */
export async function changePassword(staffId: string, current: string, next: string) {
  const [user] = await sql`select u.id, u.password_hash from staff s join users u on u.id = s.user_id where s.id = ${staffId}`;
  if (!user || !(await verifyPassword(current, user.password_hash))) return false;
  await sql`update users set password_hash = ${await hashPassword(next)}, updated_at = now() where id = ${user.id}`;
  const token = (await cookies()).get(COOKIE)?.value;
  await sql`delete from sessions where user_id = ${user.id} and token_hash <> ${token ? hashToken(token) : ""}`;
  return true;
}

const RESET_MINUTES = 60;

/**
 * "Forgot your password?": a one-time link for this email, or null when no account has it (the
 * page says the same thing either way) or 3 links were already sent in the last hour.
 */
export async function createPasswordReset(email: string) {
  const address = email.trim().toLowerCase();
  const [user] = await sql<{ id: string; language: string | null }[]>`
    select u.id, (select s.language from staff s where s.user_id = u.id order by s.created_at limit 1) as language
    from users u where u.email = ${address}`;
  if (!user) return null;
  const [{ n }] = await sql`select count(*)::int as n from password_resets where user_id = ${user.id} and created_at > now() - interval '1 hour'`;
  if (n >= 3) return null;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into password_resets (user_id, token_hash, expires_at)
            values (${user.id}, ${hashToken(token)}, now() + make_interval(mins => ${RESET_MINUTES}))`;
  return { token, language: user.language };
}

/** Whether this reset link can still be used (not used, not expired). */
export async function resetLinkOk(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const [r] = await sql`select 1 from password_resets where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()`;
  return !!r;
}

/**
 * Sets the new password from a reset link: the link is spent, every other link and every
 * session of that login ends (whoever had the old password is out), and this device logs in.
 */
export async function resetPassword(token: string, password: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const hash = await hashPassword(password);
  const userId = await sql.begin(async (tx) => {
    const [r] = await tx<{ user_id: string }[]>`
      update password_resets set used_at = now()
      where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
      returning user_id`;
    if (!r) return null;
    await tx`update users set password_hash = ${hash}, updated_at = now() where id = ${r.user_id}`;
    await tx`update password_resets set used_at = coalesce(used_at, now()) where user_id = ${r.user_id}`;
    await tx`delete from sessions where user_id = ${r.user_id}`;
    await tx`delete from login_failures where email = (select email from users where id = ${r.user_id})`;
    return r.user_id;
  });
  if (!userId) return false;
  await startSession(userId);
  return true;
}

/** Logs out every device except this one. */
export async function logoutOthers(staffId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  await sql`delete from sessions where user_id = (select user_id from staff where id = ${staffId})
            and token_hash <> ${token ? hashToken(token) : ""}`;
}

/** Gives a team member a login (or a new password). False when another login uses that email. */
export async function setStaffLogin(businessId: string, staffId: string, email: string, password: string) {
  const address = email.trim().toLowerCase();
  return sql.begin(async (tx) => {
    const [s] = await tx`select user_id from staff where id = ${staffId} and business_id = ${businessId}`;
    if (!s) return false;
    const [taken] = await tx`select id from users where email = ${address} and id is distinct from ${s.user_id}`;
    if (taken) return false;
    const hash = await hashPassword(password);
    if (s.user_id) {
      await tx`update users set email = ${address}, password_hash = ${hash}, updated_at = now() where id = ${s.user_id}`;
      await tx`delete from sessions where user_id = ${s.user_id}`;
    } else {
      const [u] = await tx`insert into users (email, password_hash) values (${address}, ${hash}) returning id`;
      await tx`update staff set user_id = ${u.id} where id = ${staffId}`;
    }
    return true;
  });
}

/** Takes a team member's login away (they are logged out everywhere). */
export async function removeStaffLogin(businessId: string, staffId: string) {
  await sql.begin(async (tx) => {
    const [s] = await tx`select user_id from staff where id = ${staffId} and business_id = ${businessId} and role <> 'owner'`;
    if (!s?.user_id) return;
    await tx`update staff set user_id = null where id = ${staffId}`;
    await tx`delete from users where id = ${s.user_id}`;
  });
}

/** Sets (or, with null, removes) the app lock PIN of a team member. */
export async function setPin(staffId: string, pin: string | null) {
  await sql`update staff set pin_hash = ${pin ? await hashPassword(pin) : null}, pin_failures = 0 where id = ${staffId}`;
}

/**
 * Checks the app lock PIN. After 5 wrong tries in a row the person is logged out of this
 * device, so a found phone can't be opened by guessing.
 */
export async function checkPin(staffId: string, pin: string): Promise<"ok" | "wrong" | "logged-out"> {
  const [s] = await sql`select pin_hash, pin_failures from staff where id = ${staffId}`;
  if (!s?.pin_hash) return "ok";
  if (await verifyPassword(pin, s.pin_hash)) {
    await sql`update staff set pin_failures = 0 where id = ${staffId}`;
    return "ok";
  }
  const [r] = await sql`update staff set pin_failures = pin_failures + 1 where id = ${staffId} returning pin_failures`;
  if (r.pin_failures >= 5) {
    await sql`update staff set pin_failures = 0 where id = ${staffId}`;
    await logout();
    return "logged-out";
  }
  return "wrong";
}
