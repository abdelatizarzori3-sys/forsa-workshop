import { useState, type FormEvent } from "react";
import { currencies, formatMoney, offerInputSchema, offerStatuses, offerTotals, offerUpdateSchema, statusLabels, type Client, type Offer, type OfferInput } from "@shared/workspace";
import { errorMessage, WorkspaceApiError } from "./api";
import { fieldErrors, type FieldErrors } from "./model";
import { EditorDialog, Field, fieldA11y, Notice } from "./ui";

type Props = { initial: OfferInput | Offer; clients: Client[]; open: boolean; onClose: () => void; onSave: (input: OfferInput, version?: number) => Promise<void>; onReload: () => Promise<Offer | undefined> };
export function OfferEditor({ initial, clients, open, onClose, onSave, onReload }: Props) {
  const [input, setInput] = useState<OfferInput>(() => ({ title: initial.title, description: initial.description, clientId: initial.clientId, amount: initial.amount, cost: initial.cost, currency: initial.currency, status: initial.status, validUntil: initial.validUntil }));
  const [version, setVersion] = useState("version" in initial ? initial.version : undefined);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [latest, setLatest] = useState<Offer | null>(null);
  const [dirty, setDirty] = useState(false);
  const totals = offerTotals(input);
  function update<K extends keyof OfferInput>(key: K, value: OfferInput[K]) { setInput(current => ({ ...current, [key]: value })); setDirty(true); setErrors(current => ({ ...current, [key]: "" })); }
  function close() { if (!dirty || window.confirm("لديك تعديلات غير محفوظة. هل تريد إغلاق النموذج والتخلي عنها؟")) onClose(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = version === undefined ? offerInputSchema.safeParse(input) : offerUpdateSchema.safeParse({ ...input, expectedVersion: version });
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); setProblem("راجع الحقول المشار إليها قبل الحفظ."); return; }
    if (stale) { setProblem("حمّل النسخة الحالية وراجعها قبل محاولة الحفظ مجدداً."); return; }
    setBusy(true); setProblem(null);
    try { const validated = offerInputSchema.parse(input); await onSave(validated, version); }
    catch (error) { setProblem(errorMessage(error)); if (error instanceof WorkspaceApiError && error.status === 409) setStale(true); }
    finally { setBusy(false); }
  }
  async function reload() {
    setBusy(true);
    try { const offer = await onReload(); if (!offer) throw new Error("هذا العرض لم يعد موجوداً. احتفظ بالنص وأنشئ عرضاً جديداً إذا لزم."); setLatest(offer); }
    catch (error) { setProblem(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <EditorDialog open={open} onClose={close} busy={busy} title={version === undefined ? "عرض جديد" : "تعديل العرض"} description="اكتب نطاقاً واضحاً وسعراً فعلياً. لا يُحفظ شيء قبل تأكيد الخادم."><form onSubmit={submit} noValidate className="ws-form">
    {problem && <Notice error>{problem}</Notice>}
    {stale && <div className="ws-stale"><strong>تغيّر العرض في جلسة أخرى.</strong><p>تعديلاتك محفوظة في هذا النموذج، ولم نكتب فوق النسخة الأحدث.</p><button type="button" className="ws-button ws-secondary" disabled={busy} onClick={reload}>تحميل النسخة الحالية للمراجعة</button>{latest && <div><p>النسخة {latest.version}: {latest.title} — {formatMoney(latest.amount, latest.currency)} — {statusLabels[latest.status]}</p><details><summary>نطاق العمل في النسخة الحالية</summary><p className="ws-prewrap">{latest.description}</p></details><button type="button" className="ws-button ws-secondary" onClick={() => { setVersion(latest.version); setStale(false); setProblem(null); setLatest(null); }}>راجعت النسخة؛ احتفظ بتعديلاتي واعتمد رقمها للحفظ التالي</button></div>}</div>}
    <div className="ws-form-grid">
      <Field label="عنوان العرض" name="offer-title" error={errors.title} wide><input {...fieldA11y("offer-title", errors.title)} value={input.title} maxLength={160} onChange={e => update("title", e.target.value)} autoFocus /></Field>
      <Field label="نطاق العمل والوصف" name="offer-description" error={errors.description} wide><textarea {...fieldA11y("offer-description", errors.description)} rows={5} maxLength={6000} value={input.description} onChange={e => update("description", e.target.value)} /></Field>
      <Field label="العميل (اختياري)" name="offer-client" error={errors.clientId}><select {...fieldA11y("offer-client", errors.clientId)} value={input.clientId ?? ""} onChange={e => update("clientId", e.target.value || null)}><option value="">دون عميل</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
      <Field label="حالة العرض" name="offer-status" error={errors.status} hint="تسجيل الحالة لا يرسل رسالة للعميل ولا يثبت دفعاً."><select {...fieldA11y("offer-status", errors.status, true)} value={input.status} onChange={e => update("status", e.target.value as OfferInput["status"])}>{offerStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></Field>
      <Field label="قيمة العرض" name="offer-amount" error={errors.amount}><input {...fieldA11y("offer-amount", errors.amount)} type="number" min="0" max="1000000" step="0.01" value={Number.isNaN(input.amount) ? "" : input.amount} onChange={e => update("amount", e.target.value === "" ? NaN : Number(e.target.value))} /></Field>
      <Field label="كلفة التنفيذ" name="offer-cost" error={errors.cost}><input {...fieldA11y("offer-cost", errors.cost)} type="number" min="0" max="1000000" step="0.01" value={Number.isNaN(input.cost) ? "" : input.cost} onChange={e => update("cost", e.target.value === "" ? NaN : Number(e.target.value))} /></Field>
      <Field label="العملة" name="offer-currency" error={errors.currency}><select {...fieldA11y("offer-currency", errors.currency)} value={input.currency} onChange={e => update("currency", e.target.value as OfferInput["currency"])}>{currencies.map(currency => <option key={currency}>{currency}</option>)}</select></Field>
      <Field label="صالح حتى (اختياري)" name="offer-valid" error={errors.validUntil}><input {...fieldA11y("offer-valid", errors.validUntil)} type="date" value={input.validUntil ?? ""} onChange={e => update("validUntil", e.target.value || null)} /></Field>
    </div>
    <div className="ws-calculation"><span>الفرق بعد الكلفة: <strong>{Number.isFinite(totals.net) ? formatMoney(totals.net, input.currency) : "—"}</strong></span><span>الهامش: <strong>{totals.margin === null || !Number.isFinite(totals.margin) ? "غير محدد" : `${totals.margin}%`}</strong></span><small>حساب تخطيطي، وليس إيراداً محصّلاً.</small></div>
    {"createdAt" in initial && <p className="ws-muted">تاريخ الإنشاء: {new Date(initial.createdAt).toLocaleDateString("ar")} — الإصدار الحالي للنموذج: {version}</p>}
    <div className="ws-form-actions"><button className="ws-button ws-primary" type="submit" disabled={busy || stale}>{busy ? "جارٍ الحفظ…" : "حفظ العرض"}</button><button className="ws-button ws-secondary" type="button" disabled={busy} onClick={close}>إلغاء</button></div>
  </form></EditorDialog>;
}
