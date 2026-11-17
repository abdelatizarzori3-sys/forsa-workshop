import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Building2, FileText, LogIn, LogOut, ShieldCheck, Users, Zap } from "lucide-react";
import type { Brand, Client, Offer, WorkspaceSession } from "@shared/workspace";
import { createWorkspaceApi, errorMessage, WorkspaceApiError } from "./api";
import { canStartTrial, displayDate, hasActivePro } from "./model";
import { OffersView } from "./OffersView";
import { ClientsView } from "./ClientsView";
import { BrandView } from "./BrandView";
import { Loading, Notice } from "./ui";
import "./workspace.css";

type Tab = "offers" | "clients" | "brand";
export default function Workspace() {
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const ref = useRef<WorkspaceSession | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState<Tab>("offers");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const api = useMemo(() => createWorkspaceApi(() => ref.current?.csrfToken, () => setExpired(true)), []);
  const refreshSession = useCallback(async () => {
    try {
      const next = await api.session(); ref.current = next; setSession(next); setExpired(false); setAuthError(null);
    } catch (error) {
      if (!(error instanceof WorkspaceApiError && error.status === 401)) setAuthError(errorMessage(error));
      else if (!ref.current) { setSession(null); setAuthError(null); }
      else setExpired(true);
    } finally { setInitializing(false); }
  }, [api]);
  const reload = useCallback(async () => {
    if (!ref.current) return;
    setLoading(true); setDataError(null);
    try {
      const [o, c, b] = await Promise.all([api.offers(), api.clients(), api.brand()]);
      if (!Array.isArray(o.offers) || !Array.isArray(c.clients) || !b.brand) throw new Error("أعاد الخادم بيانات غير مكتملة. أعد تحميلها.");
      setOffers(o.offers); setClients(c.clients); setBrand(b.brand);
    } catch (error) { setDataError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void refreshSession(); }, [refreshSession]);
  useEffect(() => { if (session?.user.id) void reload(); }, [session?.user.id, reload]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  async function login() {
    setBusy(true); setAuthError(null); setActionError(null);
    try { const { url } = await api.login(window.location.origin); const target = new URL(url); if (target.protocol !== "https:" && target.hostname !== "localhost") throw new Error("رابط الدخول غير صالح."); window.location.assign(url); }
    catch (error) { setAuthError(errorMessage(error)); setBusy(false); }
  }
  async function logout() {
    setBusy(true); setActionError(null);
    try { await api.logout(); ref.current = null; setSession(null); setOffers([]); setClients([]); setBrand(null); setExpired(false); setTab("offers"); }
    catch (error) { setActionError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  async function trial() {
    setBusy(true); setActionError(null);
    try { await api.trial(); await refreshSession(); }
    catch (error) { setActionError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  const active = !expired && hasActivePro(session?.plan, clock);
  if (initializing) return <main className="ws-root ws-auth" dir="rtl"><Loading label="جارٍ التحقق من جلسة الحساب…" /></main>;
  if (!session) return <main className="ws-root ws-auth" dir="rtl"><a href="/" className="ws-wordmark"><img src="/forsa-icon.svg" alt="" />فرصة <span>برو</span></a><section className="ws-auth-card"><span className="ws-kicker">مساحة العمل، لا صفحة وعود</span><h1>عرض محفوظ.<br />عميل واضح. وملف جاهز.</h1><p>سجّل الدخول لتنشئ عروضك وتربطها بعملائك. تُحفظ بياناتك في حسابك على الخادم، وليست على هذا الجهاز وحده.</p><div className="ws-auth-benefits"><span><FileText size={18} />ثلاثة عروض محفوظة في المجاني</span><span><Users size={18} />دفتر عملاء وبيانات تواصل</span><span><ShieldCheck size={18} />تجربة PDF مجانية لبرو، سبعة أيام</span></div>{authError && <Notice error retry={() => void refreshSession()}>{authError}</Notice>}<button className="ws-button ws-primary ws-login" onClick={() => void login()} disabled={busy}><LogIn size={18} />{busy ? "جارٍ فتح تسجيل الدخول…" : "المتابعة بحساب Manus"}</button><p className="ws-fine">لا تُنشأ جلسة وهمية. التجربة اختيارية وبدون بطاقة؛ شراء الاشتراك المدفوع غير مفعّل في هذه النسخة.</p><a href="/" className="ws-back">العودة إلى ورشة التسعير المجانية <ArrowLeft size={15} /></a></section></main>;
  const tabs = [{ id: "offers" as Tab, label: "العروض", icon: FileText }, { id: "clients" as Tab, label: "العملاء", icon: Users }, { id: "brand" as Tab, label: "هوية النشاط", icon: Building2 }];
  return <main className="ws-root ws-layout" dir="rtl"><aside className="ws-sidebar"><a href="/workspace" className="ws-wordmark"><img src="/forsa-icon.svg" alt="" />فرصة <span>برو</span></a><p className="ws-sidebar-caption">من عرضك الأول إلى عمل منظم.</p><nav aria-label="مساحة العمل">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} className={tab === id ? "ws-nav-active" : ""} onClick={() => setTab(id)}><Icon size={18} />{label}</button>)}</nav><a href="/" className="ws-workshop-link">ورشة التسعير المجانية <ArrowLeft size={16} /></a><div className="ws-account"><strong>{session.user.name}</strong><bdi>{session.user.email}</bdi><button type="button" className="ws-button ws-sidebar-logout" disabled={busy} onClick={() => void logout()}><LogOut size={15} />تسجيل الخروج</button></div></aside><div className="ws-main"><header className="ws-topbar"><span><span className="ws-live-dot" />حفظ خاص بحسابك على الخادم</span><span className={`ws-plan-badge ${active ? "ws-plan-active" : ""}`}>{active ? "تجربة برو مجانية" : "الخطة المجانية"}</span></header>
    {expired && <Notice error>انتهت الجلسة. احتفظ بنص التعديلات قبل الانتقال إلى الدخول. <button type="button" className="ws-button ws-secondary" disabled={busy} onClick={() => void login()}>تسجيل الدخول مجدداً</button></Notice>}
    {authError && <Notice error retry={() => void refreshSession()}>{authError}</Notice>}{actionError && <Notice error>{actionError}</Notice>}
    <section className="ws-trial-banner" aria-label="حالة برو"><div><Zap size={21} /><div><strong>{active ? `تجربتك صالحة حتى ${displayDate(session.plan.expiresAt)}` : session.plan.trialUsed ? "انتهت التجربة؛ بياناتك المحفوظة باقية." : "جرّب تصدير PDF باسمك وشعارك."}</strong><p>{active ? "PDF وعروض إضافية خلال التجربة. لا توجد رسوم أو تجديد تلقائي." : session.plan.trialUsed ? "يمكنك قراءة وتعديل العروض السابقة. التحصيل المدفوع لم يُفعّل بعد." : "سبعة أيام مجاناً، مرة واحدة لهذا الحساب وبدون بطاقة."}</p></div></div>{canStartTrial(session.plan) && <button type="button" className="ws-button ws-primary" disabled={busy || expired} onClick={() => void trial()}>{busy ? "جارٍ التفعيل…" : "ابدأ التجربة المجانية"}</button>}</section>
    {tab === "offers" && <OffersView api={api} session={expired ? null : session} offers={offers} clients={clients} loading={loading} error={dataError} reload={reload} onChanged={() => void refreshSession()} />}
    {tab === "clients" && <ClientsView api={api} session={expired ? null : session} clients={clients} offers={offers} loading={loading} error={dataError} reload={reload} showOffers={() => setTab("offers")} />}
    {tab === "brand" && <BrandView api={api} brand={brand} loading={loading} error={dataError} reload={reload} onSaved={setBrand} disabled={expired} />}
    <footer className="ws-footer">فرصة — قيمة العروض وهامشها معلومات تخطيطية، وليست إثبات دفع أو ضمان دخل.</footer>
  </div></main>;
}
