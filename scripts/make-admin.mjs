#!/usr/bin/env node
/**
 * Grant or revoke ÖRZA admin access for an existing account.
 *
 *   node scripts/make-admin.mjs person@example.com            grant admin
 *   node scripts/make-admin.mjs person@example.com --revoke   remove admin
 *   node scripts/make-admin.mjs --list                        list current admins
 *
 * Admin access is only ever granted here (out-of-band), never from the email address someone signs
 * up with: ÖRZA doesn't verify email ownership, so an address list would let anyone who registers a
 * listed address first become an admin.
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
      "  node scripts/make-admin.mjs <email>            grant admin access",
      "  node scripts/make-admin.mjs <email> --revoke   remove admin access",
      "  node scripts/make-admin.mjs --list             list admins",
    ].join("\n")
  );
  process.exit(code);
}

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) usage(0);
const list = args.includes("--list");
const revoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();
if (!list && !email) usage();
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" doesn't look like an email address.`);
  process.exit(1);
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const now = new Date().toISOString();

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
      const admins = await withMongo((users) => users.find({ is_admin: true }, { projection: { _id: 0, email: 1, name: 1 } }).toArray());
      return printAdmins(admins, where);
    }
    const r = await withMongo((users) =>
      users.updateOne({ email }, revoke ? { $unset: { is_admin: "" }, $set: { updated_at: now } } : { $set: { is_admin: true, updated_at: now } })
    );
    if (!r.matchedCount) return notFound(where);
    return done(where);
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
  if (revoke) delete user.is_admin;
  else user.is_admin = true;
  user.updated_at = now;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file + ".tmp", JSON.stringify(data));
  await rename(file + ".tmp", file);
  done(where);
  console.log("If the dev server is running, restart it so it reloads the database file.");
}

function printAdmins(admins, where) {
  if (!admins.length) console.log(`No admins in ${where}.`);
  else for (const a of admins) console.log(`${a.email}${a.name ? `  (${a.name})` : ""}`);
}

function notFound(where) {
  console.error(`No account with the email ${email} in ${where}. The person needs to sign up first.`);
  process.exit(1);
}

function done(where) {
  console.log(revoke ? `Removed admin access for ${email} (${where}).` : `${email} is now an admin (${where}).`);
}

run().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
