/**
 * أسلوب «ورشة الفرص»: واجهة عربية عملية، دافئة، ومباشرة؛ أولوية الفعل والخطوة التالية.
 * الألوان: عاجي ورقي، حبر فحمي، وليمون ورشي للاختيارات والإنجاز فقط.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clipboard,
  Copy,
  Crosshair,
  FileText,
  Flame,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Target,
  TimerReset,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const heroImage = "/manus-storage/forsa-workbench-hero_fb023edf.png";
const kitImage = "/manus-storage/forsa-service-kit_a1543a8c.png";
const actionImage = "/manus-storage/forsa-action-path_5d99cb0e.png";
const brandMark = "/manus-storage/forsa-mark_9f7dfcd0.png";

type Offer = {
  id: string;
  title: string;
  detail: string;
  price: number;
  duration: string;
  demand: string;
  color: string;
  pitch: string;
};

const offers: Offer[] = [
  {
    id: "social",
    title: "حزمة منشورات سريعة",
    detail: "6 منشورات قابلة للنشر لنشاط محلي",
    price: 150,
    duration: "24 ساعة",
    demand: "مطلوبة دائماً",
    color: "var(--workshop-lime)",
    pitch: "أصمّم لك ستة منشورات متناسقة، جاهزة للنشر، خلال 24 ساعة — مع تعديل واحد ضمن السعر.",
  },
  {
    id: "catalog",
    title: "وصف منتجات مقنع",
    detail: "10 أوصاف قصيرة ومنظمة للمتجر",
    price: 120,
    duration: "يوم واحد",
    demand: "سهل البدء",
    color: "#F2B36D",
    pitch: "أعيد كتابة أوصاف 10 منتجات بلغة واضحة تساعد العميل على فهم القيمة واتخاذ القرار.",
  },
  {
    id: "reels",
    title: "تحرير فيديو قصير",
    detail: "فيديو رأسي واحد بمقاس Reels أو TikTok",
    price: 180,
    duration: "48 ساعة",
    demand: "نمو سريع",
    color: "#E88F78",
    pitch: "أحوّل موادك الخام إلى فيديو قصير متماسك مع قصّ وإيقاع وعناوين مرئية بسيطة.",
  },
];

const taskLabels = [
  "اختر نشاطاً محلياً واحداً يناسب الخدمة.",
  "انسخ العرض وأضف اسماً حقيقياً قبل الإرسال.",
  "أرسل العرض إلى 5 جهات منضبطة فقط.",
];

function currencyNumber(value: number, currency: string) {
  return new Intl.NumberFormat("ar", { maximumFractionDigits: 0 }).format(value) + " " + currency;
}

export default function Home() {
  const [offerId, setOfferId] = useState("social");
  const [price, setPrice] = useState(150);
  const [cost, setCost] = useState(15);
  const [target, setTarget] = useState(600);
  const [currency, setCurrency] = useState("ر.س");
  const [tasks, setTasks] = useState<boolean[]>([false, false, false]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeStation, setActiveStation] = useState("dashboard");

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === offerId) ?? offers[0],
    [offerId],
  );
  const netProfit = Math.max(price - cost, 0);
  const margin = price > 0 ? Math.round((netProfit / price) * 100) : 0;
  const ordersNeeded = netProfit > 0 ? Math.ceil(target / netProfit) : 0;
  const completion = Math.round((tasks.filter(Boolean).length / taskLabels.length) * 100);
  const remainingTasks = taskLabels.length - tasks.filter(Boolean).length;

  useEffect(() => {
    const raw = window.localStorage.getItem("forsa-workbench-state");
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as {
        offerId?: string;
        price?: number;
        cost?: number;
        target?: number;
        currency?: string;
        tasks?: boolean[];
      };
      if (stored.offerId && offers.some((offer) => offer.id === stored.offerId)) setOfferId(stored.offerId);
      if (typeof stored.price === "number") setPrice(stored.price);
      if (typeof stored.cost === "number") setCost(stored.cost);
      if (typeof stored.target === "number") setTarget(stored.target);
      if (typeof stored.currency === "string") setCurrency(stored.currency);
      if (Array.isArray(stored.tasks) && stored.tasks.length === taskLabels.length) setTasks(stored.tasks);
    } catch {
      window.localStorage.removeItem("forsa-workbench-state");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "forsa-workbench-state",
      JSON.stringify({ offerId, price, cost, target, currency, tasks }),
    );
  }, [offerId, price, cost, target, currency, tasks]);

  useEffect(() => {
    const stations = ["dashboard", "offers", "calculator", "plan"];
    const observed = stations
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveStation(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -56% 0px", threshold: [0.12, 0.35, 0.6] },
    );
    observed.forEach((station) => observer.observe(station));
    return () => observer.disconnect();
  }, []);

  const proposalText = `مرحباً،\n\n${selectedOffer.pitch}\n\nالسعر المقترح: ${currencyNumber(price, currency)}.\nمدة التسليم: ${selectedOffer.duration}.\n\nإذا كانت هذه النتيجة تناسب احتياجكم، أرسل لي التفاصيل لنبدأ اليوم.`;

  function chooseOffer(offer: Offer) {
    setOfferId(offer.id);
    setPrice(offer.price);
    toast.success("تم تجهيز عرض الخدمة", { description: `${offer.title} — نقطة بداية قابلة للتعديل.` });
  }

  async function copyProposal() {
    try {
      await navigator.clipboard.writeText(proposalText);
      toast.success("تم نسخ العرض", { description: "راجعه وأضف اسم الجهة قبل الإرسال." });
    } catch {
      toast.message("انسخ النص يدوياً", { description: "قد يمنع المتصفح النسخ التلقائي في هذه الجلسة." });
    }
  }

  function toggleTask(index: number, checked: boolean) {
    setTasks((current) => current.map((task, taskIndex) => (taskIndex === index ? checked : task)));
  }

  function scrollTo(id: string) {
    setActiveStation(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }

  const navigation = [
    { label: "لوحة اليوم", icon: LayoutDashboard, target: "dashboard" },
    { label: "خدمة واحدة", icon: Sparkles, target: "offers" },
    { label: "آلة التسعير", icon: Calculator, target: "calculator" },
    { label: "خطة التنفيذ", icon: Target, target: "plan" },
  ];

  return (
    <main dir="rtl" className="workshop-shell">
      <aside className="workshop-sidebar" aria-label="التنقل الرئيسي">
        <div className="brand-block">
          <img src={brandMark} alt="علامة فرصة" className="brand-mark" />
          <span className="brand-name">فرصة</span>
        </div>
        <p className="sidebar-caption">ورشة بيع الخدمات</p>

        <nav className="nav-stack">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.target}
                type="button"
                onClick={() => scrollTo(item.target)}
                className={activeStation === item.target ? "nav-item nav-item-active" : "nav-item"}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{item.label}</span>
                {activeStation === item.target && <span className="nav-dot" />}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="mini-status"><span /> محفوظ تلقائياً</div>
          <p>بياناتك تبقى على هذا الجهاز.</p>
        </div>
      </aside>

      <div className="mobile-bar">
        <div className="brand-block">
          <img src={brandMark} alt="علامة فرصة" className="brand-mark" />
          <span className="brand-name">فرصة</span>
        </div>
        <Button variant="outline" size="icon" className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="فتح القائمة">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
        {menuOpen && (
          <div className="mobile-menu">
            {navigation.map((item) => {
              const Icon = item.icon;
              return <button type="button" key={item.target} onClick={() => scrollTo(item.target)}><Icon size={17} />{item.label}</button>;
            })}
          </div>
        )}
      </div>

      <section className="workshop-main">
        <header className="topline">
          <div>
            <p className="eyebrow"><span className="eyebrow-dot" /> الأربعاء، 27 أغسطس</p>
            <h1>مرحباً بك في <strong>ورشة اليوم.</strong></h1>
          </div>
          <div className="topline-tools">
            <span className="location-note">ركّز على عرض واحد فقط</span>
            <button type="button" className="avatar-button" aria-label="حسابك">م</button>
          </div>
        </header>

        <section className="station-rail" aria-label="مسار محطات الورشة">
          <div className="station-brand"><img src={brandMark} alt="" /><span>فرصة <small>مسار التشغيل</small></span></div>
          {[
            { id: "offers", number: "01", label: "حدّد خدمتك" },
            { id: "calculator", number: "02", label: "ثبّت سعرك" },
            { id: "plan", number: "03", label: "أرسل عرضك" },
          ].map((station, index) => {
            const isCurrent = activeStation === station.id || (activeStation === "dashboard" && index === 0);
            const isComplete = (activeStation === "calculator" && index === 0) || activeStation === "plan" && index < 2;
            return (
              <button type="button" key={station.id} onClick={() => scrollTo(station.id)} className={isCurrent ? "station-step station-current" : isComplete ? "station-step station-complete" : "station-step"}>
                <span>{isComplete ? <Check size={14} /> : station.number}</span><strong>{station.label}</strong>
              </button>
            );
          })}
        </section>

        <section id="dashboard" className="arrival-grid" aria-labelledby="today-title">
          <article className="arrival-message">
            <div className="paper-label label-tilt-right"><Flame size={15} fill="currentColor" /> محطة الانطلاق</div>
            <div className="hero-identity"><img src={brandMark} alt="" /><span>فرصة <i>/ ورشة بيع الخدمات</i></span></div>
            <h2 id="today-title">حدّد خدمة واحدة.<br />اعرضها <em>اليوم.</em></h2>
            <p>ابدأ بعرض صغير واضح، ثم استخدم التسعير والخطة أدناه لتحويله إلى رسالة جاهزة للإرسال.</p>
            <Button onClick={() => scrollTo("offers")} className="primary-action">
              اختر خدمتك <ArrowLeft size={18} />
            </Button>
            <div className="hero-ruler" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div>
          </article>
          <article className="arrival-visual" aria-label="مشهد ورشة عمل">
            <img src={heroImage} alt="عدة عمل مكتبية بأوراق ومفكرة وحاسبة" />
            <div className="image-stamp"><span>01</span><small>ابدأ<br />بسيطاً</small></div>
          </article>
        </section>

        <section className="section-heading" aria-labelledby="offers-heading">
          <div>
            <span className="section-number">01</span>
            <h2 id="offers-heading">اختر عرضاً قابلاً للبيع</h2>
            <p>نماذج بداية عملية؛ عدّل السعر والوصف بما يناسب مهارتك الفعلية.</p>
          </div>
          <span className="paper-note">الدقة قبل الكثرة</span>
        </section>

        <section id="offers" className="offers-layout">
          <div className="offer-cards">
            {offers.map((offer, index) => {
              const active = selectedOffer.id === offer.id;
              return (
                <button
                  type="button"
                  key={offer.id}
                  onClick={() => chooseOffer(offer)}
                  className={active ? "offer-card offer-card-active" : "offer-card"}
                  aria-pressed={active}
                >
                  <span className="offer-order">0{index + 1}</span>
                  <span className="offer-tick">{active ? <Check size={15} /> : <Plus size={16} />}</span>
                  <span className="offer-content">
                    <span className="offer-title-row"><strong>{offer.title}</strong><Badge>{offer.demand}</Badge></span>
                    <span>{offer.detail}</span>
                    <span className="offer-meta"><TimerReset size={14} /> {offer.duration} <i /> يبدأ من {currencyNumber(offer.price, currency)}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="kit-panel">
            <img src={kitImage} alt="بطاقات عرض وأدوات تسعير مصممة بأسلوب ورقي" />
            <span className="evidence-tag evidence-tag-top">نطاق واضح</span>
            <span className="evidence-tag evidence-tag-bottom">سعر + تسليم</span>
            <div className="kit-panel-content">
              <span>حزمة مصغّرة</span>
              <strong>كلما كان النطاق أصغر، كان قرار العميل أسرع.</strong>
            </div>
          </div>
        </section>

        <section id="calculator" className="section-heading calculator-heading" aria-labelledby="calculator-heading">
          <div>
            <span className="section-number">02</span>
            <h2 id="calculator-heading">افحص مكسبك قبل العرض</h2>
            <p>هذه حاسبة تخطيطية؛ أدخل كلفتك الفعلية ولا تعتمد على التقدير وحده.</p>
          </div>
          <span className="paper-note paper-note-dark">الأرقام تتغير معك</span>
        </section>

        <section className="calculator-layout">
          <article className="calculator-card">
            <div className="card-kicker"><Calculator size={17} /> آلة التسعير</div>
            <div className="price-editor">
              <label htmlFor="price">سعر العرض الواحد</label>
              <div className="input-with-currency">
                <Input id="price" type="number" min="0" value={price} onChange={(event) => setPrice(Math.max(0, Number(event.target.value)))} />
                <select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="العملة">
                  <option>ر.س</option><option>د.إ</option><option>د.م</option><option>د.أ</option><option>USD</option>
                </select>
              </div>
              <input className="price-range" aria-label="ضبط السعر" type="range" min="50" max="600" step="10" value={Math.min(Math.max(price, 50), 600)} onChange={(event) => setPrice(Number(event.target.value))} />
              <div className="range-labels"><span>منخفض</span><span>سعر متخصص</span></div>
            </div>
            <div className="small-input-row">
              <label htmlFor="cost">كلفة التنفيذ <Input id="cost" type="number" min="0" value={cost} onChange={(event) => setCost(Math.max(0, Number(event.target.value)))} /></label>
              <label htmlFor="target">هدف اليوم <Input id="target" type="number" min="0" value={target} onChange={(event) => setTarget(Math.max(0, Number(event.target.value)))} /></label>
            </div>
            <div className="calculator-hint"><Crosshair size={16} /> غيّر الأرقام حتى تجد سعراً تستطيع تنفيذه بثقة.</div>
          </article>

          <article className="profit-board" aria-label="ملخص الربحية">
            <div className="profit-board-head"><span>ملخص واضح</span><MoreHorizontal size={19} /></div>
            <div className="profit-primary">
              <div className="profit-ring" style={{ "--progress": `${Math.min(margin, 100)}%` } as React.CSSProperties}>
                <div><strong>{margin}%</strong><span>هامش</span></div>
              </div>
              <div><p>صافي كل طلب</p><strong>{currencyNumber(netProfit, currency)}</strong><span>{netProfit > 0 ? "بعد كلفة التنفيذ" : "راجع الكلفة والسعر"}</span></div>
            </div>
            <div className="profit-rule" />
            <div className="profit-target"><span>لتقترب من هدفك</span><strong>{ordersNeeded || "—"} <small>طلبات</small></strong></div>
            <div className="profit-advice"><WalletCards size={16} /> {margin >= 60 ? "الهامش مريح كبداية — ثبّت نطاق العمل." : "الهامش ضيّق — قلّل النطاق أو عدّل السعر."}</div>
          </article>
        </section>

        <section id="plan" className="plan-heading section-heading" aria-labelledby="plan-heading">
          <div>
            <span className="section-number">03</span>
            <h2 id="plan-heading">أرسل عرضاً، ثم نفّذ خطوة خطوة</h2>
            <p>لا يحتاج العرض إلى مبالغة؛ يحتاج إلى نتيجة محددة وموعد تسليم واضح.</p>
          </div>
          <span className="paper-note">90 دقيقة كافية للبداية</span>
        </section>

        <section className="execution-layout">
          <article className="proposal-card">
            <div className="proposal-top"><div><PenLine size={18} /><span>رسالة العرض الجاهزة</span></div><button type="button" onClick={copyProposal} aria-label="نسخ العرض"><Copy size={17} /> نسخ</button></div>
            <div className="proposal-copy">{proposalText.split("\n").map((line, index) => <p key={`${line}-${index}`}>{line || " "}</p>)}</div>
            <div className="proposal-bottom"><span><FileText size={15} /> راجع الاسم واحتياج الجهة قبل الإرسال.</span><Button onClick={copyProposal} className="send-button"><Send size={16} /> انسخ العرض الآن</Button></div>
          </article>

          <article className="plan-card">
            <img src={actionImage} alt="مسار ورقي من المهارة إلى العرض المرسل" />
            <div className="plan-overlay" />
            <div className="plan-content">
              <div className="plan-title"><div><Target size={18} /><span>خطة 90 دقيقة</span></div><strong>{completion}%</strong></div>
              <div className="task-list">
                {taskLabels.map((label, index) => (
                  <label className={tasks[index] ? "task-row task-done" : "task-row"} key={label}>
                    <Checkbox checked={tasks[index]} onCheckedChange={(checked) => toggleTask(index, checked === true)} />
                    <span><b>0{index + 1}</b>{label}</span>
                  </label>
                ))}
              </div>
              <div className="next-action"><span>{remainingTasks === 0 ? "أكملت خطة البداية." : `بقيت ${remainingTasks} خطوات قصيرة.`}</span><ChevronLeft size={17} /></div>
            </div>
          </article>
        </section>

        <footer className="workshop-footer">
          <div><img src={brandMark} alt="" /><span>فرصة — استخدم مهارتك بوضوح.</span></div>
          <p><CheckCircle2 size={15} /> الأرقام تقديرات قابلة للتعديل وليست ضماناً للدخل.</p>
        </footer>
      </section>
    </main>
  );
}
