import { z } from "zod";
import { currencies, type BrandInput, type Currency, type OfferInput, type WorkspacePlan } from "@shared/workspace";

export type FieldErrors = Record<string, string>;
export function fieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (result[field]) continue;
    result[field] = issue.code === "too_small" ? "القيمة قصيرة أو أقل من الحد المطلوب (حرفان على الأقل للاسم والوصف)."
      : issue.code === "too_big" ? "القيمة تتجاوز الحد المسموح."
      : issue.code === "invalid_format" ? (field.toLowerCase().includes("email") ? "اكتب بريداً إلكترونياً صالحاً أو اتركه فارغاً." : "اكتب قيمة صحيحة لهذا الحقل.")
      : issue.code === "custom" ? issue.message : "راجع قيمة هذا الحقل.";
  }
  return result;
}
export function hasActivePro(plan: WorkspacePlan | null | undefined, now = Date.now()) {
  return !!plan && plan.kind === "trial" && plan.proEnabled && !!plan.expiresAt && Number.isFinite(Date.parse(plan.expiresAt)) && Date.parse(plan.expiresAt) > now;
}
export function canStartTrial(plan: WorkspacePlan | null | undefined) {
  return !!plan && plan.kind === "free" && !plan.trialUsed && !plan.proEnabled;
}
export function displayDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("ar", { dateStyle: "medium" }).format(date);
}
export function totalsByCurrency(offers: Pick<OfferInput, "amount" | "currency">[]) {
  const totals: Partial<Record<Currency, number>> = {};
  offers.forEach(offer => { totals[offer.currency] = Math.round(((totals[offer.currency] ?? 0) + offer.amount) * 100) / 100; });
  return totals;
}
export function newOfferFromQuery(search: string): OfferInput {
  const q = new URLSearchParams(search);
  const money = (key: string) => {
    const value = Number(q.get(key) ?? 0);
    return Number.isFinite(value) && value >= 0 && value <= 1_000_000 ? Math.round(value * 100) / 100 : 0;
  };
  const currency = q.get("currency");
  return { title: (q.get("title") ?? "").slice(0, 160), description: (q.get("description") ?? "").slice(0, 6000), amount: money("amount"), cost: money("cost"), clientId: null, currency: currencies.includes(currency as Currency) ? currency as Currency : "MAD", status: "draft", validUntil: null };
}
export const MAX_LOGO_BYTES = 500 * 1024;
export function logoFileError(file: Pick<File, "type" | "size">) {
  if (!["image/png", "image/jpeg"].includes(file.type)) return "اختر صورة PNG أو JPEG فقط. ملفات SVG وروابط الصور غير مقبولة.";
  if (file.size > MAX_LOGO_BYTES) return "حجم الشعار أكبر من 500 كيلوبايت. صغّر الصورة ثم أعد المحاولة.";
  if (file.size === 0) return "الصورة فارغة. اختر ملفاً آخر.";
  return null;
}
export function readLogo(file: File): Promise<BrandInput["logoDataUrl"]> {
  const problem = logoFileError(file);
  if (problem) return Promise.reject(new Error(problem));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(result)) reject(new Error("تعذر قراءة صورة الشعار بصيغة آمنة."));
      else resolve(result);
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة. اختر الملف مجدداً."));
    reader.readAsDataURL(file);
  });
}
