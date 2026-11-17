/**
 * نواة تقرير ورشة فرصة: تُحوّل بيانات الواجهة الحالية إلى وثيقة مطبوعة بلا
 * ادعاء دخل أو تخزين لاستحقاق برو. تُعرَض جميع النصوص في React كنص آمن.
 */

export const MAX_WORKSHOP_NAME_LENGTH = 80;
export const MAX_FACILITATOR_NAME_LENGTH = 80;
export const MAX_MONEY_VALUE = 1_000_000;

export type ReportOffer = {
  title: string;
  detail: string;
  duration: string;
  pitch: string;
};

export type ReportTask = {
  label: string;
  completed: boolean;
};

export type WorkshopReportInput = {
  workshopName: string;
  facilitatorName: string;
  offer: ReportOffer;
  price: number;
  cost: number;
  target: number;
  currency: string;
  tasks: ReportTask[];
  generatedAt: Date;
};

export type WorkshopReportData = {
  identity: {
    workshopName: string;
    facilitatorName: string | null;
  };
  offer: ReportOffer;
  proposalText: string;
  currency: string;
  calculations: {
    price: number;
    cost: number;
    target: number;
    netProfit: number;
    margin: number;
    ordersNeeded: number | null;
  };
  tasks: ReportTask[];
  completion: number;
  generatedAtLabel: string;
  generatedAtIso: string;
};

export function sanitizeReportText(value: string, maximumLength: number) {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximumLength);
}

export function normalizeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.round(value * 100) / 100, 0), MAX_MONEY_VALUE);
}

export function calculateWorkshopMetrics(
  priceValue: number,
  costValue: number,
  targetValue: number
) {
  const price = normalizeMoney(priceValue);
  const cost = normalizeMoney(costValue);
  const target = normalizeMoney(targetValue);
  const netProfit = Math.max(price - cost, 0);
  const margin = price > 0 ? Math.round((netProfit / price) * 100) : 0;
  const ordersNeeded = netProfit > 0 ? Math.ceil(target / netProfit) : null;

  return { price, cost, target, netProfit, margin, ordersNeeded };
}

export function formatCurrency(value: number, currency: string) {
  const safeCurrency = sanitizeReportText(currency, 12) || "ر.س";
  return `${new Intl.NumberFormat("ar", { maximumFractionDigits: 2 }).format(value)} ${safeCurrency}`;
}

function formatGeneratedAtUtc(generatedAt: Date) {
  const safeDate = Number.isNaN(generatedAt.getTime())
    ? new Date(0)
    : generatedAt;
  return `${new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(safeDate)} UTC`;
}

export function createWorkshopReport(
  input: WorkshopReportInput
): WorkshopReportData {
  const workshopName =
    sanitizeReportText(input.workshopName, MAX_WORKSHOP_NAME_LENGTH) ||
    "ورشة فرصة";
  const facilitatorName =
    sanitizeReportText(input.facilitatorName, MAX_FACILITATOR_NAME_LENGTH) ||
    null;
  const title = sanitizeReportText(input.offer.title, 120) || "عرض الخدمة";
  const detail = sanitizeReportText(input.offer.detail, 220);
  const duration = sanitizeReportText(input.offer.duration, 80);
  const pitch = sanitizeReportText(input.offer.pitch, 600);
  const currency = sanitizeReportText(input.currency, 12) || "ر.س";
  const calculations = calculateWorkshopMetrics(
    input.price,
    input.cost,
    input.target
  );
  const tasks = input.tasks.slice(0, 12).map(task => ({
    label: sanitizeReportText(task.label, 220),
    completed: task.completed === true,
  }));
  const generatedAt = Number.isNaN(input.generatedAt.getTime())
    ? new Date(0)
    : input.generatedAt;
  const completedTasks = tasks.filter(task => task.completed).length;
  const completion =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const proposalText = `مرحباً،\n\n${pitch}\n\nالسعر المقترح: ${formatCurrency(calculations.price, currency)}.\nمدة التسليم: ${duration}.\n\nإذا كانت هذه النتيجة تناسب احتياجكم، أرسل لي التفاصيل لنبدأ اليوم.`;

  return {
    identity: { workshopName, facilitatorName },
    offer: { title, detail, duration, pitch },
    proposalText,
    currency,
    calculations,
    tasks,
    completion,
    generatedAtLabel: formatGeneratedAtUtc(generatedAt),
    generatedAtIso: generatedAt.toISOString(),
  };
}
