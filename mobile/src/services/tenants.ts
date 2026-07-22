import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../app/firebase";
import { getUserByEmail, upsertUser } from "./users";

const TENANTS_COLLECTION = "tenants";
const TENANT_INVITES_COLLECTION = "tenantInvites";

export type TenantType = "school" | "institution" | "company";
export type TenantStatus = "active" | "trial" | "suspended";

export type Tenant = {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  subscriptionPlan?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  adminUid?: string | null;
  adminEmail?: string | null;
  inviteCode?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

export type TenantInvite = {
  code: string;
  tenantId: string;
  tenantName: string;
  tenantType: TenantType;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
};

function slugifyTenantId(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return slug || `tenant-${Date.now()}`;
}

async function getAvailableTenantId(name: string) {
  const base = slugifyTenantId(name);
  let id = base;
  let suffix = 2;

  while ((await getDoc(doc(db, TENANTS_COLLECTION, id))).exists()) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }

  return id;
}

function makeInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function getAvailableInviteCode() {
  let code = makeInviteCode();
  while ((await getDoc(doc(db, TENANT_INVITES_COLLECTION, code))).exists()) {
    code = makeInviteCode();
  }
  return code;
}

async function createTenantInvite(input: { tenantId: string; tenantName: string; tenantType: TenantType }) {
  const code = await getAvailableInviteCode();
  await setDoc(doc(db, TENANT_INVITES_COLLECTION, code), {
    code,
    tenantId: input.tenantId,
    tenantName: input.tenantName,
    tenantType: input.tenantType,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return code;
}

export async function getTenantInviteByCode(code: string): Promise<TenantInvite | null> {
  const normalizedCode = normalizeInviteCode(code);
  if (!normalizedCode) return null;

  const snap = await getDoc(doc(db, TENANT_INVITES_COLLECTION, normalizedCode));
  if (!snap.exists()) return null;

  const data = snap.data() as Omit<TenantInvite, "code"> & { code?: string };
  if (data.active !== true) return null;

  return {
    code: data.code ?? normalizedCode,
    ...data,
  };
}

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const snap = await getDoc(doc(db, TENANTS_COLLECTION, tenantId));
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...(snap.data() as Omit<Tenant, "id">),
  };
}

export async function listTenants(): Promise<Tenant[]> {
  const q = query(collection(db, TENANTS_COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((tenantDoc) => ({
    id: tenantDoc.id,
    ...(tenantDoc.data() as Omit<Tenant, "id">),
  }));
}

export async function createTenant(input: {
  name: string;
  type: TenantType;
  status?: TenantStatus;
  subscriptionPlan?: string;
  contactEmail?: string;
  contactPhone?: string;
  adminEmail?: string;
}): Promise<Tenant> {
  const name = input.name.trim();
  if (!name) throw new Error("Tenant name is required.");

  const tenantId = await getAvailableTenantId(name);
  const inviteCode = await createTenantInvite({ tenantId, tenantName: name, tenantType: input.type });
  const tenant: Omit<Tenant, "id"> = {
    name,
    type: input.type,
    status: input.status ?? "trial",
    subscriptionPlan: input.subscriptionPlan?.trim() || "standard",
    contactEmail: input.contactEmail?.trim().toLowerCase() || null,
    contactPhone: input.contactPhone?.trim() || null,
    adminEmail: input.adminEmail?.trim().toLowerCase() || null,
    adminUid: null,
    inviteCode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, TENANTS_COLLECTION, tenantId), tenant);

  if (tenant.adminEmail) {
    await assignTenantAdminByEmail(tenantId, tenant.name, tenant.adminEmail, tenant.type);
  }

  return {
    id: tenantId,
    ...tenant,
  };
}

export async function updateTenantStatus(
  tenantId: string,
  status: TenantStatus
): Promise<void> {
  await updateDoc(doc(db, TENANTS_COLLECTION, tenantId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function assignTenantAdminByEmail(
  tenantId: string,
  tenantName: string,
  email: string,
  tenantType?: TenantType
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Admin email is required.");

  const resolvedTenantType = tenantType ?? ((await getDoc(doc(db, TENANTS_COLLECTION, tenantId))).data()?.type as TenantType | undefined);
  const user = await getUserByEmail(normalizedEmail);
  if (!user?.id) {
    throw new Error(
      "No registered user was found for this email. Ask the tenant admin to sign up first, then assign them here."
    );
  }

  await upsertUser({
    ...user,
    id: user.id,
    role: "admin" as any,
    approved: true,
    tenantId,
    tenantName,
    tenantType: resolvedTenantType ?? null,
  });

  await updateDoc(doc(db, TENANTS_COLLECTION, tenantId), {
    adminUid: user.id,
    adminEmail: normalizedEmail,
    updatedAt: serverTimestamp(),
  });
}

