import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { Request, Response } from "express";
import { ApiError, type Identity, type Repository, type User } from "./repository";

export const SESSION_COOKIE = "webdev_app_session";
export const NONCE_COOKIE = "forsa_oauth_nonce";
const CALLBACK = "/api/auth/callback";
const MANUS_DOMAINS = ["manus.computer", "manuspre.computer", "manus-asia.computer", "manuscomputer.ai", "manusvm.computer", "manus.space", "manusapp.com"];
export interface AuthConfig { projectId: string; secret: string; portalUrl: string; apiUrl: string; publicOrigins?: string[]; }
export interface Authenticated { user: User; token: string; csrfToken: string; }
export function environmentAuth(): AuthConfig {
  return { projectId: process.env.MANUS_PROJECT_ID || "", secret: process.env.MANUS_JWT_SECRET || "",
    portalUrl: process.env.MANUS_OAUTH_PORTAL_URL || "", apiUrl: process.env.MANUS_OAUTH_API_URL || "",
    publicOrigins: (process.env.FORSA_PUBLIC_ORIGIN || "").split(",").map(v => v.trim()).filter(Boolean) };
}
function isLocal(url: URL) { return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
function serviceUrl(value: string) {
  try { const url = new URL(value); return !url.username && !url.password && !url.search && !url.hash && (url.protocol === "https:" || (url.protocol === "http:" && isLocal(url))); }
  catch { return false; }
}
export function authConfigured(config: AuthConfig) {
  return !!config.projectId.trim() && !!config.secret && serviceUrl(config.portalUrl) && serviceUrl(config.apiUrl);
}
export function validateOrigin(value: unknown, config: AuthConfig): string {
  if (typeof value !== "string" || value.length > 2048) throw new ApiError(400, "INVALID_ORIGIN", "أصل تسجيل الدخول غير مسموح.");
  try {
    const url = new URL(value);
    if (url.origin !== value || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error();
    const manuscript = MANUS_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith("." + domain));
    const configured = config.publicOrigins?.includes(url.origin);
    if ((url.protocol === "https:" && !url.port && (manuscript || configured)) || (url.protocol === "http:" && isLocal(url))) return url.origin;
  } catch { /* fail closed */ }
  throw new ApiError(400, "INVALID_ORIGIN", "أصل تسجيل الدخول غير مسموح.");
}
export function cookies(req: Request): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const part of (req.headers.cookie || "").split(";")) {
    const index = part.indexOf("="); if (index < 1) continue;
    try { result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()); } catch { /* invalid cookie */ }
  }
  return result;
}
export function constantEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function cookieOptions(origin: string) {
  const local = new URL(origin).protocol === "http:";
  // Preview is HTTPS even when the reverse proxy reaches Express over HTTP.
  return { httpOnly: true, secure: !local, sameSite: local ? "lax" as const : "none" as const, path: "/" };
}
export function requestOrigin(req: Request, config: AuthConfig): string {
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0].trim();
  const host = forwardedHost || req.get("host") || "";
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  return validateOrigin(`${localHost ? "http" : "https"}://${host}`, config);
}
export function verifyMutationOrigin(req: Request, config: AuthConfig) {
  if (!req.get("Origin")) return;
  let origin: string, expected: string;
  try {
    origin = validateOrigin(req.get("Origin"), config);
    const externalHost = req.get("x-forwarded-host")?.split(",")[0].trim() || req.get("host") || "";
    // A trusted HTTPS ingress may rewrite Host to loopback. The mandatory session-bound
    // CSRF token remains the security boundary; do not reject a valid public Origin merely
    // because the internal listener is HTTP. No CORS access is granted to other origins.
    if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(externalHost) && origin.startsWith("https://")) return;
    expected = requestOrigin(req, config);
  }
  catch { throw new ApiError(403, "CSRF_ORIGIN", "مصدر الطلب غير مسموح."); }
  if (origin !== expected) throw new ApiError(403, "CSRF_ORIGIN", "يجب إرسال الطلب من أصل التطبيق نفسه.");
}
export class AuthService {
  private key: Uint8Array;
  constructor(public config: AuthConfig, private repository: Repository, private now: () => Date = () => new Date(), private fetcher: typeof fetch = fetch) {
    this.key = new TextEncoder().encode(config.secret);
  }
  configured() { return authConfigured(this.config); }
  requireConfig() { if (!this.configured()) throw new ApiError(503, "AUTH_UNCONFIGURED", "تسجيل الدخول غير مجهز. يلزم إعداد OAuth الخادمي."); }
  private async verify(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.key, { algorithms: ["HS256"], currentDate: this.now(), requiredClaims: ["exp", "appId"] });
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.appId !== this.config.projectId) throw new Error("Invalid session claims");
    return payload;
  }
  async authenticate(req: Request): Promise<Authenticated> {
    this.requireConfig();
    const token = cookies(req)[SESSION_COOKIE];
    if (!token || token.length > 16_384) throw new ApiError(401, "NOT_AUTHENTICATED", "يلزم تسجيل الدخول.");
    let identity: Identity;
    try {
      const payload = await this.verify(token);
      if (typeof payload.openId !== "string" || !payload.openId.trim() || payload.openId.length > 191 || (payload.purpose && payload.purpose !== "session")) throw new Error();
      identity = { openId: payload.openId,
        name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 120) : "مستخدم فرصة",
        email: typeof payload.email === "string" ? payload.email.slice(0, 254) : "" };
    } catch { throw new ApiError(401, "INVALID_SESSION", "الجلسة غير صالحة أو انتهت. سجّل الدخول مجدداً."); }
    const user = await this.repository.resolveUser(identity);
    const csrfToken = createHmac("sha256", this.key).update("forsa-csrf\0" + this.config.projectId + "\0" + identity.openId + "\0" + token).digest("base64url");
    return { user, token, csrfToken };
  }
  async login(req: Request, res: Response) {
    this.requireConfig();
    const origin = validateOrigin(req.query.origin, this.config);
    const redirectUri = origin + CALLBACK;
    const nonce = randomBytes(32).toString("base64url");
    const now = Math.floor(this.now().getTime() / 1000), expires = now + 600;
    await this.repository.createOAuthNonce(createHash("sha256").update(nonce).digest("hex"), redirectUri, new Date(expires * 1000).toISOString());
    const signedNonce = await new SignJWT({ nonce, redirectUri, purpose: "oauth_nonce", appId: this.config.projectId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt(now).setExpirationTime(expires).sign(this.key);
    res.cookie(NONCE_COOKIE, signedNonce, { ...cookieOptions(origin), maxAge: 600_000 });
    const url = new URL(this.config.portalUrl.replace(/\/+$/, "") + "/app-auth");
    url.searchParams.set("appId", this.config.projectId); url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", Buffer.from(JSON.stringify({ nonce, redirectUri })).toString("base64")); url.searchParams.set("responseType", "code");
    res.json({ url: url.toString() });
  }
  private async rpc(method: string, body: unknown): Promise<Record<string, unknown>> {
    let response: globalThis.Response;
    try {
      response = await this.fetcher(this.config.apiUrl.replace(/\/+$/, "") + "/webdev.v1.WebDevAuthPublicService/" + method,
        { method: "POST", headers: { "Content-Type": "application/json", "connect-protocol-version": "1" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result || typeof result !== "object" || result.error) throw new Error();
      return result;
    } catch { throw new ApiError(502, "OAUTH_UNAVAILABLE", "تعذر إتمام تسجيل الدخول مع Manus. حاول مجدداً."); }
  }
  async callback(req: Request, res: Response) {
    this.requireConfig();
    const signedNonce = cookies(req)[NONCE_COOKIE];
    // Clearing is unconditional, including malformed state and rejected callbacks.
    let clearOrigin: string;
    try { clearOrigin = requestOrigin(req, this.config); } catch { clearOrigin = "https://localhost"; }
    res.clearCookie(NONCE_COOKIE, cookieOptions(clearOrigin));
    let redirectUri: string;
    try {
      if (!signedNonce || signedNonce.length > 8192) throw new Error();
      const payload = await this.verify(signedNonce);
      if (payload.purpose !== "oauth_nonce" || typeof payload.nonce !== "string" || typeof payload.redirectUri !== "string") throw new Error();
      if (typeof req.query.state !== "string" || req.query.state.length > 4096) throw new Error();
      const state = JSON.parse(Buffer.from(req.query.state, "base64").toString("utf8"));
      if (typeof state.nonce !== "string" || !constantEqual(state.nonce, payload.nonce) || state.redirectUri !== payload.redirectUri) throw new Error();
      const issued = await this.repository.consumeOAuthNonce(createHash("sha256").update(payload.nonce).digest("hex"));
      if (!issued || Date.parse(issued.expiresAt) <= this.now().getTime() || issued.redirectUri !== payload.redirectUri) throw new Error();
      const callbackUrl = new URL(payload.redirectUri);
      const origin = validateOrigin(callbackUrl.origin, this.config);
      redirectUri = origin + CALLBACK;
      if (redirectUri !== payload.redirectUri) throw new Error();
      if (typeof req.query.code !== "string" || !req.query.code || req.query.code.length > 4096) throw new Error();
    } catch { throw new ApiError(400, "INVALID_OAUTH_STATE", "انتهت محاولة الدخول أو لم يتم التحقق من حالتها. ابدأ تسجيل الدخول من جديد."); }
    const tokens = await this.rpc("ExchangeToken", { clientId: this.config.projectId, grantType: "authorization_code", code: req.query.code, redirectUri });
    if (typeof tokens.accessToken !== "string" || !tokens.accessToken) throw new ApiError(502, "OAUTH_UNAVAILABLE", "لم يكتمل تبادل تسجيل الدخول.");
    const info = await this.rpc("GetUserInfo", { accessToken: tokens.accessToken });
    if (typeof info.openId !== "string" || !info.openId.trim() || info.openId.length > 191) throw new ApiError(502, "OAUTH_IDENTITY_INVALID", "لم يتم التحقق من هوية الحساب.");
    const identity = { openId: info.openId, name: typeof info.name === "string" && info.name.trim() ? info.name.trim().slice(0, 120) : "مستخدم فرصة", email: typeof info.email === "string" ? info.email.slice(0, 254) : "" };
    await this.repository.resolveUser(identity);
    const now = Math.floor(this.now().getTime() / 1000), ttl = 30 * 24 * 60 * 60;
    const token = await new SignJWT({ ...identity, appId: this.config.projectId, purpose: "session" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt(now).setExpirationTime(now + ttl).sign(this.key);
    res.cookie(SESSION_COOKIE, token, { ...cookieOptions(new URL(redirectUri).origin), maxAge: ttl * 1000 });
    res.redirect(302, "/workspace");
  }
  logout(req: Request, res: Response) {
    let origin: string;
    try { origin = requestOrigin(req, this.config); } catch { origin = "https://localhost"; }
    res.clearCookie(SESSION_COOKIE, cookieOptions(origin)); res.status(204).end();
  }
}
