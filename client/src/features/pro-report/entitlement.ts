/**
 * حدّ استحقاق التقرير الاحترافي. العميل لا يمنح Pro ولا يقرأه من التخزين؛
 * الخادم الموثّق هو المصدر الوحيد لحالة الاشتراك وهوية صاحبها.
 */

const WORKSHOP_REPORT_ENTITLEMENT = "workshop_report";
const ENTITLEMENT_ENDPOINT = "/api/me/entitlements/workshop-report";

type EntitlementStatus =
  | "active"
  | "purchase_setup_required"
  | "not_authenticated"
  | "inactive"
  | "unavailable";

export type WorkshopReportEntitlement =
  | {
      status: "active";
      expiresAt: string;
    }
  | {
      status: Exclude<EntitlementStatus, "active">;
      message: string;
    };

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

type ActiveEntitlementPayload = {
  status: "active";
  entitlement: string;
  subjectId: string;
  expiresAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function activeEntitlementFromPayload(
  payload: unknown,
  now: number
): ActiveEntitlementPayload | null {
  if (!isRecord(payload)) return null;
  if (
    payload.status !== "active" ||
    payload.entitlement !== WORKSHOP_REPORT_ENTITLEMENT ||
    typeof payload.subjectId !== "string" ||
    payload.subjectId.trim().length === 0 ||
    typeof payload.expiresAt !== "string"
  ) {
    return null;
  }

  const expiresAt = Date.parse(payload.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;

  return {
    status: "active",
    entitlement: WORKSHOP_REPORT_ENTITLEMENT,
    subjectId: payload.subjectId,
    expiresAt: payload.expiresAt,
  };
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function isWorkshopReportEntitlementActive(
  entitlement: WorkshopReportEntitlement | null,
  now = Date.now()
) {
  return (
    entitlement?.status === "active" &&
    Number.isFinite(Date.parse(entitlement.expiresAt)) &&
    Date.parse(entitlement.expiresAt) > now
  );
}

export function createWorkshopReportEntitlementClient(fetchLike: FetchLike) {
  return {
    async get(): Promise<WorkshopReportEntitlement> {
      try {
        const response = await fetchLike(ENTITLEMENT_ENDPOINT, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = await readResponseJson(response);

        if (
          response.status === 503 &&
          isRecord(payload) &&
          payload.status === "purchase_setup_required"
        ) {
          return {
            status: "purchase_setup_required",
            message: "إعداد الشراء والتحقق الخادمي للاشتراك لم يكتمل بعد.",
          };
        }

        if (response.status === 401) {
          return {
            status: "not_authenticated",
            message: "يلزم تسجيل الدخول إلى حسابك للتحقق من اشتراك التقرير.",
          };
        }

        if (!response.ok) {
          return {
            status: "unavailable",
            message: "تعذر التحقق من الاستحقاق؛ التقرير الاحترافي يبقى مقفلاً.",
          };
        }

        const activeEntitlement = activeEntitlementFromPayload(
          payload,
          Date.now()
        );
        if (activeEntitlement) {
          return { status: "active", expiresAt: activeEntitlement.expiresAt };
        }

        return {
          status: "inactive",
          message: "لا يوجد اشتراك فعّال لهذا الحساب أو أن الاستحقاق منتهٍ.",
        };
      } catch {
        return {
          status: "unavailable",
          message:
            "تعذر الاتصال بخدمة الاستحقاق؛ التقرير الاحترافي يبقى مقفلاً.",
        };
      }
    },
  };
}

export const workshopReportEntitlementClient =
  createWorkshopReportEntitlementClient(fetch);
