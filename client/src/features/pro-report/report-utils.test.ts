import { describe, expect, it } from "vitest";
import { createWorkshopReportEntitlementClient } from "./entitlement";
import {
  calculateWorkshopMetrics,
  createWorkshopReport,
  MAX_MONEY_VALUE,
  sanitizeReportText,
} from "./report-utils";

describe("نواة تقرير الورشة", () => {
  it("تجمع العرض والحساب وخطة العمل في تقرير قابل للطباعة بلا وعد دخل", () => {
    const report = createWorkshopReport({
      workshopName: "ورشة انطلاقة المستقل",
      facilitatorName: "ليان",
      offer: {
        title: "حزمة منشورات سريعة",
        detail: "6 منشورات قابلة للنشر لنشاط محلي",
        duration: "24 ساعة",
        pitch: "أصمّم لك ستة منشورات متناسقة وجاهزة للنشر.",
      },
      price: 150,
      cost: 15,
      target: 600,
      currency: "ر.س",
      tasks: [
        { label: "اختر نشاطاً محلياً واحداً", completed: true },
        { label: "انسخ العرض", completed: false },
        { label: "أرسل العرض إلى 5 جهات", completed: false },
      ],
      generatedAt: new Date("2026-10-31T08:40:00.000Z"),
    });

    expect(report.identity).toEqual({
      workshopName: "ورشة انطلاقة المستقل",
      facilitatorName: "ليان",
    });
    expect(report.calculations).toMatchObject({
      price: 150,
      cost: 15,
      target: 600,
      netProfit: 135,
      margin: 90,
      ordersNeeded: 5,
    });
    expect(report.completion).toBe(33);
    expect(report.proposalText).toContain("150");
    expect(report.generatedAtIso).toBe("2026-10-31T08:40:00.000Z");
  });

  it("تحدّ القيم المالية والنصوص غير الصالحة قبل إنشاء التقرير", () => {
    expect(
      calculateWorkshopMetrics(Number.NaN, -10, Number.POSITIVE_INFINITY)
    ).toEqual({
      price: 0,
      cost: 0,
      target: 0,
      netProfit: 0,
      margin: 0,
      ordersNeeded: null,
    });
    expect(calculateWorkshopMetrics(MAX_MONEY_VALUE + 1, 0, 0).price).toBe(
      MAX_MONEY_VALUE
    );
    expect(sanitizeReportText("  اسم\u0000\nالورشة  ", 20)).toBe("اسم الورشة");
  });
});

describe("حد استحقاق التقرير", () => {
  it("يقبل فقط استحقاقاً خادمياً صحيحاً لموضوع حساب وصلاحية مستقبلية", async () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const client = createWorkshopReportEntitlementClient(
      async () =>
        new Response(
          JSON.stringify({
            status: "active",
            entitlement: "workshop_report",
            subjectId: "account_opaque_id",
            expiresAt,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    await expect(client.get()).resolves.toEqual({
      status: "active",
      expiresAt,
    });
  });

  it("يرفض الاستحقاق المنتهي أو المشوّه ولا يفتح التقرير", async () => {
    const client = createWorkshopReportEntitlementClient(
      async () =>
        new Response(
          JSON.stringify({
            status: "active",
            entitlement: "workshop_report",
            subjectId: "account_opaque_id",
            expiresAt: "2020-01-01T00:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );

    await expect(client.get()).resolves.toMatchObject({ status: "inactive" });
  });

  it("يبقى مقفلاً ويبلغ أن إعداد الشراء مطلوب عند رد الخادم غير المهيأ", async () => {
    const client = createWorkshopReportEntitlementClient(
      async () =>
        new Response(JSON.stringify({ status: "purchase_setup_required" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
    );

    await expect(client.get()).resolves.toMatchObject({
      status: "purchase_setup_required",
    });
  });
});
