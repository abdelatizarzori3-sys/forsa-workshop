import { useState, type FormEvent } from "react";
import { clientInputSchema, type ClientInput } from "@shared/workspace";
import { errorMessage } from "./api";
import { fieldErrors, type FieldErrors } from "./model";
import { EditorDialog, Field, fieldA11y, Notice } from "./ui";

export function ClientEditor({ initial, open, editing, onClose, onSave }: { initial: ClientInput; open: boolean; editing: boolean; onClose: () => void; onSave: (input: ClientInput) => Promise<void> }) {
  const [input, setInput] = useState<ClientInput>({ name: initial.name, email: initial.email, phone: initial.phone, notes: initial.notes });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  function update(key: keyof ClientInput, value: string) { setInput(current => ({ ...current, [key]: value })); setDirty(true); setErrors(current => ({ ...current, [key]: "" })); }
  function close() { if (!dirty || window.confirm("تعديلات العميل غير محفوظة. هل تريد التخلي عنها؟")) onClose(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = clientInputSchema.safeParse(input);
    if (!parsed.success) { setErrors(fieldErrors(parsed.error)); setProblem("راجع حقول العميل قبل الحفظ."); return; }
    setBusy(true); setProblem(null);
    try { await onSave(parsed.data); }
    catch (error) { setProblem(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return <EditorDialog open={open} onClose={close} busy={busy} title={editing ? "تعديل العميل" : "عميل جديد"} description="سجل بيانات جهة تتعامل معها فعلياً. لا يرسل حفظها أي رسالة."><form onSubmit={submit} className="ws-form" noValidate>{problem && <Notice error>{problem}</Notice>}<div className="ws-form-grid">
    <Field label="اسم العميل" name="client-name" error={errors.name} wide><input {...fieldA11y("client-name", errors.name)} maxLength={120} value={input.name} onChange={e => update("name", e.target.value)} autoFocus /></Field>
    <Field label="البريد الإلكتروني (اختياري)" name="client-email" error={errors.email}><input {...fieldA11y("client-email", errors.email)} type="email" maxLength={254} value={input.email} dir="ltr" onChange={e => update("email", e.target.value)} /></Field>
    <Field label="الهاتف (اختياري)" name="client-phone" error={errors.phone}><input {...fieldA11y("client-phone", errors.phone)} type="tel" maxLength={60} value={input.phone} dir="ltr" onChange={e => update("phone", e.target.value)} /></Field>
    <Field label="ملاحظات (اختياري)" name="client-notes" error={errors.notes} wide><textarea {...fieldA11y("client-notes", errors.notes)} rows={4} maxLength={3000} value={input.notes} onChange={e => update("notes", e.target.value)} /></Field>
  </div><div className="ws-form-actions"><button type="submit" className="ws-button ws-primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ العميل"}</button><button type="button" className="ws-button ws-secondary" disabled={busy} onClick={close}>إلغاء</button></div></form></EditorDialog>;
}
