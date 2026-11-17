import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { brandInputSchema, clientInputSchema, offerInputSchema, offerUpdateSchema } from "../shared/workspace";
import { AuthService, constantEqual, verifyMutationOrigin, type AuthConfig, type Authenticated } from "./auth";
import { ApiError, planFor, type Repository } from "./repository";
import { renderOfferPdf, validateLogoDataUrl, type PdfInput } from "./pdf";

export interface AppOptions { repository: Repository; authConfig: AuthConfig; now?: () => Date; fetcher?: typeof fetch; pdfRenderer?: (input: PdfInput) => Promise<Buffer>; }
export function createApp(options: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  const now = options.now ?? (() => new Date());
  const repo = options.repository;
  const auth = new AuthService(options.authConfig, repo, now, options.fetcher);
  const pdf = options.pdfRenderer ?? renderOfferPdf;
  const buckets = new Map<string, { start: number; count: number }>();
  function throttle(key: string, limit: number) {
    const time = now().getTime();
    if (buckets.size > 10000) for (const [id, b] of buckets) if (time - b.start >= 60000) buckets.delete(id);
    const bucket = buckets.get(key);
    if (!bucket || time - bucket.start >= 60000) { buckets.set(key, { start: time, count: 1 }); return; }
    if (++bucket.count > limit) throw new ApiError(429, "RATE_LIMIT", "طلبات كثيرة. انتظر دقيقة ثم أعد المحاولة.");
  }
  const handle = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve().then(() => fn(req, res)).catch(next);
  };
  async function account(req: Request, mutation = false): Promise<Authenticated> {
    const identity = await auth.authenticate(req);
    if (mutation) {
      if (!constantEqual(req.get("X-CSRF-Token") || "", identity.csrfToken)) throw new ApiError(403, "CSRF_TOKEN", "تعذر التحقق من الطلب. حدّث الجلسة قبل الحفظ.");
      verifyMutationOrigin(req, options.authConfig);
      throttle("write:" + identity.user.id, 60);
    }
    return identity;
  }
  const id = (req: Request) => z.uuid().parse(req.params.id);
  app.get("/health", handle(async (_req, res) => {
    const ready = auth.configured() && await repo.ready();
    res.status(ready ? 200 : 503).set("Cache-Control", "no-store").json({ status: ready ? "ready" : "setup_required", service: "forsa-workspace", version: "2.0.0" });
  }));
  const api = express.Router();
  api.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); res.set("X-Content-Type-Options", "nosniff"); next(); });
  api.use(express.json({ limit: "800kb", strict: true }));
  api.get("/auth/session", handle(async (req, res) => {
    const a = await account(req);
    res.json({ user: { id: a.user.id, name: a.user.name, email: a.user.email }, plan: planFor(a.user, now()), csrfToken: a.csrfToken });
  }));
  api.get("/auth/login", handle(async (req, res) => { throttle("login:" + req.socket.remoteAddress, 30); await auth.login(req, res); }));
  api.get("/auth/callback", handle((req, res) => auth.callback(req, res)));
  api.post("/auth/logout", handle(async (req, res) => { await account(req, true); auth.logout(req, res); }));
  api.get("/workspace/clients", handle(async (req, res) => { const a = await account(req); res.json({ clients: await repo.listClients(a.user.id) }); }));
  api.post("/workspace/clients", handle(async (req, res) => { const a = await account(req, true); res.status(201).json({ client: await repo.createClient(a.user.id, clientInputSchema.parse(req.body)) }); }));
  api.patch("/workspace/clients/:id", handle(async (req, res) => { const a = await account(req, true); res.json({ client: await repo.updateClient(a.user.id, id(req), clientInputSchema.parse(req.body)) }); }));
  api.delete("/workspace/clients/:id", handle(async (req, res) => { const a = await account(req, true); await repo.deleteClient(a.user.id, id(req)); res.status(204).end(); }));
  api.get("/workspace/offers", handle(async (req, res) => { const a = await account(req); res.json({ offers: await repo.listOffers(a.user.id) }); }));
  api.post("/workspace/offers", handle(async (req, res) => { const a = await account(req, true); res.status(201).json({ offer: await repo.createOffer(a.user.id, offerInputSchema.parse(req.body)) }); }));
  api.patch("/workspace/offers/:id", handle(async (req, res) => {
    const a = await account(req, true), { expectedVersion, ...input } = offerUpdateSchema.parse(req.body);
    res.json({ offer: await repo.updateOffer(a.user.id, id(req), input, expectedVersion) });
  }));
  api.delete("/workspace/offers/:id", handle(async (req, res) => { const a = await account(req, true); await repo.deleteOffer(a.user.id, id(req)); res.status(204).end(); }));
  api.get("/workspace/brand", handle(async (req, res) => { const a = await account(req); res.json({ brand: await repo.getBrand(a.user.id) }); }));
  api.put("/workspace/brand", handle(async (req, res) => {
    const a = await account(req, true), input = brandInputSchema.parse(req.body);
    if (!validateLogoDataUrl(input.logoDataUrl)) throw new ApiError(400, "INVALID_LOGO", "الشعار غير صالح. استخدم PNG أو JPEG حتى 500 كيلوبايت وأبعاد لا تتجاوز 2000 × 2000.");
    res.json({ brand: await repo.saveBrand(a.user.id, input) });
  }));
  api.post("/pro/trial", handle(async (req, res) => { const a = await account(req, true); res.json({ plan: planFor(await repo.startTrial(a.user.id), now()) }); }));
  api.get("/workspace/offers/:id/pdf", handle(async (req, res) => {
    const a = await account(req), offer = await repo.getOffer(a.user.id, id(req));
    if (!planFor(await repo.getUser(a.user.id), now()).proEnabled) throw new ApiError(403, "PRO_REQUIRED", "تنزيل PDF يتطلب تجربة برو صالحة. التجربة مجانية ولا تثبت شراء اشتراك.");
    throttle("pdf:" + a.user.id, 10);
    const client = offer.clientId ? await repo.getClient(a.user.id, offer.clientId) : null;
    const bytes = await pdf({ offer, client, brand: await repo.getBrand(a.user.id) });
    res.type("application/pdf").set("Content-Disposition", `attachment; filename="forsa-offer-${offer.id}.pdf"`).send(bytes);
  }));
  api.get("/me/entitlements/workshop-report", handle(async (req, res) => {
    const a = await account(req), plan = planFor(a.user, now());
    res.json(plan.proEnabled ? { status: "active", entitlement: "workshop_report", subjectId: a.user.id, expiresAt: plan.expiresAt, source: "free_trial", message: "تجربة برو مجانية صالحة، وليست اشتراكاً مدفوعاً." } : { status: "inactive", message: "ابدأ تجربة برو من مساحة العروض والعملاء إذا لم تستخدمها من قبل." });
  }));
  api.use((_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "مسار API غير موجود.")));
  app.use("/api", api);
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) { next(error); return; }
    if (error instanceof ApiError) { if (error.status === 429) res.set("Retry-After", "60"); res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ error: { code: "INVALID_INPUT", message: "راجع الحقول: " + error.issues.map(i => i.path.join(".") || "الطلب").join("، ") } }); return; }
    const parsing = error as { type?: string };
    if (parsing?.type === "entity.too.large") { res.status(413).json({ error: { code: "BODY_TOO_LARGE", message: "حجم الطلب أكبر من المسموح." } }); return; }
    if (parsing?.type === "entity.parse.failed") { res.status(400).json({ error: { code: "INVALID_JSON", message: "الطلب غير قابل للقراءة." } }); return; }
    if (error instanceof Error && error.message === "PDF_BUSY") { res.status(429).json({ error: { code: "PDF_BUSY", message: "خدمة PDF مشغولة. حاول بعد قليل." } }); return; }
    console.error("Forsa request failed", error instanceof Error ? error.name : "UnknownError");
    res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "تعذر إتمام العملية على الخادم. أعد المحاولة دون فقد تعديلاتك." } });
  });
  return app;
}
