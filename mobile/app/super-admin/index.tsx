import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AppInput from "@/components/AppInput";
import AppPicker from "@/components/AppPicker";
import { useRequireSuperAdmin } from "../../src/hooks/useRouteAuthorization";
import {
  assignTenantAdminByEmail,
  createTenant,
  listTenants,
  updateTenantStatus,
  type Tenant,
  type TenantStatus,
  type TenantType,
} from "../../src/services/tenants";

const TENANT_TYPES: { label: string; value: TenantType }[] = [
  { label: "School", value: "school" },
  { label: "Institution", value: "institution" },
  { label: "Company", value: "company" },
];

const TENANT_STATUSES: { label: string; value: TenantStatus }[] = [
  { label: "Trial", value: "trial" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
];

export default function SuperAdminDashboard() {
  const router = useRouter();
  const { loading: authLoading, ready } = useRequireSuperAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const [name, setName] = useState("");
  const [type, setType] = useState<TenantType>("school");
  const [status, setStatus] = useState<TenantStatus>("trial");
  const [subscriptionPlan, setSubscriptionPlan] = useState("standard");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const activeCount = useMemo(
    () => tenants.filter((tenant) => tenant.status === "active").length,
    [tenants]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTenants();
      setTenants(rows);
    } catch (error: any) {
      Alert.alert("Failed to load tenants", error?.message ?? String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      load();
    }, [load, ready])
  );

  async function handleCreateTenant() {
    if (!name.trim()) {
      Alert.alert("Validation", "Enter the organization name.");
      return;
    }

    setSaving(true);
    try {
      await createTenant({
        name,
        type,
        status,
        subscriptionPlan,
        contactEmail,
        contactPhone,
        adminEmail,
      });

      setName("");
      setType("school");
      setStatus("trial");
      setSubscriptionPlan("standard");
      setContactEmail("");
      setContactPhone("");
      setAdminEmail("");
      await load();

      Alert.alert(
        "Tenant created",
        adminEmail.trim()
          ? "Tenant created. If the admin email already belongs to a registered user, they were assigned as tenant admin."
          : "Tenant created. You can assign a tenant admin after they sign up."
      );
    } catch (error: any) {
      Alert.alert("Create failed", error?.message ?? String(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(tenant: Tenant, nextStatus: TenantStatus) {
    try {
      await updateTenantStatus(tenant.id, nextStatus);
      setTenants((rows) =>
        rows.map((row) =>
          row.id === tenant.id ? { ...row, status: nextStatus } : row
        )
      );
    } catch (error: any) {
      Alert.alert("Update failed", error?.message ?? String(error));
    }
  }

  async function handleAssignAdmin(tenant: Tenant) {
    if (!tenant.adminEmail) {
      Alert.alert(
        "Admin email missing",
        "Add an admin email when creating the tenant, or create a new tenant with the admin email."
      );
      return;
    }

    try {
      await assignTenantAdminByEmail(tenant.id, tenant.name, tenant.adminEmail, tenant.type);
      await load();
      Alert.alert("Admin assigned", `${tenant.adminEmail} is now tenant admin.`);
    } catch (error: any) {
      Alert.alert("Assignment failed", error?.message ?? String(error));
    }
  }

  if (authLoading || !ready || loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator />
        <Text className="mt-3 text-slate-500">Loading super admin...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-300" contentContainerStyle={{ padding: 16 }}>
      <View className="flex-row items-center mb-4">
        <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>
        <View>
          <Text className="text-2xl font-extrabold text-slate-900">
            Super Admin
          </Text>
          <Text className="text-slate-600">Tenant rental control</Text>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <Text className="text-lg font-bold text-slate-900">Platform Summary</Text>
        <View className="flex-row justify-between mt-4">
          <View>
            <Text className="text-xs text-slate-500">Tenants</Text>
            <Text className="text-2xl font-bold text-slate-900">{tenants.length}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Active</Text>
            <Text className="text-2xl font-bold text-emerald-600">{activeCount}</Text>
          </View>
          <View>
            <Text className="text-xs text-slate-500">Trial</Text>
            <Text className="text-2xl font-bold text-amber-600">
              {tenants.filter((tenant) => tenant.status === "trial").length}
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-white rounded-2xl p-4 shadow mb-4">
        <Text className="text-lg font-bold text-slate-900 mb-3">Create Tenant</Text>

        <Text className="text-sm text-slate-600 mb-1">Organization name</Text>
        <AppInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. ASTEM School"
          className="border rounded-xl px-3 py-2 bg-white mb-3"
        />

        <Text className="text-sm text-slate-600 mb-1">Tenant type</Text>
        <View className="border rounded-xl bg-white mb-3 overflow-hidden">
          <AppPicker selectedValue={type} onValueChange={(value) => setType(value)}>
            {TENANT_TYPES.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </AppPicker>
        </View>

        <Text className="text-sm text-slate-600 mb-1">Status</Text>
        <View className="border rounded-xl bg-white mb-3 overflow-hidden">
          <AppPicker selectedValue={status} onValueChange={(value) => setStatus(value)}>
            {TENANT_STATUSES.map((option) => (
              <Picker.Item key={option.value} label={option.label} value={option.value} />
            ))}
          </AppPicker>
        </View>

        <Text className="text-sm text-slate-600 mb-1">Plan</Text>
        <AppInput
          value={subscriptionPlan}
          onChangeText={setSubscriptionPlan}
          placeholder="standard"
          className="border rounded-xl px-3 py-2 bg-white mb-3"
        />

        <Text className="text-sm text-slate-600 mb-1">Contact email</Text>
        <AppInput
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder="owner@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
          className="border rounded-xl px-3 py-2 bg-white mb-3"
        />

        <Text className="text-sm text-slate-600 mb-1">Contact phone</Text>
        <AppInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Optional"
          keyboardType="phone-pad"
          className="border rounded-xl px-3 py-2 bg-white mb-3"
        />

        <Text className="text-sm text-slate-600 mb-1">Tenant admin email</Text>
        <AppInput
          value={adminEmail}
          onChangeText={setAdminEmail}
          placeholder="Registered user email"
          autoCapitalize="none"
          keyboardType="email-address"
          className="border rounded-xl px-3 py-2 bg-white mb-4"
        />

        <Pressable
          onPress={handleCreateTenant}
          disabled={saving}
          className="bg-blue-700 rounded-xl py-3"
          style={saving ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center font-semibold">
            {saving ? "Creating..." : "Create Tenant"}
          </Text>
        </Pressable>
      </View>

      <Text className="font-bold text-slate-900 mb-2">Tenants</Text>
      {tenants.length === 0 ? (
        <View className="bg-white rounded-2xl p-5 shadow">
          <Text className="text-center text-slate-500">No tenants yet.</Text>
        </View>
      ) : (
        tenants.map((tenant) => (
          <View key={tenant.id} className="bg-white rounded-2xl p-4 shadow mb-3">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 pr-3">
                <Text className="text-lg font-bold text-slate-900">{tenant.name}</Text>
                <Text className="text-slate-500 mt-1">
                  {tenant.type} - {tenant.subscriptionPlan ?? "standard"}
                </Text>
                <Text className="text-slate-500 mt-1">ID: {tenant.id}</Text>
                {tenant.adminEmail ? (
                  <Text className="text-slate-500 mt-1">Admin: {tenant.adminEmail}</Text>
                ) : null}
                {tenant.inviteCode ? (
                  <Text className="text-slate-500 mt-1">Invite code: {tenant.inviteCode}</Text>
                ) : null}
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  tenant.status === "active"
                    ? "bg-emerald-100"
                    : tenant.status === "suspended"
                    ? "bg-red-100"
                    : "bg-amber-100"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    tenant.status === "active"
                      ? "text-emerald-700"
                      : tenant.status === "suspended"
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {tenant.status}
                </Text>
              </View>
            </View>

            <View className="flex-row flex-wrap mt-4" style={{ gap: 8 }}>
              {TENANT_STATUSES.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleStatusChange(tenant, option.value)}
                  className={`px-3 py-2 rounded-xl ${
                    tenant.status === option.value ? "bg-blue-700" : "bg-slate-100"
                  }`}
                >
                  <Text
                    className={
                      tenant.status === option.value ? "text-white" : "text-slate-700"
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}

              {tenant.adminEmail && !tenant.adminUid ? (
                <Pressable
                  onPress={() => handleAssignAdmin(tenant)}
                  className="px-3 py-2 rounded-xl bg-emerald-600"
                >
                  <Text className="text-white">Assign Admin</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}


