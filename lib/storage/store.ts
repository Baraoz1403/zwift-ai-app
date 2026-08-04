/**
 * Key-Value store abstraction.
 *
 * Production: Vercel KV (set KV_REST_API_URL + KV_REST_API_TOKEN in env).
 * Development fallback: JSON file at .data/store.json (auto-created).
 *
 * API: get<T>(key), set(key, value), del(key), getMany<T>(keys[])
 * All ops are async for interface uniformity with KV.
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

// ─── Vercel KV (production) ───────────────────────────────────────────────────

const KV_URL   = process.env.KV_REST_API_URL   ?? '';
const KV_TOKEN = process.env.KV_REST_API_TOKEN ?? '';
const USE_VERCEL_KV = Boolean(KV_URL && KV_TOKEN);

async function kvFetch(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${KV_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`KV ${method} ${path} → ${res.status}`);
  const json = await res.json() as { result: unknown };
  return json.result;
}

// ─── File-based fallback (development) ────────────────────────────────────────

const DATA_DIR  = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function readFileStore(): Record<string, JsonValue> {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Record<string, JsonValue>;
  } catch {
    return {};
  }
}

function writeFileStore(data: Record<string, JsonValue>): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Best-effort — never crash the API on a write failure
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Read a value. Returns null if the key doesn't exist. */
export async function get<T = JsonValue>(key: string): Promise<T | null> {
  if (USE_VERCEL_KV) {
    const result = await kvFetch('GET', `/get/${encodeURIComponent(key)}`);
    return (result ?? null) as T | null;
  }
  const store = readFileStore();
  return (key in store ? (store[key] as unknown as T) : null);
}

/** Write a value. */
export async function set(key: string, value: JsonValue): Promise<void> {
  if (USE_VERCEL_KV) {
    await kvFetch('POST', '/set', [key, JSON.stringify(value)]);
    return;
  }
  const store = readFileStore();
  store[key] = value;
  writeFileStore(store);
}

/** Delete a key. */
export async function del(key: string): Promise<void> {
  if (USE_VERCEL_KV) {
    await kvFetch('POST', '/del', [key]);
    return;
  }
  const store = readFileStore();
  delete store[key];
  writeFileStore(store);
}

/** Read multiple keys in one call (returns array in same order, null for missing). */
export async function getMany<T = JsonValue>(keys: string[]): Promise<(T | null)[]> {
  if (USE_VERCEL_KV) {
    const result = await kvFetch('POST', '/mget', keys) as (unknown | null)[];
    return result.map(v => (v == null ? null : (v as unknown as T)));
  }
  const store = readFileStore();
  return keys.map(k => (k in store ? (store[k] as unknown as T) : null));
}

/** Add a value to a set (list of unique string IDs — used for indexes). */
export async function sadd(key: string, member: string): Promise<void> {
  if (USE_VERCEL_KV) {
    await kvFetch('POST', '/sadd', [key, member]);
    return;
  }
  const store = readFileStore();
  const current = (store[key] ?? []) as string[];
  if (!current.includes(member)) current.push(member);
  store[key] = current;
  writeFileStore(store);
}

/** Read all members of a set. */
export async function smembers(key: string): Promise<string[]> {
  if (USE_VERCEL_KV) {
    const result = await kvFetch('POST', '/smembers', [key]) as string[];
    return result ?? [];
  }
  const store = readFileStore();
  return (store[key] as string[] | undefined) ?? [];
}
