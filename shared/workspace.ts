import { z } from "zod";

export const currencies = ["MAD", "SAR", "AED", "USD", "EUR"] as const;
export const offerStatuses = ["draft", "sent", "accepted", "declined"] as const;
export const statusLabels: Record<OfferStatus, string> = {
  draft: "مسودة", sent: "مُرسل", accepted: "مقبول", declined: "مرفوض",
};
export const FREE_OFFER_LIMIT = 3;
export const TRIAL_DAYS = 7;
export type Currency = typeof currencies[number];
export type OfferStatus = typeof offerStatuses[number];

const text = (max: number) => z.string().trim().max(max);
const money = z.number().finite().min(0).max(1_000_000)
  .refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "استخدم منزلتين عشريتين كحد أقصى");
const optionalEmail = z.union([z.literal(""), z.email().max(254)]);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(v => { const d = new Date(v + "T00:00:00Z"); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v; }, "تاريخ غير صالح");

export const clientInputSchema = z.object({
  name: text(120).min(2), email: optionalEmail.default(""),
  phone: text(60).default(""), notes: text(3000).default(""),
}).strict();
export const offerInputSchema = z.object({
  title: text(160).min(2), description: text(6000).min(2),
  clientId: z.uuid().nullable().default(null), amount: money, cost: money,
  currency: z.enum(currencies).default("MAD"),
  status: z.enum(offerStatuses).default("draft"),
  validUntil: date.nullable().default(null),
}).strict();
export const offerUpdateSchema = offerInputSchema.extend({ expectedVersion: z.number().int().positive() });
export const brandInputSchema = z.object({
  businessName: text(120).min(2), contactEmail: optionalEmail.default(""),
  contactPhone: text(60).default(""),
  logoDataUrl: z.string().max(700_000).nullable().default(null),
}).strict();
export type ClientInput = z.infer<typeof clientInputSchema>;
export type OfferInput = z.infer<typeof offerInputSchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
export interface Client extends ClientInput { id: string; createdAt: string; }
export interface Offer extends OfferInput { id: string; version: number; createdAt: string; updatedAt: string; }
export interface Brand extends BrandInput {}
export interface WorkspacePlan {
  kind: "free" | "trial";
  proEnabled: boolean;
  trialUsed: boolean;
  expiresAt: string | null;
  freeOfferLimit: number;
  paymentConfigured: false;
}
export interface WorkspaceSession {
  user: { id: string; name: string; email: string };
  plan: WorkspacePlan;
  csrfToken: string;
}
export interface ApiProblem { error: { code: string; message: string }; }

export function offerTotals(offer: Pick<Offer, "amount" | "cost">) {
  const net = Math.round((offer.amount - offer.cost) * 100) / 100;
  return { net, margin: offer.amount > 0 ? Math.round(net / offer.amount * 1000) / 10 : null };
}
export function formatMoney(amount: number, currency: Currency) {
  return new Intl.NumberFormat("ar", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** Contract: every mutation requires X-CSRF-Token from GET /api/auth/session.
 * GET /api/auth/session -> WorkspaceSession (401 when logged out, 503 when unconfigured)
 * GET /api/auth/login?origin=<window.location.origin> -> {url:string} real Manus OAuth URL
 * GET /api/auth/callback -> session cookie + fixed /workspace redirect
 * POST /api/auth/logout -> 204
 * GET /api/workspace/clients -> {clients:Client[]}
 * POST /api/workspace/clients ClientInput -> {client:Client} (201)
 * PATCH /api/workspace/clients/:id ClientInput -> {client:Client}
 * DELETE /api/workspace/clients/:id -> 204 (409 if referenced by offers)
 * GET /api/workspace/offers -> {offers:Offer[]}
 * POST /api/workspace/offers OfferInput -> {offer:Offer} (201)
 * PATCH /api/workspace/offers/:id OfferInput+expectedVersion -> {offer:Offer} (409 on stale version)
 * DELETE /api/workspace/offers/:id -> 204
 * GET /api/workspace/brand -> {brand:Brand} (default user's name, no logo)
 * PUT /api/workspace/brand BrandInput -> {brand:Brand}
 * POST /api/pro/trial -> {plan:WorkspacePlan} (trial once, seven days, no payment)
 * GET /api/workspace/offers/:id/pdf -> application/pdf attachment (403 without valid trial)
 * /api/me/entitlements/workshop-report preserves old report contract, supports verified trial.
 * Unauthenticated requests 401, nonowned records 404. Unknown /api paths return JSON 404, never SPA HTML.
 */
