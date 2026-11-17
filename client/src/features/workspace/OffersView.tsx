import { useMemo, useState } from "react";
import { FileDown, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { currencies, formatMoney, offerStatuses, offerTotals, statusLabels, type Client, type Offer, type OfferInput, type WorkspaceSession } from "@shared/workspace";
import { downloadPdf, errorMessage, type WorkspaceApi } from "./api";
import { displayDate, hasActivePro, newOfferFromQuery, totalsByCurrency } from "./model";
import { OfferEditor } from "./OfferEditor";
import { ConfirmDelete, Loading, Notice } from "./ui";

type Props = { api: WorkspaceApi; session: WorkspaceSession | null; offers: Offer[]; clients: Client[]; loading: boolean; error: string | null; reload: () => Promise<void>; onChanged: () => void };
export function OffersView({ api, session, offers, clients, loading, error, reload, onChanged }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<Offer | OfferInput | null>(() => new URLSearchParams(window.location.search).has("title") ? newOfferFromQuery(window.location.search) : null);
  const [deletion, setDeletion] = useState<Offer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const activePro = hasActivePro(session?.plan);
  const limit = session?.plan.freeOfferLimit ?? 3;
  const limitReached = !activePro && offers.length >= limit;
  const clientNames = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients]);
  const filtered = offers.filter(offer => (filter === "all" || offer.status === filter) && `${offer.title} ${offer.description} ${clientNames.get(offer.clientId ?? "") ?? ""}`.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar")));
  const totals = totalsByCurrency(offers);
  async function save(input: OfferInput, version?: number) {
    if (!session) throw new Error("سجّل الدخول قبل الحفظ.");
    if (editor && "id" in editor) await api.updateOffer(editor.id, { ...input, expectedVersion: version! });
    else await api.createOffer(input);
    setEditor(null); setNotice("أكد الخادم حفظ العرض."); setOperationError(null);
    await reload(); onChanged();
  }
  async function remove() {
    if (!deletion || !session) return;
    setDeleteBusy(true); setDeleteError(null);
    try { await api.deleteOffer(deletion.id); setDeletion(null); setNotice("أكد الخادم حذف العرض."); await reload(); onChanged(); }
    catch (problem) { setDeleteError(errorMessage(problem)); }
    finally { setDeleteBusy(false); }
  }
  async function pdf(offer: Offer) {
    setPdfBusy(offer.id); setOperationError(null);
    try { const blob = await api.pdf(offer.id); downloadPdf(blob, offer.title); setNotice("وصل ملف PDF من الخادم وبدأ تنزيله."); }
    catch (problem) { setOperationError(errorMessage(problem)); }
    finally { setPdfBusy(null); }
  }
  return <section aria-labelledby="ws-offers-title">
    <div className="ws-section-heading"><div><span className="ws-kicker">دفتر العروض</span><h1 id="ws-offers-title">عروضك، من المسودة إلى القرار.</h1><p>بيانات حسابك المحفوظة على الخادم. الحالة لا تعني تحصيل دفعة.</p></div><button className="ws-button ws-primary" type="button" disabled={loading || limitReached || !session} onClick={() => setEditor(newOfferFromQuery(""))}><Plus size={18} />عرض جديد</button></div>
    <div className="ws-summary"><div><span>العروض المحفوظة</span><strong>{offers.length}</strong></div><div><span>العروض المقبولة</span><strong>{offers.filter(offer => offer.status === "accepted").length}</strong></div><div className="ws-value-summary"><span>إجمالي قيم العروض (ليس إيراداً)</span><strong>{offers.length ? currencies.filter(currency => totals[currency] !== undefined).map(currency => <span key={currency}>{formatMoney(totals[currency]!, currency)}</span>) : "—"}</strong></div></div>
    {!activePro && <div className="ws-limit"><div><span>الخطة المجانية: {offers.length} من {limit} عروض</span><span>{limitReached ? "وصلت إلى الحد؛ عدّل عروضك الحالية أو استخدم التجربة إن كانت متاحة." : `يمكنك حفظ ${Math.max(0, limit - offers.length)} عروض إضافية.`}</span></div><progress max={limit} value={Math.min(offers.length, limit)} aria-label="استخدام حد العروض المجانية" /></div>}
    {notice && <Notice>{notice}</Notice>}{operationError && <Notice error>{operationError}</Notice>}{error && <Notice error retry={() => void reload()}>{error} {offers.length > 0 && "القائمة الظاهرة هي آخر بيانات نجح تحميلها."}</Notice>}
    <div className="ws-toolbar"><div className="ws-search"><Search size={17} aria-hidden="true" /><input aria-label="البحث في عروضك" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو العميل أو النطاق" /></div><select aria-label="تصفية حسب حالة العرض" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">كل الحالات</option>{offerStatuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><button className="ws-button ws-secondary" type="button" onClick={() => void reload()} disabled={loading}>تحديث</button></div>
    {loading && <Loading />}
    {!loading && !error && !offers.length && <div className="ws-empty"><FileText size={34} /><h2>لا توجد عروض محفوظة بعد.</h2><p>ابدأ بعرض حقيقي: نطاق واضح، عميل اختياري، وقيمة قابلة للتنفيذ.</p><button className="ws-button ws-primary" type="button" onClick={() => setEditor(newOfferFromQuery(""))}>أنشئ عرضك الأول</button></div>}
    {!loading && offers.length > 0 && filtered.length === 0 && <div className="ws-empty"><h2>لا توجد نتائج مطابقة.</h2><button type="button" className="ws-button ws-secondary" onClick={() => { setSearch(""); setFilter("all"); }}>مسح البحث والتصفية</button></div>}
    <div className="ws-offer-list">{filtered.map(offer => { const total = offerTotals(offer); return <article key={offer.id} className="ws-offer"><div className="ws-offer-head"><div><span className={`ws-status ws-status-${offer.status}`}>{statusLabels[offer.status]}</span><h2>{offer.title}</h2><p>{offer.clientId ? clientNames.get(offer.clientId) ?? "عميل مرتبط" : "دون عميل"}</p></div><strong className="ws-offer-amount">{formatMoney(offer.amount, offer.currency)}</strong></div><p className="ws-offer-description">{offer.description}</p><dl className="ws-offer-details"><div><dt>الكلفة</dt><dd>{formatMoney(offer.cost, offer.currency)}</dd></div><div><dt>الفرق / الهامش</dt><dd className={total.net < 0 ? "ws-negative" : ""}>{formatMoney(total.net, offer.currency)} / {total.margin === null ? "غير محدد" : `${total.margin}%`}</dd></div><div><dt>تاريخ الإنشاء</dt><dd>{displayDate(offer.createdAt)}</dd></div><div><dt>صالح حتى</dt><dd>{displayDate(offer.validUntil)}</dd></div></dl><div className="ws-offer-actions"><button type="button" className="ws-button ws-secondary" onClick={() => setEditor(offer)}><Pencil size={15} />فتح وتعديل</button><button type="button" className="ws-button ws-secondary" disabled={!activePro || !!pdfBusy} title={!activePro ? "يتطلب تجربة برو صالحة" : "تنزيل PDF من الخادم"} onClick={() => void pdf(offer)}><FileDown size={16} />{pdfBusy === offer.id ? "جارٍ التنزيل…" : "تنزيل PDF"}{!activePro && <small>برو</small>}</button><button type="button" className="ws-icon-button ws-delete-button" aria-label={`حذف العرض ${offer.title}`} onClick={() => { setDeletion(offer); setDeleteError(null); }}><Trash2 size={17} /></button><span className="ws-muted">آخر تعديل: {displayDate(offer.updatedAt)}</span></div></article>; })}</div>
    {editor && <OfferEditor key={"id" in editor ? editor.id : "new"} initial={editor} clients={clients} open={!!session} onClose={() => setEditor(null)} onSave={save} onReload={async () => { const result = await api.offers(); await reload(); return "id" in editor ? result.offers.find(offer => offer.id === editor.id) : undefined; }} />}
    {deletion && session && <ConfirmDelete title="حذف هذا العرض؟" description={`سيحذف العرض «${deletion.title}» من حسابك نهائياً. لا يمكن التراجع.`} busy={deleteBusy} error={deleteError} onCancel={() => setDeletion(null)} onConfirm={() => void remove()} />}
  </section>;
}
