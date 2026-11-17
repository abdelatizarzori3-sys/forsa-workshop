import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { brandInputSchema, type Brand, type BrandInput } from "@shared/workspace";
import { errorMessage, type WorkspaceApi } from "./api";
import { fieldErrors, readLogo, type FieldErrors } from "./model";
import { Field, fieldA11y, Loading, Notice } from "./ui";

export function BrandView({ api, brand, loading, error, reload, onSaved, disabled }: { api: WorkspaceApi; brand: Brand | null; loading: boolean; error: string | null; reload: () => Promise<void>; onSaved: (brand: Brand) => void; disabled: boolean }) {
  const [input, setInput] = useState<BrandInput | null>(brand);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dirty) setInput(brand); }, [brand, dirty]);
  function update<K extends keyof BrandInput>(key: K, value: BrandInput[K]) { setInput(current => current ? { ...current, [key]: value } : null); setDirty(true); setNotice(null); }
  async function chooseLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true); setProblem(null);
    try { update("logoDataUrl", await readLogo(file)); }
    catch (e) { setProblem(errorMessage(e)); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const parsed = brandInputSchema.safeParse(input);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); return; }
    setBusy(true); setProblem(null); setNotice(null);
    try { const result = await api.saveBrand(parsed.data); onSaved(result.brand); setDirty(false); setErrors({}); setNotice("حُفظت هوية النشاط على الخادم. ستستخدم في ملفات PDF التالية."); }
    catch (e) { setProblem(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="ws-brand-title"><div className="ws-section-heading"><div><span className="ws-kicker">ملف العلامة</span><h1 id="ws-brand-title">عرض يبدو صادرًا عنك.</h1><p>بيانات الهوية محفوظة في حسابك، وتظهر في PDF للعميل. لا تظهر كلفة التنفيذ الداخلية في الملف.</p></div></div>{error && <Notice error retry={() => void reload()}>{error}</Notice>}{loading && <Loading />}{notice && <Notice>{notice}</Notice>}{problem && <Notice error>{problem}</Notice>}{input && <form onSubmit={save} noValidate className="ws-brand-form"><div className="ws-brand-logo"><div className="ws-logo-preview">{input.logoDataUrl ? <img src={input.logoDataUrl} alt="معاينة شعار نشاطك" /> : <ImagePlus size={38} />}</div><div><strong>شعار النشاط</strong><p>PNG أو JPEG حتى 500 كيلوبايت؛ أقصى أبعاد 2000 × 2000.</p><label className="ws-button ws-secondary">اختيار صورة<input type="file" accept="image/png,image/jpeg" aria-label="تحميل شعار النشاط" disabled={disabled || busy} onChange={e => void chooseLogo(e.target.files?.[0])} /></label>{input.logoDataUrl && <button className="ws-icon-button" type="button" aria-label="إزالة الشعار" disabled={disabled || busy} onClick={() => update("logoDataUrl", null)}><Trash2 size={17} /></button>}</div></div><div className="ws-form-grid"><Field label="اسم النشاط" name="brand-name" error={errors.businessName} wide><input {...fieldA11y("brand-name", errors.businessName)} value={input.businessName} maxLength={120} disabled={disabled} onChange={e => update("businessName", e.target.value)} /></Field><Field label="بريد التواصل (اختياري)" name="brand-email" error={errors.contactEmail}><input {...fieldA11y("brand-email", errors.contactEmail)} type="email" value={input.contactEmail} maxLength={254} disabled={disabled} onChange={e => update("contactEmail", e.target.value)} /></Field><Field label="هاتف التواصل (اختياري)" name="brand-phone" error={errors.contactPhone}><input {...fieldA11y("brand-phone", errors.contactPhone)} value={input.contactPhone} maxLength={60} disabled={disabled} onChange={e => update("contactPhone", e.target.value)} /></Field></div><div className="ws-form-actions"><button className="ws-button ws-primary" type="submit" disabled={disabled || busy || !dirty}><Save size={17} />{busy ? "جارٍ الحفظ…" : "حفظ الهوية"}</button><span className="ws-muted">{dirty ? "لديك تعديلات لم تُحفظ بعد." : "هذه البيانات هي آخر هوية مؤكدة من الخادم."}</span></div></form>}</section>;
}
