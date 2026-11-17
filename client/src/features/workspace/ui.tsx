import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertCircle, LoaderCircle, X } from "lucide-react";

export function Notice({ children, error = false, retry }: { children: ReactNode; error?: boolean; retry?: () => void }) {
  return <div className={`ws-notice ${error ? "ws-notice-error" : ""}`} role={error ? "alert" : "status"}><AlertCircle size={17} aria-hidden="true" /><div>{children}</div>{retry && <button type="button" className="ws-button ws-secondary" onClick={retry}>إعادة المحاولة</button>}</div>;
}
export function Loading({ label = "جارٍ تحميل البيانات…" }: { label?: string }) {
  return <div className="ws-loading" role="status"><LoaderCircle className="ws-spin" size={20} aria-hidden="true" />{label}</div>;
}
export function Field({ label, name, error, children, hint, wide = false }: { label: string; name: string; error?: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <div className={`ws-field ${wide ? "ws-field-wide" : ""}`}><label htmlFor={name}>{label}</label>{children}{hint && <small id={`${name}-hint`}>{hint}</small>}{error && <span className="ws-field-error" id={`${name}-error`} role="alert">{error}</span>}</div>;
}
export function fieldA11y(name: string, error?: string, hint = false) {
  return { id: name, "aria-invalid": !!error, "aria-describedby": [error ? `${name}-error` : "", hint ? `${name}-hint` : ""].filter(Boolean).join(" ") || undefined };
}
export function EditorDialog({ open, onClose, title, description, children, busy = false }: { open: boolean; onClose: () => void; title: string; description: string; children: ReactNode; busy?: boolean }) {
  return <Dialog.Root open={open} onOpenChange={next => { if (!next && !busy) onClose(); }}><Dialog.Portal><Dialog.Overlay className="ws-dialog-overlay" /><Dialog.Content dir="rtl" className="ws-dialog ws-root" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}><div className="ws-dialog-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close disabled={busy} className="ws-icon-button" aria-label="إغلاق النموذج"><X size={20} /></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function ConfirmDelete({ title, description, busy, error, onCancel, onConfirm }: { title: string; description: string; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void }) {
  return <EditorDialog open title={title} description={description} onClose={onCancel} busy={busy}>{error && <Notice error>{error}</Notice>}<div className="ws-form-actions"><button className="ws-button ws-danger" type="button" disabled={busy} onClick={onConfirm}>{busy ? "جارٍ الحذف…" : "نعم، احذف نهائياً"}</button><button className="ws-button ws-secondary" type="button" disabled={busy} onClick={onCancel}>إلغاء</button></div></EditorDialog>;
}
