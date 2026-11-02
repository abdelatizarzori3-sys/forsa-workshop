/** تقرير ورشة قابل للطباعة: ورق واضح ومحتوى مشتق من العرض والحساب والخطة الحالية. */
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, type WorkshopReportData } from "./report-utils";

type WorkshopReportProps = {
  report: WorkshopReportData;
  onPrint: () => void;
};

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="report-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function WorkshopReport({ report, onPrint }: WorkshopReportProps) {
  const { calculations } = report;

  return (
    <article className="print-report" aria-labelledby="print-report-title">
      <header className="print-report-head">
        <div>
          <span className="report-kicker">تقرير ورشة احترافي</span>
          <h3 id="print-report-title">{report.identity.workshopName}</h3>
          {report.identity.facilitatorName && (
            <p>إعداد: {report.identity.facilitatorName}</p>
          )}
        </div>
        <div className="report-head-meta">
          <span>ملخص العرض والتسعير وخطة العمل</span>
          <time dateTime={report.generatedAtIso}>
            {report.generatedAtLabel}
          </time>
        </div>
      </header>

      <section className="report-block" aria-labelledby="report-offer-title">
        <div className="report-block-title">
          <span>01</span>
          <h4 id="report-offer-title">العرض المختار</h4>
        </div>
        <div className="report-offer-content">
          <div>
            <strong>{report.offer.title}</strong>
            <p>{report.offer.detail}</p>
          </div>
          <span className="report-delivery">
            مدة التسليم: {report.offer.duration}
          </span>
        </div>
        <p className="report-pitch">{report.offer.pitch}</p>
      </section>

      <section className="report-block" aria-labelledby="report-metrics-title">
        <div className="report-block-title">
          <span>02</span>
          <h4 id="report-metrics-title">حساب التخطيط</h4>
        </div>
        <div className="report-metrics-grid">
          <ReportMetric
            label="سعر العرض"
            value={formatCurrency(calculations.price, report.currency)}
          />
          <ReportMetric
            label="كلفة التنفيذ"
            value={formatCurrency(calculations.cost, report.currency)}
          />
          <ReportMetric
            label="صافي كل طلب"
            value={formatCurrency(calculations.netProfit, report.currency)}
          />
          <ReportMetric label="الهامش" value={`${calculations.margin}%`} />
          <ReportMetric
            label="هدف اليوم"
            value={formatCurrency(calculations.target, report.currency)}
          />
          <ReportMetric
            label="طلبات تقريبية للهدف"
            value={
              calculations.ordersNeeded === null
                ? "—"
                : `${calculations.ordersNeeded} طلبات`
            }
          />
        </div>
        <p className="report-disclaimer">
          هذه أرقام تخطيطية قابلة للتعديل وليست ضماناً للدخل أو المبيعات.
        </p>
      </section>

      <section className="report-block" aria-labelledby="report-plan-title">
        <div className="report-block-title">
          <span>03</span>
          <h4 id="report-plan-title">خطة العمل الحالية</h4>
          <b>{report.completion}% مكتملة</b>
        </div>
        <ol className="report-task-list">
          {report.tasks.map((task, index) => (
            <li
              className={task.completed ? "report-task-complete" : ""}
              key={`${task.label}-${index}`}
            >
              <span>0{index + 1}</span>
              <p>{task.label}</p>
              <strong>{task.completed ? "تم" : "قيد التنفيذ"}</strong>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="report-block report-proposal"
        aria-labelledby="report-proposal-title"
      >
        <div className="report-block-title">
          <span>04</span>
          <h4 id="report-proposal-title">مسودة رسالة العرض</h4>
        </div>
        <div>
          {report.proposalText.split("\n").map((line, index) => (
            <p key={`${line}-${index}`}>{line || " "}</p>
          ))}
        </div>
      </section>

      <footer className="print-report-footer">
        <p>أُنشئ من بيانات هذه الجلسة فقط. راجع الاسم والاحتياج قبل الإرسال.</p>
        <Button type="button" onClick={onPrint} className="print-report-button">
          <Printer size={17} /> طباعة أو حفظ PDF
        </Button>
      </footer>
    </article>
  );
}
