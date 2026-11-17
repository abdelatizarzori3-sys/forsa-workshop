import { randomUUID } from "node:crypto";
import { createPool, type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";
import type { Brand, BrandInput, Client, ClientInput, Offer, OfferInput } from "../shared/workspace";
import { FREE_OFFER_LIMIT, TRIAL_DAYS } from "../shared/workspace";
import { ApiError, notFound, planFor, type Identity, type Repository, type User } from "./repository";
import { migrations } from "./migrations";

type Sql = Pool | PoolConnection;
type Row = RowDataPacket & Record<string, any>;
function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return new Date(text.includes("T") ? text : text.replace(" ", "T") + "Z").toISOString();
}
function userRow(r: Row): User {
  return { id: r.id, openId: r.open_id, name: r.name, email: r.email,
    trialStartedAt: r.trial_started_at ? iso(r.trial_started_at) : null,
    trialExpiresAt: r.trial_expires_at ? iso(r.trial_expires_at) : null };
}
function clientRow(r: Row): Client { return { id: r.id, name: r.name, email: r.email, phone: r.phone, notes: r.notes, createdAt: iso(r.created_at) }; }
function offerRow(r: Row): Offer {
  return { id: r.id, clientId: r.client_id, title: r.title, description: r.description, amount: Number(r.amount), cost: Number(r.cost),
    currency: r.currency, status: r.status, validUntil: r.valid_until ? String(r.valid_until).slice(0, 10) : null,
    version: Number(r.version), createdAt: iso(r.created_at), updatedAt: iso(r.updated_at) };
}
async function rows(db: Sql, sql: string, values: unknown[] = []): Promise<Row[]> { return (await db.execute<Row[]>(sql, values))[0]; }
async function execute(db: Sql, sql: string, values: unknown[] = []): Promise<ResultSetHeader> { return (await db.execute<ResultSetHeader>(sql, values))[0]; }

export function databasePool(dsn = process.env.DATABASE_URL): Pool {
  if (!dsn) throw new ApiError(503, "DATABASE_UNCONFIGURED", "قاعدة البيانات غير مجهزة.");
  const url = new URL(dsn);
  if (!["mysql:", "mysql2:"].includes(url.protocol)) throw new Error("Unsupported database protocol");
  const sslRequired = ["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") || "") || url.searchParams.has("ssl");
  return createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)), connectionLimit: 5, queueLimit: 100, waitForConnections: true,
    charset: "utf8mb4", timezone: "Z", dateStrings: true, enableKeepAlive: true, connectTimeout: 10_000,
    ...(sslRequired ? { ssl: { rejectUnauthorized: true } } : {}) });
}

export class MysqlRepository implements Repository {
  constructor(private pool: Pool) {}
  async ready() {
    try {
      const r = await rows(this.pool, "SELECT version FROM forsa_schema_migrations WHERE version = ?", [migrations[migrations.length - 1].version]);
      if (!r.length) return false;
      await rows(this.pool, "SELECT u.id, c.id, o.id, b.owner_id FROM forsa_users u LEFT JOIN forsa_clients c ON c.owner_id=u.id LEFT JOIN forsa_offers o ON o.owner_id=u.id LEFT JOIN forsa_brands b ON b.owner_id=u.id LIMIT 1");
      return true;
    } catch { return false; }
  }
  async resolveUser(identity: Identity): Promise<User> {
    await execute(this.pool, "INSERT INTO forsa_users (id,open_id,name,email) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email)",
      [randomUUID(), identity.openId, identity.name, identity.email]);
    const [r] = await rows(this.pool, "SELECT * FROM forsa_users WHERE open_id=?", [identity.openId]);
    if (!r) throw new ApiError(503, "DATABASE_UNAVAILABLE", "تعذر الوصول إلى الحساب.");
    return userRow(r);
  }
  async createOAuthNonce(hash: string, redirectUri: string, expiresAt: string): Promise<void> {
    await execute(this.pool, "DELETE FROM forsa_oauth_nonces WHERE expires_at < UTC_TIMESTAMP(3)");
    await execute(this.pool, "INSERT INTO forsa_oauth_nonces(nonce_hash,redirect_uri,expires_at) VALUES(?,?,?)", [hash, redirectUri, expiresAt.slice(0,23).replace("T", " ")]);
  }
  async consumeOAuthNonce(hash: string): Promise<{ redirectUri: string; expiresAt: string } | null> {
    const db = await this.pool.getConnection();
    try {
      await db.beginTransaction();
      const [row] = await rows(db, "SELECT redirect_uri,expires_at FROM forsa_oauth_nonces WHERE nonce_hash=? FOR UPDATE", [hash]);
      await execute(db, "DELETE FROM forsa_oauth_nonces WHERE nonce_hash=?", [hash]);
      await db.commit();
      return row ? { redirectUri: row.redirect_uri, expiresAt: iso(row.expires_at) } : null;
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  }
  async getUser(owner: string): Promise<User> {
    const [r] = await rows(this.pool, "SELECT * FROM forsa_users WHERE id=?", [owner]);
    if (!r) throw notFound();
    return userRow(r);
  }
  private async transaction<T>(owner: string, work: (connection: PoolConnection, user: User, now: Date) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // One row per owner serializes quota checks, relations, deletes and trial activation.
      const [r] = await rows(connection, "SELECT *, UTC_TIMESTAMP(3) AS server_now FROM forsa_users WHERE id=? FOR UPDATE", [owner]);
      if (!r) throw notFound();
      const result = await work(connection, userRow(r), new Date(iso(r.server_now)));
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async startTrial(owner: string): Promise<User> {
    return this.transaction(owner, async (db, user) => {
      if (user.trialStartedAt) throw new ApiError(409, "TRIAL_ALREADY_USED", "تم استخدام التجربة لهذا الحساب بالفعل.");
      await execute(db, "UPDATE forsa_users SET trial_started_at=UTC_TIMESTAMP(3),trial_expires_at=DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? DAY) WHERE id=? AND trial_started_at IS NULL", [TRIAL_DAYS, owner]);
      return userRow((await rows(db, "SELECT * FROM forsa_users WHERE id=?", [owner]))[0]);
    });
  }
  async listClients(owner: string) { return (await rows(this.pool, "SELECT * FROM forsa_clients WHERE owner_id=? ORDER BY created_at DESC,id", [owner])).map(clientRow); }
  private async client(db: Sql, owner: string, id: string): Promise<Client> {
    const [r] = await rows(db, "SELECT * FROM forsa_clients WHERE owner_id=? AND id=?", [owner, id]);
    if (!r) throw notFound(); return clientRow(r);
  }
  async getClient(owner: string, id: string) { return this.client(this.pool, owner, id); }
  async createClient(owner: string, input: ClientInput) {
    return this.transaction(owner, async db => {
      const id = randomUUID();
      await execute(db, "INSERT INTO forsa_clients (id,owner_id,name,email,phone,notes) VALUES (?,?,?,?,?,?)", [id, owner, input.name, input.email, input.phone, input.notes]);
      return this.client(db, owner, id);
    });
  }
  async updateClient(owner: string, id: string, input: ClientInput) {
    return this.transaction(owner, async db => {
      await this.client(db, owner, id);
      await execute(db, "UPDATE forsa_clients SET name=?,email=?,phone=?,notes=? WHERE owner_id=? AND id=?", [input.name, input.email, input.phone, input.notes, owner, id]);
      return this.client(db, owner, id);
    });
  }
  async deleteClient(owner: string, id: string) {
    await this.transaction(owner, async db => {
      await this.client(db, owner, id);
      if ((await rows(db, "SELECT id FROM forsa_offers WHERE owner_id=? AND client_id=? LIMIT 1", [owner, id])).length)
        throw new ApiError(409, "CLIENT_REFERENCED", "العميل مرتبط بعرض. عدّل العرض أو احذفه أولاً.");
      await execute(db, "DELETE FROM forsa_clients WHERE owner_id=? AND id=?", [owner, id]);
    });
  }
  async listOffers(owner: string) { return (await rows(this.pool, "SELECT * FROM forsa_offers WHERE owner_id=? ORDER BY created_at DESC,id", [owner])).map(offerRow); }
  private async offer(db: Sql, owner: string, id: string): Promise<Offer> {
    const [r] = await rows(db, "SELECT * FROM forsa_offers WHERE owner_id=? AND id=?", [owner, id]);
    if (!r) throw notFound(); return offerRow(r);
  }
  async getOffer(owner: string, id: string) { return this.offer(this.pool, owner, id); }
  async createOffer(owner: string, input: OfferInput) {
    return this.transaction(owner, async (db, user, now) => {
      if (input.clientId) await this.client(db, owner, input.clientId);
      const [count] = await rows(db, "SELECT COUNT(*) AS total FROM forsa_offers WHERE owner_id=?", [owner]);
      if (!planFor(user, now).proEnabled && Number(count.total) >= FREE_OFFER_LIMIT)
        throw new ApiError(403, "FREE_OFFER_LIMIT", "الحد المجاني ثلاثة عروض محفوظة. فعّل التجربة لإنشاء المزيد.");
      const id = randomUUID();
      await execute(db, "INSERT INTO forsa_offers (id,owner_id,client_id,title,description,amount,cost,currency,status,valid_until) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [id, owner, input.clientId, input.title, input.description, input.amount, input.cost, input.currency, input.status, input.validUntil]);
      return this.offer(db, owner, id);
    });
  }
  async updateOffer(owner: string, id: string, input: OfferInput, expectedVersion: number) {
    return this.transaction(owner, async db => {
      await this.offer(db, owner, id);
      if (input.clientId) await this.client(db, owner, input.clientId);
      const result = await execute(db, "UPDATE forsa_offers SET client_id=?,title=?,description=?,amount=?,cost=?,currency=?,status=?,valid_until=?,version=version+1,updated_at=UTC_TIMESTAMP(3) WHERE owner_id=? AND id=? AND version=?",
        [input.clientId, input.title, input.description, input.amount, input.cost, input.currency, input.status, input.validUntil, owner, id, expectedVersion]);
      if (!result.affectedRows) throw new ApiError(409, "VERSION_CONFLICT", "تم تعديل العرض في نافذة أخرى. حدّث البيانات قبل الحفظ.");
      return this.offer(db, owner, id);
    });
  }
  async deleteOffer(owner: string, id: string) {
    await this.transaction(owner, async db => {
      await this.offer(db, owner, id);
      await execute(db, "DELETE FROM forsa_offers WHERE owner_id=? AND id=?", [owner, id]);
    });
  }
  async getBrand(owner: string): Promise<Brand> {
    const [r] = await rows(this.pool, "SELECT * FROM forsa_brands WHERE owner_id=?", [owner]);
    if (r) return { businessName: r.business_name, contactEmail: r.contact_email, contactPhone: r.contact_phone, logoDataUrl: r.logo_data_url };
    const user = await this.getUser(owner);
    return { businessName: user.name, contactEmail: user.email, contactPhone: "", logoDataUrl: null };
  }
  async saveBrand(owner: string, input: BrandInput): Promise<Brand> {
    return this.transaction(owner, async db => {
      await execute(db, "INSERT INTO forsa_brands (owner_id,business_name,contact_email,contact_phone,logo_data_url) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE business_name=VALUES(business_name),contact_email=VALUES(contact_email),contact_phone=VALUES(contact_phone),logo_data_url=VALUES(logo_data_url)",
        [owner, input.businessName, input.contactEmail, input.contactPhone, input.logoDataUrl]);
      return { ...input };
    });
  }
}
