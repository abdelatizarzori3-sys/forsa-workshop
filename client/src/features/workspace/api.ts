import type { Brand, BrandInput, Client, ClientInput, Offer, OfferInput, WorkspacePlan, WorkspaceSession } from "@shared/workspace";

export class WorkspaceApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "WorkspaceApiError";
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "تعذر إتمام العملية. حاول مرة أخرى.";
}

async function responseError(response: Response): Promise<WorkspaceApiError> {
  let code = "REQUEST_FAILED";
  let message = response.status === 401 ? "انتهت الجلسة. سجّل الدخول مجدداً." : response.status === 503 ? "الخدمة غير مهيأة حالياً. راجع إعدادات المصادقة وقاعدة البيانات مع مسؤول التطبيق." : "تعذر إتمام الطلب. حاول مرة أخرى.";
  try {
    const body = await response.json();
    if (typeof body?.error?.code === "string") code = body.error.code;
    if (typeof body?.error?.message === "string") message = body.error.message;
  } catch { /* Never interpret an HTML error page as saved data. */ }
  return new WorkspaceApiError(response.status, code, message);
}

export function isWorkspaceSession(value: unknown): value is WorkspaceSession {
  if (!value || typeof value !== "object") return false;
  const s = value as WorkspaceSession;
  return typeof s.user?.id === "string" && !!s.user.id && typeof s.user.name === "string" && typeof s.user.email === "string"
    && typeof s.csrfToken === "string" && !!s.csrfToken
    && (s.plan?.kind === "free" || s.plan?.kind === "trial")
    && typeof s.plan.proEnabled === "boolean" && typeof s.plan.trialUsed === "boolean"
    && (s.plan.expiresAt === null || typeof s.plan.expiresAt === "string")
    && Number.isInteger(s.plan.freeOfferLimit) && s.plan.freeOfferLimit > 0 && s.plan.paymentConfigured === false;
}

export function createWorkspaceApi(getToken: () => string | undefined, onUnauthorized: () => void = () => {}) {
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (method !== "GET") {
      const token = getToken();
      if (!token) throw new WorkspaceApiError(401, "SESSION_REQUIRED", "تحقق من تسجيل الدخول قبل الحفظ.");
      headers["X-CSRF-Token"] = token;
    }
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetch(path, { method, credentials: "include", headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    } catch { throw new WorkspaceApiError(0, "NETWORK_ERROR", "تعذر الاتصال بالخادم. لم نتأكد من الحفظ؛ احتفظ بالتعديلات وأعد المحاولة."); }
    if (!response.ok) {
      if (response.status === 401) onUnauthorized();
      throw await responseError(response);
    }
    if (response.status === 204) return undefined as T;
    if (!response.headers.get("Content-Type")?.includes("application/json")) throw new WorkspaceApiError(502, "INVALID_RESPONSE", "أعاد الخادم استجابة غير متوقعة؛ لا يمكن تأكيد نتيجة العملية.");
    try { return await response.json() as T; }
    catch { throw new WorkspaceApiError(502, "INVALID_RESPONSE", "استجابة الخادم غير قابلة للقراءة. أعد تحميل البيانات."); }
  }
  const idPath = (resource: "offers" | "clients", id: string) => `/api/workspace/${resource}/${encodeURIComponent(id)}`;
  return {
    async session() {
      const session = await request<unknown>("/api/auth/session");
      if (!isWorkspaceSession(session)) throw new WorkspaceApiError(502, "INVALID_SESSION", "لم يقدم الخادم جلسة وخطة صالحتين. لا يمكن فتح مساحة العمل.");
      return session;
    },
    login: (origin: string) => request<{ url: string }>(`/api/auth/login?origin=${encodeURIComponent(origin)}`),
    logout: () => request<void>("/api/auth/logout", "POST"),
    clients: () => request<{ clients: Client[] }>("/api/workspace/clients"),
    createClient: (input: ClientInput) => request<{ client: Client }>("/api/workspace/clients", "POST", input),
    updateClient: (id: string, input: ClientInput) => request<{ client: Client }>(idPath("clients", id), "PATCH", input),
    deleteClient: (id: string) => request<void>(idPath("clients", id), "DELETE"),
    offers: () => request<{ offers: Offer[] }>("/api/workspace/offers"),
    createOffer: (input: OfferInput) => request<{ offer: Offer }>("/api/workspace/offers", "POST", input),
    updateOffer: (id: string, input: OfferInput & { expectedVersion: number }) => request<{ offer: Offer }>(idPath("offers", id), "PATCH", input),
    deleteOffer: (id: string) => request<void>(idPath("offers", id), "DELETE"),
    brand: () => request<{ brand: Brand }>("/api/workspace/brand"),
    saveBrand: (input: BrandInput) => request<{ brand: Brand }>("/api/workspace/brand", "PUT", input),
    trial: () => request<{ plan: WorkspacePlan }>("/api/pro/trial", "POST"),
    async pdf(id: string) {
      let response: Response;
      try { response = await fetch(`${idPath("offers", id)}/pdf`, { credentials: "include", headers: { Accept: "application/pdf" } }); }
      catch { throw new WorkspaceApiError(0, "NETWORK_ERROR", "تعذر الاتصال لتنزيل PDF. حاول مرة أخرى."); }
      if (!response.ok) {
        if (response.status === 401) onUnauthorized();
        throw await responseError(response);
      }
      if (response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/pdf") throw new WorkspaceApiError(502, "INVALID_PDF", "لم يرجع الخادم ملف PDF صالحاً؛ لم يبدأ التنزيل.");
      const blob = await response.blob();
      if (blob.size === 0) throw new WorkspaceApiError(502, "EMPTY_PDF", "ملف PDF فارغ. حاول مرة أخرى.");
      return blob;
    },
  };
}
export type WorkspaceApi = ReturnType<typeof createWorkspaceApi>;

export function downloadPdf(blob: Blob, title: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 100) || "offer"}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
