import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { formatMoney, offerTotals, statusLabels, type Brand, type Client, type Offer } from "../shared/workspace";

const require = createRequire(import.meta.url);
const font = (subset: string) => readFileSync(require.resolve(`@fontsource/noto-sans-arabic/files/noto-sans-arabic-${subset}-400-normal.woff2`)).toString("base64");
let fontCss: string | undefined;
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Only small, bounded raster logos: no SVG, links or network requests. */
export function validateLogoDataUrl(value: string | null): boolean {
  if (value === null) return true;
  if (value.length > 700000) return false;
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return false;
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 24 || bytes.length > 500 * 1024 || bytes.toString("base64") !== match[2]) return false;
  let width = 0, height = 0;
  if (match[1] === "png") {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || bytes.subarray(12,16).toString() !== "IHDR") return false;
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
    const frames = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i] !== 0xff) return false;
      const marker = bytes[i + 1]; i += 2;
      if (marker === 0xda || marker === 0xd9) break;
      const length = bytes.readUInt16BE(i);
      if (length < 2 || i + length > bytes.length) return false;
      if (frames.has(marker) && length >= 8) { height = bytes.readUInt16BE(i + 3); width = bytes.readUInt16BE(i + 5); break; }
      i += length;
    }
  }
  return width > 0 && height > 0 && width <= 2000 && height <= 2000 && width * height <= 4_000_000;
}

export interface PdfInput { offer: Offer; client: Client | null; brand: Brand; }
export function createOfferHtml({ offer, client, brand }: PdfInput): string {
  if (!validateLogoDataUrl(brand.logoDataUrl)) throw new Error("INVALID_LOGO");
  fontCss ??= `@font-face{font-family:Forsa;src:url(data:font/woff2;base64,${font("arabic")}) format('woff2');unicode-range:U+0600-06FF,U+0750-077F,U+0870-089F,U+08A0-08FF,U+FB50-FDFF,U+FE70-FEFF;}@font-face{font-family:Forsa;src:url(data:font/woff2;base64,${font("latin")}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F;}`;
  const e = escapeHtml;
  const totals = offerTotals(offer);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${fontCss}
  *{box-sizing:border-box}body{margin:0;color:#182b25;font-family:Forsa,Arial,sans-serif;font-size:12px;line-height:2}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #bbdb70;padding-bottom:20px}header img{width:72px;height:72px;object-fit:contain}.brand{font-size:22px;font-weight:bold}h1{font-size:28px;line-height:1.5;margin:28px 0 10px;overflow-wrap:anywhere}h2{font-size:14px;margin:22px 0 8px}.meta{color:#53615c;font-size:11px}.label{background:#f0f5e6;padding:4px 12px;border-radius:5px;display:inline-block}.scope{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:20px 0}td,th{text-align:right;padding:12px;border-bottom:1px solid #dfe6db}th{background:#f2f5ee}.amount{font-size:20px;font-weight:bold}.footer{margin-top:30px;padding-top:14px;border-top:1px solid #dde2db;color:#6a746d;font-size:10px}section,header{break-inside:avoid}h1,h2{break-after:avoid}.scope{break-inside:auto}</style></head><body>
  <header><div><div class="brand">${e(brand.businessName)}</div><div class="meta">${e(brand.contactEmail)}${brand.contactPhone ? " · " + e(brand.contactPhone) : ""}</div></div>${brand.logoDataUrl ? `<img alt="شعار" src="${e(brand.logoDataUrl)}">` : `<span class="label">عرض خدمة</span>`}</header>
  <h1>${e(offer.title)}</h1><div class="meta">رقم العرض: <span dir="ltr">${e(offer.id.slice(0,8))}</span> · الحالة: ${e(statusLabels[offer.status])} · تاريخ الإنشاء: ${e(offer.createdAt.slice(0,10))}</div>
  <section><h2>مقدّم إلى</h2><div>${e(client?.name || "لم يُحدد عميل")}</div><div class="meta">${e(client?.email || "")}${client?.phone ? " · " + e(client.phone) : ""}</div></section>
  <h2>نطاق الخدمة والتسليم</h2><div class="scope">${e(offer.description)}</div>
  <section><table><tr><th>قيمة العرض</th><th>صلاحية العرض</th></tr><tr><td class="amount">${e(formatMoney(offer.amount,offer.currency))}</td><td>${e(offer.validUntil || "غير محددة")}</td></tr></table></section>
  <div class="footer">عرض خدمة وليس فاتورة أو إثبات دفع. لا تُعرض كلفة التنفيذ الداخلية أو هامش المشروع للعميل. أُعدّ باستخدام فرصة. يُتفق على شروط العمل بين مقدم الخدمة والعميل.</div>
  </body></html>`;
}
let running = 0;
export async function renderOfferPdf(input: PdfInput): Promise<Buffer> {
  if (running >= 2) throw new Error("PDF_BUSY");
  running++;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    const html = createOfferHtml(input);
    browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-background-networking"], timeout: 30000 });
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", request => { if (request.url().startsWith("data:")) void request.continue(); else void request.abort(); });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" }, timeout: 20000 });
    return Buffer.from(bytes);
  } finally {
    if (browser) await browser.close();
    running--;
  }
}
