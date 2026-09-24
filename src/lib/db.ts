/**
 * Data access layer.
 *
 * - With MONGODB_URI set → MongoDB (production).
 * - Without it (local dev only) → a JSON file at .data/orza-db.json that
 *   implements the small Mongo subset the app uses.
 *
 * Every document carries a string `id`; Mongo's `_id` is never returned.
 * Supported filter operators: equality (incl. dotted paths), $gt $gte $lt $lte $ne $in $exists.
 * Supported update operators: $set $inc $push (with $each / $slice) $unset $setOnInsert.
 */
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { MongoClient, type Db } from "mongodb";

export type CollectionName =
  | "users"
  | "meals"
  | "scans"
  | "tracking"
  | "chat_sessions"
  | "chat_messages"
  | "goals"
  | "compensation_plans"
  | "recipes"
  | "credit_transactions"
  | "onboarding"
  | "leads"
  | "media"
  | "medications"
  | "prescriptions"
  | "dose_logs"
  | "reminders"
  | "push_subscriptions"
  | "dispatches"
  | "health_days";

export type Filter = Record<string, any>;
export type Update = {
  $set?: Record<string, any>;
  $inc?: Record<string, number>;
  $push?: Record<string, any>;
  $unset?: Record<string, any>;
  $setOnInsert?: Record<string, any>;
};
export type FindOptions = { sort?: Record<string, 1 | -1>; limit?: number; skip?: number };

export interface Collection<T extends { id: string }> {
  findOne(filter: Filter): Promise<T | null>;
  find(filter?: Filter, opts?: FindOptions): Promise<T[]>;
  insertOne(doc: T): Promise<T>;
  /** Returns how many docs matched (0/1) and whether an upsert inserted a doc. */
  updateOne(filter: Filter, update: Update, opts?: { upsert?: boolean }): Promise<{ matched: number; upserted: boolean }>;
  /** Atomically updates and returns the document after the update (null if nothing matched and no upsert). */
  findOneAndUpdate(filter: Filter, update: Update, opts?: { upsert?: boolean }): Promise<T | null>;
  deleteOne(filter: Filter): Promise<number>;
  deleteMany(filter: Filter): Promise<number>;
  countDocuments(filter?: Filter): Promise<number>;
}

export const newId = () => randomUUID();
export const nowISO = () => new Date().toISOString();

/* ───────────────────────── Mongo backend ───────────────────────── */

type G = typeof globalThis & {
  __orzaMongo?: Promise<Db>;
  __orzaFileDb?: FileDb;
};
const g = globalThis as G;

async function getMongo(): Promise<Db> {
  if (!g.__orzaMongo) {
    g.__orzaMongo = (async () => {
      const client = new MongoClient(process.env.MONGODB_URI as string, { maxPoolSize: 10 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || "orza");
      await ensureIndexes(db).catch((e) => console.warn("[orza] index creation failed", e));
      return db;
    })().catch((e) => {
      g.__orzaMongo = undefined;
      throw e;
    });
  }
  return g.__orzaMongo;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection("users").createIndex({ id: 1 }, { unique: true }),
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("meals").createIndex({ user_id: 1, date: 1 }),
    db.collection("meals").createIndex({ id: 1 }, { unique: true }),
    db.collection("scans").createIndex({ id: 1 }, { unique: true }),
    db.collection("tracking").createIndex({ user_id: 1, date: 1 }, { unique: true }),
    db.collection("chat_sessions").createIndex({ user_id: 1, updated_at: -1 }),
    db.collection("chat_messages").createIndex({ session_id: 1, created_at: 1 }),
    db.collection("goals").createIndex({ user_id: 1, active: 1 }),
    db.collection("compensation_plans").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("recipes").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("credit_transactions").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("onboarding").createIndex({ user_id: 1 }, { unique: true }),
    db.collection("leads").createIndex({ email: 1, source: 1 }, { unique: true }),
    db.collection("media").createIndex({ id: 1 }, { unique: true }),
    db.collection("medications").createIndex({ user_id: 1, active: 1 }),
    db.collection("prescriptions").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("dose_logs").createIndex({ id: 1 }, { unique: true }),
    db.collection("dose_logs").createIndex({ user_id: 1, local_date: 1 }),
    db.collection("reminders").createIndex({ user_id: 1, active: 1 }),
    db.collection("push_subscriptions").createIndex({ endpoint: 1 }, { unique: true }),
    db.collection("push_subscriptions").createIndex({ user_id: 1 }),
    db.collection("dispatches").createIndex({ id: 1 }, { unique: true }),
    db.collection("dispatches").createIndex({ created_at: 1 }),
    db.collection("health_days").createIndex({ user_id: 1, date: 1, source: 1 }, { unique: true }),
    db.collection("users").createIndex({ "integrations.calendar_token": 1 }, { sparse: true }),
    db.collection("users").createIndex({ "integrations.health_token_hash": 1 }, { sparse: true }),
  ]);
}

function mongoCollection<T extends { id: string }>(name: CollectionName): Collection<T> {
  const c = async () => (await getMongo()).collection(name);
  const proj = { projection: { _id: 0 } };
  return {
    async findOne(filter) {
      return ((await (await c()).findOne(filter, proj)) as unknown as T) ?? null;
    },
    async find(filter = {}, opts = {}) {
      let cur = (await c()).find(filter, proj);
      if (opts.sort) cur = cur.sort(opts.sort);
      if (opts.skip) cur = cur.skip(opts.skip);
      if (opts.limit) cur = cur.limit(opts.limit);
      return (await cur.toArray()) as unknown as T[];
    },
    async insertOne(doc) {
      await (await c()).insertOne({ ...doc } as any);
      return doc;
    },
    async updateOne(filter, update, opts = {}) {
      const r = await (await c()).updateOne(filter, update as any, { upsert: !!opts.upsert });
      return { matched: r.matchedCount, upserted: !!r.upsertedCount };
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      const r = await (await c()).findOneAndUpdate(filter, update as any, {
        upsert: !!opts.upsert,
        returnDocument: "after",
        projection: { _id: 0 },
      });
      return (r as unknown as T) ?? null;
    },
    async deleteOne(filter) {
      return (await (await c()).deleteOne(filter)).deletedCount;
    },
    async deleteMany(filter) {
      return (await (await c()).deleteMany(filter)).deletedCount;
    },
    async countDocuments(filter = {}) {
      return (await c()).countDocuments(filter);
    },
  };
}

/* ─────────────────────── JSON-file backend (dev) ─────────────────────── */

type FileDb = { data: Record<string, any[]>; file: string; writing: Promise<void>; loaded: Promise<void> };

function getFileDb(): FileDb {
  if (!g.__orzaFileDb) {
    const file = path.join(process.cwd(), ".data", "orza-db.json");
    const db: FileDb = { data: {}, file, writing: Promise.resolve(), loaded: Promise.resolve() };
    db.loaded = (async () => {
      try {
        db.data = JSON.parse(await fs.readFile(file, "utf8"));
      } catch {
        db.data = {};
      }
    })();
    if (process.env.NODE_ENV === "production") {
      console.warn("[orza] MONGODB_URI is not set — using a local JSON file. Data will not persist on serverless hosts.");
    }
    g.__orzaFileDb = db;
  }
  return g.__orzaFileDb;
}

function persist(db: FileDb) {
  db.writing = db.writing
    .then(async () => {
      await fs.mkdir(path.dirname(db.file), { recursive: true });
      const tmp = db.file + ".tmp";
      await fs.writeFile(tmp, JSON.stringify(db.data));
      await fs.rename(tmp, db.file);
    })
    .catch((e) => console.error("[orza] file db write failed", e));
  return db.writing;
}

export function getPath(obj: any, p: string) {
  return p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj: any, p: string, v: any) {
  const ks = p.split(".");
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    if (o[ks[i]] == null || typeof o[ks[i]] !== "object") o[ks[i]] = {};
    o = o[ks[i]];
  }
  o[ks[ks.length - 1]] = v;
}
function unsetPath(obj: any, p: string) {
  const ks = p.split(".");
  const parent = ks.length > 1 ? getPath(obj, ks.slice(0, -1).join(".")) : obj;
  if (parent && typeof parent === "object") delete parent[ks[ks.length - 1]];
}

function eq(a: any, b: any) {
  if (Array.isArray(a) && !Array.isArray(b)) return a.some((x) => eq(x, b));
  if (a && b && typeof a === "object" && typeof b === "object") return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

export function matches(doc: any, filter: Filter): boolean {
  return Object.entries(filter || {}).every(([k, cond]) => {
    const v = getPath(doc, k);
    if (cond && typeof cond === "object" && !Array.isArray(cond) && Object.keys(cond).some((x) => x.startsWith("$"))) {
      return Object.entries(cond).every(([op, arg]: [string, any]) => {
        switch (op) {
          case "$gt": return v != null && v > arg;
          case "$gte": return v != null && v >= arg;
          case "$lt": return v != null && v < arg;
          case "$lte": return v != null && v <= arg;
          case "$ne": return !eq(v, arg);
          case "$in": return (arg as any[]).some((a) => eq(v, a));
          case "$exists": return arg ? v !== undefined : v === undefined;
          default: throw new Error(`Unsupported filter operator ${op}`);
        }
      });
    }
    return eq(v, cond);
  });
}

function applyUpdate(doc: any, update: Update, inserting: boolean) {
  for (const [k, v] of Object.entries(update.$set || {})) setPath(doc, k, structuredClone(v));
  if (inserting) for (const [k, v] of Object.entries(update.$setOnInsert || {})) setPath(doc, k, structuredClone(v));
  for (const [k, v] of Object.entries(update.$inc || {})) setPath(doc, k, (Number(getPath(doc, k)) || 0) + v);
  for (const k of Object.keys(update.$unset || {})) unsetPath(doc, k);
  for (const [k, v] of Object.entries(update.$push || {})) {
    const arr = Array.isArray(getPath(doc, k)) ? getPath(doc, k) : [];
    if (v && typeof v === "object" && "$each" in v) {
      arr.push(...structuredClone(v.$each));
      if (typeof v.$slice === "number") {
        const sliced = v.$slice < 0 ? arr.slice(v.$slice) : arr.slice(0, v.$slice);
        arr.length = 0;
        arr.push(...sliced);
      }
    } else arr.push(structuredClone(v));
    setPath(doc, k, arr);
  }
}

function sortDocs(docs: any[], sort?: Record<string, 1 | -1>) {
  if (!sort) return docs;
  const keys = Object.entries(sort);
  return [...docs].sort((a, b) => {
    for (const [k, dir] of keys) {
      const av = getPath(a, k), bv = getPath(b, k);
      if (av === bv) continue;
      if (av == null) return -dir;
      if (bv == null) return dir;
      return av > bv ? dir : -dir;
    }
    return 0;
  });
}

function fileCollection<T extends { id: string }>(name: CollectionName): Collection<T> {
  const db = getFileDb();
  const rows = async () => {
    await db.loaded;
    return (db.data[name] ||= []);
  };
  const upsertDoc = (filter: Filter, update: Update) => {
    const doc: any = {};
    for (const [k, v] of Object.entries(filter)) if (!(v && typeof v === "object" && !Array.isArray(v))) setPath(doc, k, v);
    applyUpdate(doc, update, true);
    if (!doc.id) doc.id = newId();
    return doc;
  };
  return {
    async findOne(filter) {
      const d = (await rows()).find((r) => matches(r, filter));
      return d ? structuredClone(d) : null;
    },
    async find(filter = {}, opts = {}) {
      let out = sortDocs((await rows()).filter((r) => matches(r, filter)), opts.sort);
      if (opts.skip) out = out.slice(opts.skip);
      if (opts.limit) out = out.slice(0, opts.limit);
      return structuredClone(out);
    },
    async insertOne(doc) {
      (await rows()).push(structuredClone(doc));
      await persist(db);
      return doc;
    },
    async updateOne(filter, update, opts = {}) {
      const r = await rows();
      const d = r.find((x) => matches(x, filter));
      if (d) {
        applyUpdate(d, update, false);
        await persist(db);
        return { matched: 1, upserted: false };
      }
      if (opts.upsert) {
        r.push(upsertDoc(filter, update));
        await persist(db);
        return { matched: 0, upserted: true };
      }
      return { matched: 0, upserted: false };
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      const r = await rows();
      let d = r.find((x) => matches(x, filter));
      if (d) applyUpdate(d, update, false);
      else if (opts.upsert) r.push((d = upsertDoc(filter, update)));
      else return null;
      await persist(db);
      return structuredClone(d);
    },
    async deleteOne(filter) {
      const r = await rows();
      const i = r.findIndex((x) => matches(x, filter));
      if (i < 0) return 0;
      r.splice(i, 1);
      await persist(db);
      return 1;
    },
    async deleteMany(filter) {
      const r = await rows();
      const keep = r.filter((x) => !matches(x, filter));
      const n = r.length - keep.length;
      db.data[name] = keep;
      if (n) await persist(db);
      return n;
    },
    async countDocuments(filter = {}) {
      return (await rows()).filter((r) => matches(r, filter)).length;
    },
  };
}

/* ───────────────────────────── public API ───────────────────────────── */

export const usingMongo = () => !!process.env.MONGODB_URI;

export function col<T extends { id: string }>(name: CollectionName): Collection<T> {
  return usingMongo() ? mongoCollection<T>(name) : fileCollection<T>(name);
}
