import { doc, getDoc, where, type QueryConstraint } from "firebase/firestore";
import { auth, db } from "../../app/firebase";

export type TenantTypeValue = "school" | "institution" | "company" | string;

export type TenantScope = {
  tenantId: string | null;
  tenantName: string | null;
  tenantType: TenantTypeValue | null;
  isSuperAdmin: boolean;
  isScoped: boolean;
};

const emptyScope: TenantScope = { tenantId: null, tenantName: null, tenantType: null, isSuperAdmin: false, isScoped: false };

function normalizeTenantType(value: any): TenantTypeValue | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveTenantType(tenantId: string | null, profileTenantType: any): Promise<TenantTypeValue | null> {
  const direct = normalizeTenantType(profileTenantType);
  if (direct || !tenantId) return direct;

  const tenantSnap = await getDoc(doc(db, "tenants", tenantId));
  return tenantSnap.exists() ? normalizeTenantType(tenantSnap.data()?.type) : null;
}

export async function getTenantScope(): Promise<TenantScope> {
  const uid = auth.currentUser?.uid;
  if (!uid) return emptyScope;

  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.exists() ? snap.data() : null;
  const isSuperAdmin = data?.role === "super_admin";
  const tenantId = typeof data?.tenantId === "string" && data.tenantId.trim() ? data.tenantId : null;
  const tenantName = typeof data?.tenantName === "string" && data.tenantName.trim() ? data.tenantName : null;
  const tenantType = await resolveTenantType(tenantId, data?.tenantType);

  return { tenantId, tenantName, tenantType, isSuperAdmin, isScoped: Boolean(tenantId && !isSuperAdmin) };
}

export function tenantConstraints(scope: TenantScope): QueryConstraint[] {
  return scope.isScoped && scope.tenantId ? [where("tenantId", "==", scope.tenantId)] : [];
}

export function withTenantScope<T extends Record<string, any>>(data: T, scope: TenantScope): T {
  if (!scope.isScoped || !scope.tenantId) return data;
  return { ...data, tenantId: scope.tenantId, tenantName: scope.tenantName ?? null, tenantType: scope.tenantType ?? null };
}

export function belongsToTenant(data: any, scope: TenantScope): boolean {
  return !scope.isScoped || data?.tenantId === scope.tenantId;
}

export function allowsStudentAndParentFeatures(scopeOrUser: { tenantId?: string | null; tenantType?: string | null; role?: string | null } | null | undefined): boolean {
  if (!scopeOrUser?.tenantId || scopeOrUser.role === "super_admin") return true;
  return scopeOrUser.tenantType === "school";
}

export function sortByCreatedAtDesc<T extends { createdAt?: any }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
}

function toMillis(value: any): number {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number") return value;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function scopedSettingsDocId(baseId: string): Promise<string> {
  const scope = await getTenantScope();
  return scope.isScoped && scope.tenantId ? `${baseId}__${scope.tenantId}` : baseId;
}
