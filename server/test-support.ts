// Test-only fixtures. Never imported by production index/app, never bypass live authentication.
import { randomUUID } from "node:crypto";
import type { Brand, BrandInput, Client, ClientInput, Offer, OfferInput } from "../shared/workspace";
import { FREE_OFFER_LIMIT, TRIAL_DAYS } from "../shared/workspace";
import { ApiError, notFound, planFor, type Identity, type Repository, type User } from "./repository";
export class MemoryRepository implements Repository {
  users = new Map<string, User>();
  clients = new Map<string, { owner: string; value: Client }>();
  offers = new Map<string, { owner: string; value: Offer }>();
  brands = new Map<string, Brand>();
  nonces = new Map<string, { redirectUri: string; expiresAt: string }>();
  constructor(public now: () => Date) {}
  async ready() { return true; }
  async resolveUser(identity: Identity) { const old = [...this.users.values()].find(u => u.openId === identity.openId); if (old) return old; const user = { ...identity, id: randomUUID(), trialStartedAt: null, trialExpiresAt: null }; this.users.set(user.id, user); return user; }
  async getUser(id: string) { const u = this.users.get(id); if (!u) throw notFound(); return u; }
  async createOAuthNonce(hash: string, redirectUri: string, expiresAt: string) { this.nonces.set(hash, { redirectUri, expiresAt }); }
  async consumeOAuthNonce(hash: string) { const n = this.nonces.get(hash) ?? null; this.nonces.delete(hash); return n; }
  async startTrial(owner: string) { const u = await this.getUser(owner); if (u.trialStartedAt) throw new ApiError(409, "TRIAL_ALREADY_USED", "used"); u.trialStartedAt = this.now().toISOString(); u.trialExpiresAt = new Date(this.now().getTime() + TRIAL_DAYS * 86400000).toISOString(); return u; }
  async listClients(owner: string) { return [...this.clients.values()].filter(c => c.owner === owner).map(c => ({ ...c.value })); }
  async getClient(owner: string, id: string) { const c = this.clients.get(id); if (!c || c.owner !== owner) throw notFound(); return { ...c.value }; }
  async createClient(owner: string, input: ClientInput) { const c = { ...input, id: randomUUID(), createdAt: this.now().toISOString() }; this.clients.set(c.id, { owner, value: c }); return c; }
  async updateClient(owner: string, id: string, input: ClientInput) { const c = { ...await this.getClient(owner,id), ...input }; this.clients.set(id, { owner, value: c }); return c; }
  async deleteClient(owner: string, id: string) { await this.getClient(owner,id); if ([...this.offers.values()].some(o => o.owner === owner && o.value.clientId === id)) throw new ApiError(409,"CLIENT_REFERENCED","linked"); this.clients.delete(id); }
  async listOffers(owner: string) { return [...this.offers.values()].filter(o => o.owner === owner).map(o => ({ ...o.value })); }
  async getOffer(owner: string, id: string) { const o = this.offers.get(id); if (!o || o.owner !== owner) throw notFound(); return { ...o.value }; }
  async createOffer(owner: string, input: OfferInput) { if (input.clientId) await this.getClient(owner,input.clientId); if (!planFor(await this.getUser(owner),this.now()).proEnabled && (await this.listOffers(owner)).length >= FREE_OFFER_LIMIT) throw new ApiError(403,"FREE_OFFER_LIMIT","limit"); const o = { ...input, id: randomUUID(), version: 1, createdAt: this.now().toISOString(), updatedAt: this.now().toISOString() }; this.offers.set(o.id,{ owner,value:o }); return o; }
  async updateOffer(owner: string, id: string, input: OfferInput, expectedVersion: number) { const old = await this.getOffer(owner,id); if (old.version !== expectedVersion) throw new ApiError(409,"VERSION_CONFLICT","stale"); if (input.clientId) await this.getClient(owner,input.clientId); const next = { ...old, ...input, version: old.version + 1, updatedAt: this.now().toISOString() }; this.offers.set(id,{owner,value:next}); return next; }
  async deleteOffer(owner: string,id: string) { await this.getOffer(owner,id); this.offers.delete(id); }
  async getBrand(owner: string): Promise<Brand> { return this.brands.get(owner) ?? { businessName:(await this.getUser(owner)).name,contactEmail:"",contactPhone:"",logoDataUrl:null }; }
  async saveBrand(owner: string, input: BrandInput) { this.brands.set(owner,input); return input; }
}
