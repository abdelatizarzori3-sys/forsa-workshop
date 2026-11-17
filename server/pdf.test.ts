import { describe, expect, it } from "vitest";
import { createOfferHtml, escapeHtml, renderOfferPdf, validateLogoDataUrl } from "./pdf";
import type { Offer } from "../shared/workspace";
const offer: Offer = {
  id: "4b48501e-05be-4fc3-aa2d-fc3d64d0c3c4", title: "عرض تصميم موقع", description: "تصميم خمس صفحات عربية\nتسليم الملفات والمراجعة خلال عشرة أيام.",
  clientId: null, amount: 2400, cost: 777.33, currency: "MAD", status: "draft", validUntil: "2026-12-31",
  version: 1, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z",
};
const fixture = { offer, client: null, brand: { businessName: "استوديو فرصة", contactEmail: "", contactPhone: "", logoDataUrl: null } };

describe("real private proposal PDF", () => {
  it("escapes untrusted HTML and excludes internal costs from client document", () => {
    const html = createOfferHtml({ ...fixture, offer: { ...offer, title: '<script src="https://evil.invalid/x">run()</script>' } });
    expect(html).not.toContain('<script src=');
    expect(html).toContain("&lt;script");
    expect(html).not.toContain("777.33");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("عرض خدمة وليس فاتورة");
    expect(escapeHtml('"&<>\'' )).toBe("&quot;&amp;&lt;&gt;&#39;");
  });
  it("rejects external, SVG, fake and oversized logos", () => {
    expect(validateLogoDataUrl(null)).toBe(true);
    expect(validateLogoDataUrl("https://example.invalid/logo.png")).toBe(false);
    expect(validateLogoDataUrl("data:image/svg+xml;base64,PHN2Zz4=" )).toBe(false);
    expect(validateLogoDataUrl("data:image/png;base64," + Buffer.from("not a picture").toString("base64"))).toBe(false);
    expect(validateLogoDataUrl("data:image/png;base64," + "A".repeat(710000))).toBe(false);
  });
  it("generates a real downloadable PDF with embedded Arabic fonts", async () => {
    const bytes = await renderOfferPdf(fixture);
    expect(bytes.subarray(0,5).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
  }, 45000);
});
