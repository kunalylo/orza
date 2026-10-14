#!/usr/bin/env node
/**
 * Grant or revoke ÖRZA admin access for an existing account.
 *
 *   node scripts/make-admin.mjs person@example.com            grant admin (sub-admin role)
 *   node scripts/make-admin.mjs person@example.com --super    grant admin with the super admin role
 *   node scripts/make-admin.mjs person@example.com --sub      make an existing super admin a sub-admin
 *   node scripts/make-admin.mjs person@example.com --revoke   remove admin access (and the role)
 *   node scripts/make-admin.mjs --list                        list current admins and their roles
 *
 * Roles: a super admin manages the team (adds, resets and removes sub-admins on the admin console's
 * Team page); a sub-admin runs the console (members, credits, credit requests). Admin accounts are
 * staff-only — they see the admin console, never the member app — so grant it to a work account,
 * not to someone's personal ÖRZA account.
 *
 * Admin access is only ever granted here (out-of-band) or by a super admin on the Team page, never
 * from the email address someone signs up with: ÖRZA doesn't verify email ownership, so an address
 * list would let anyone who registers a listed address first become an admin.
 *
 * Uses MONGODB_URI / MONGODB_DB (from the environment, .env.local or .env) when set; otherwise the
 * local development database at .data/orza-db.json. With the file database, stop `npm run dev` first:
 * the dev server keeps that file in memory and would overwrite this change on its next write.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(name) {
  const file = path.join(ROOT, name);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

function usage(code = 1) {
  console.log(
    [
      "Usage:",
      "  node scripts/make-admin.mjs <email>            grant admin access (sub-admin)",
      "  node scripts/make-admin.mjs <email> --super    grant admin access as a super admin",
      "  node scripts/make-admin.mjs <email> --sub      make an existing super admin a sub-admin",
      "  node scripts/make-admin.mjs <email> --revoke   remove admin access",
      "  node scripts/make-admin.mjs --list             list admins and their roles",
    ].join("\n")
  );
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) usage(0);
const list = args.includes("--list");
const revoke = args.includes("--revoke");
const asSuper = args.includes("--super");
const asSub = args.includes("--sub");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
if (!list && !email) usage();
if ([revoke, asSuper, asSub].filter(Boolean).length > 1) {
  console.error("Use only one of --revoke, --super and --sub.");
  process.exit(1);
}
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" doesn't look like an email address.`);
  process.exit(1);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const now = new Date().toISOString();

/** An admin's role; an admin without a stored role is a sub-admin (same rule as src/lib/auth.ts). */
const roleOf = (u) => (u?.is_admin === true ? (u.admin_role === "super" ? "super" : "sub") : null);

/**
 * The role a grant should set. A plain grant makes a sub-admin, but never silently demotes an
 * existing super admin — that needs an explicit --sub.
 */
function targetRole(current) {
  if (asSuper) return "super";
  if (asSub) return "sub";
  return current === "super" ? "super" : "sub";
}

async function withMongo(fn) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  try {
    return await fn(client.db(process.env.MONGODB_DB || "orza").collection("users"));
  } finally {
    await client.close();
  }
}

async function run() {
  const usingMongo = !!process.env.MONGODB_URI;
  const where = usingMongo ? `MongoDB (${process.env.MONGODB_DB || "orza"})` : ".data/orza-db.json";

  if (usingMongo) {
    if (list) {
      const admins = await withMongo((users) =>
        users.find({ is_admin: true }, { projection: { _id: 0, email: 1, name: 1, is_admin: 1, admin_role: 1 } }).toArray()
      );
      return printAdmins(admins, where);
    }
    return withMongo(async (users) => {
      const user = await users.findOne({ email }, { projection: { _id: 0, id: 1, is_admin: 1, admin_role: 1 } });
      if (!user) return notFound(where);
      const before = roleOf(user);
      if (revoke) {
        await users.updateOne({ email }, { $unset: { is_admin: "", admin_role: "" }, $set: { updated_at: now } });
        return done(where, before, null);
      }
      const role = targetRole(before);
      await users.updateOne({ email }, { $set: { is_admin: true, admin_role: role, updated_at: now } });
      return done(where, before, role);
    });
  }

  const file = path.join(ROOT, ".data", "orza-db.json");
  if (!existsSync(file)) {
    console.error(`No local database at ${path.relative(ROOT, file)} yet. Sign up in the app first, then run this again.`);
    process.exit(1);
  }
  const data = JSON.parse(await readFile(file, "utf8"));
  const users = Array.isArray(data.users) ? data.users : [];
  if (list) return printAdmins(users.filter((u) => u.is_admin === true), where);

  const user = users.find((u) => u.email === email);
  if (!user) return notFound(where);
  const before = roleOf(user);
  let after = null;
  if (revoke) {
    delete user.is_admin;
    delete user.admin_role;
  } else {
    after = targetRole(before);
    user.is_admin = true;
    user.admin_role = after;
  }
  user.updated_at = now;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + ".tmp", JSON.stringify(data));
  await rename(file + ".tmp", file);
  done(where, before, after);
  console.log("If the dev server is running, restart it so it reloads the database file.");
}

const ROLE_LABEL = { super: "super admin", sub: "sub-admin" };

function printAdmins(admins, where) {
  if (!admins.length) return console.log(`No admins in ${where}.`);
  const sorted = [...admins].sort((a, b) => (roleOf(a) === roleOf(b) ? 0 : roleOf(a) === "super" ? -1 : 1));
  for (const a of sorted) console.log(`${ROLE_LABEL[roleOf(a)].padEnd(12)} ${a.email}${a.name ? `  (${a.name})` : ""}`);
}

function notFound(where) {
  console.error(`No account with the email ${email} in ${where}. The person needs to sign up first.`);
  process.exit(1);
}

function done(where, before, after) {
  if (!after) {
    console.log(before ? `Removed admin access for ${email} (${where}).` : `${email} wasn't an admin (${where}).`);
    return;
  }
  if (before === after) console.log(`${email} is already a ${ROLE_LABEL[after]} (${where}).`);
  else if (before) console.log(`${email} is now a ${ROLE_LABEL[after]} — was a ${ROLE_LABEL[before]} (${where}).`);
  else console.log(`${email} is now a ${ROLE_LABEL[after]} (${where}). Their account now opens the admin console only.`);
  if (before === "super" && after === "super" && !asSuper) console.log("Pass --sub to make them a sub-admin instead.");
}

run().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
