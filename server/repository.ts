import type { Brand, BrandInput, Client, ClientInput, Offer, OfferInput, WorkspacePlan } from "../shared/workspace";
import { FREE_OFFER_LIMIT } from "../shared/workspace";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const notFound = () => new ApiError(404, "NOT_FOUND", "السجل غير موجود.");
export interface Identity { openId: string; name: string; email: string; }
export interface User extends Identity { id: string; trialStartedAt: string | null; trialExpiresAt: string | null; }
export function planFor(user: User, now = new Date()): WorkspacePlan {
  const active = !!user.trialStartedAt && !!user.trialExpiresAt && Date.parse(user.trialExpiresAt) > now.getTime();
  return { kind: active ? "trial" : "free", proEnabled: active, trialUsed: user.trialStartedAt !== null,
    expiresAt: user.trialExpiresAt, freeOfferLimit: FREE_OFFER_LIMIT, paymentConfigured: false };
}
export interface Repository {
  ready(): Promise<boolean>;
  resolveUser(identity: Identity): Promise<User>;
  createOAuthNonce(hash: string, redirectUri: string, expiresAt: string): Promise<void>;
  consumeOAuthNonce(hash: string): Promise<{ redirectUri: string; expiresAt: string } | null>;
  getUser(owner: string): Promise<User>;
  startTrial(owner: string): Promise<User>;
  listClients(owner: string): Promise<Client[]>;
  getClient(owner: string, id: string): Promise<Client>;
  createClient(owner: string, input: ClientInput): Promise<Client>;
  updateClient(owner: string, id: string, input: ClientInput): Promise<Client>;
  deleteClient(owner: string, id: string): Promise<void>;
  listOffers(owner: string): Promise<Offer[]>;
  getOffer(owner: string, id: string): Promise<Offer>;
  createOffer(owner: string, input: OfferInput): Promise<Offer>;
  updateOffer(owner: string, id: string, input: OfferInput, expectedVersion: number): Promise<Offer>;
  deleteOffer(owner: string, id: string): Promise<void>;
  getBrand(owner: string): Promise<Brand>;
  saveBrand(owner: string, input: BrandInput): Promise<Brand>;
}
