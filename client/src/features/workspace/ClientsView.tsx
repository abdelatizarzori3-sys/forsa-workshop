import { useState } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import type { Client, ClientInput, Offer, WorkspaceSession } from "@shared/workspace";
import { errorMessage, WorkspaceApiError, type WorkspaceApi } from "./api";
import { displayDate } from "./model";
import { ClientEditor } from "./ClientEditor";
import { ConfirmDelete, Loading, Notice } from "./ui";

export function ClientsView({ api, session, clients, offers, loading, error, reload, showOffers }: { api: WorkspaceApi; session: WorkspaceSession | null; clients: Client[]; offers: Offer[]; loading: boolean; error: string | null; reload: () => Promise<void>; showOffers: () => void }) {
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Client | ClientInput | null>(null);
  const [deletion, setDeletion] = useState<Client | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [referenced, setReferenced] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const filtered = clients.filter(client => `${client.name} ${client.email} ${client.phone} ${client.notes}`.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar")));
  async function save(input: ClientInput) {
    if (!session) throw new Error("سجّل الدخول قبل الحفظ.");
    if (editor && "id" in editor) await api.updateClient(editor.id, input);
    else await api.createClient(input);
    setEditor(null); setNotice("أكد الخادم حفظ العميل."); await reload();
  }
  async function remove() {
    if (!session || !deletion) return;
    setDeleteBusy(true); setDeleteError(null); setReferenced(false);
    try { await api.deleteClient(deletion.id); setDeletion(null); setNotice("أكد الخادم حذف العميل."); await reload(); }
    catch (error) { const linked = error instanceof WorkspaceApiError && error.status === 409; setReferenced(linked); setDeleteError(linked ? `${errorMessage(error)} افتح العروض المرتبطة وغيّر العميل إلى «دون عميل» أو إلى عميل آخر، ثم حاول الحذف.` : errorMessage(error)); }
    finally { setDeleteBusy(false); }
  }
  return <section aria-labelledby="ws-clients-title"><div className="ws-section-heading"><div><span className="ws-kicker">دفتر العلاقات</span><h1 id="ws-clients-title">عملاؤك، ببيانات واضحة.</h1><p>احتفظ بجهات التواصل الفعلية واربطها بالعروض.</p></div><button type="button" className="ws-button ws-primary" disabled={!session || loading} onClick={() => setEditor({ name: "", email: "", phone: "", notes: "" })}><Plus size={18} />عميل جديد</button></div>
    {notice && <Notice>{notice}</Notice>}{error && <Notice error retry={() => void reload()}>{error} {clients.length > 0 && "هذه آخر قائمة نجح تحميلها."}</Notice>}
    <div className="ws-toolbar"><div className="ws-search"><Search size={17} aria-hidden="true" /><input aria-label="البحث في العملاء" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="الاسم أو البريد أو الهاتف" /></div><button type="button" className="ws-button ws-secondary" disabled={loading} onClick={() => void reload()}>تحديث</button>{!loading && !error && <span className="ws-muted">{clients.length} عملاء محفوظون</span>}</div>
    {loading && <Loading />}{!loading && !error && clients.length === 0 && <div className="ws-empty"><Users size={34} /><h2>دفتر العملاء فارغ حتى الآن.</h2><p>أضف أول جهة حقيقية عندما تبدأ المحادثة معها.</p></div>}{clients.length > 0 && filtered.length === 0 && <div className="ws-empty"><h2>لا توجد نتائج مطابقة.</h2><button type="button" className="ws-button ws-secondary" onClick={() => setSearch("")}>مسح البحث</button></div>}
    <div className="ws-client-list">{filtered.map(client => <article key={client.id} className="ws-client"><div className="ws-client-heading"><span className="ws-client-monogram" aria-hidden="true">{client.name.slice(0, 1)}</span><div><h2>{client.name}</h2><span className="ws-muted">أضيف في {displayDate(client.createdAt)}</span></div></div><dl><div><dt>البريد</dt><dd><bdi>{client.email || "غير مضاف"}</bdi></dd></div><div><dt>الهاتف</dt><dd><bdi>{client.phone || "غير مضاف"}</bdi></dd></div><div><dt>العروض المرتبطة</dt><dd>{offers.filter(offer => offer.clientId === client.id).length}</dd></div></dl>{client.notes && <p className="ws-client-notes">{client.notes}</p>}<div className="ws-offer-actions"><button type="button" className="ws-button ws-secondary" onClick={() => setEditor(client)}><Pencil size={15} />تعديل</button><button type="button" className="ws-icon-button ws-delete-button" aria-label={`حذف العميل ${client.name}`} onClick={() => { setDeletion(client); setDeleteError(null); setReferenced(false); }}><Trash2 size={17} /></button></div></article>)}</div>
    {editor && <ClientEditor key={"id" in editor ? editor.id : "new"} initial={editor} editing={"id" in editor} open={!!session} onClose={() => setEditor(null)} onSave={save} />}
    {deletion && session && <ConfirmDelete title="حذف العميل نهائياً؟" description={`سيحذف سجل «${deletion.name}». يمنع الخادم الحذف إن كان مرتبطاً بعروض.`} error={deleteError} busy={deleteBusy} onCancel={() => setDeletion(null)} onConfirm={() => void remove()} />}
    {referenced && deletion && session && <div className="ws-linked-action"><button type="button" className="ws-button ws-secondary" onClick={() => { setDeletion(null); showOffers(); }}>افتح العروض لتغيير العميل المرتبط</button></div>}
  </section>;
}
