import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import {
  createStaff,
  STAFF_ROLE_OPTIONS,
  type StaffRoleType,
} from "../../src/services/staff";
import { listStaff } from "../../src/services/staff";
import { getUserByEmail, upsertUser } from "../../src/services/users";
import { parseCsvRows, pickCsvValue } from "../../src/utils/csvImport";

const SAMPLE = `name,email,role,staffId
Ama Teacher,ama@example.com,teacher,TCH-0008
Kofi Staff,kofi@example.com,non_teaching_staff,`;

const STAFF_ROLES = new Set<string>(STAFF_ROLE_OPTIONS.map((option) => option.value));

type StaffImportRow = {
  name: string;
  email: string;
  roleType: StaffRoleType;
  staffId?: string;
};

function normalizeRole(role?: string): StaffRoleType {
  const normalized = role?.trim() || "teacher";
  return STAFF_ROLES.has(normalized) ? (normalized as StaffRoleType) : "teacher";
}

function getRows(csvText: string): StaffImportRow[] {
  return parseCsvRows(csvText)
    .map((row) => ({
      name: pickCsvValue(row, ["name", "fullName", "staffName"]),
      email: pickCsvValue(row, ["email", "emailAddress"]).toLowerCase(),
      roleType: normalizeRole(pickCsvValue(row, ["role", "roleType", "staffRole"])),
      staffId: pickCsvValue(row, ["staffId", "staffCode", "id"]) || undefined,
    }))
    .filter((row) => row.name || row.email || row.staffId);
}

export default function StaffBulkImport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [csvText, setCsvText] = useState(SAMPLE);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const rows = useMemo(() => getRows(csvText), [csvText]);
  const validRows = rows.filter((row) => row.name.trim() && row.email.trim());

  async function handleImport() {
    if (validRows.length === 0) {
      Alert.alert("No valid rows", "Each staff row needs a name and email.");
      return;
    }

    setImporting(true);
    setResult(null);

    const existing = await listStaff().catch(() => []);
    const existingEmails = new Set(
      existing.map((staff) => staff.email?.toLowerCase()).filter(Boolean)
    );
    const existingStaffIds = new Set(
      existing.map((staff) => staff.staffId).filter(Boolean)
    );
    const seenEmails = new Set<string>();
    const seenStaffIds = new Set<string>();
    const errors: string[] = [];
    let created = 0;

    try {
      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const line = index + 2;
        const email = row.email.trim().toLowerCase();
        const staffId = row.staffId?.trim();

        if (existingEmails.has(email) || seenEmails.has(email)) {
          errors.push(`Line ${line}: duplicate email ${email}`);
          continue;
        }

        if (staffId && (existingStaffIds.has(staffId) || seenStaffIds.has(staffId))) {
          errors.push(`Line ${line}: duplicate Staff ID ${staffId}`);
          continue;
        }

        seenEmails.add(email);
        if (staffId) seenStaffIds.add(staffId);

        try {
          const linkedUser = await getUserByEmail(email);
          const staff = await createStaff({
            name: row.name.trim(),
            email,
            staffId: staffId || undefined,
            role: row.roleType,
            roleType: row.roleType,
            userUid: linkedUser?.id,
          });

          if (linkedUser?.id) {
            await upsertUser({
              id: linkedUser.id,
              approved: true,
              ...(linkedUser.role === "admin" ? {} : { role: row.roleType }),
            });
          }

          if (staff.staffId) existingStaffIds.add(staff.staffId);
          existingEmails.add(email);
          created += 1;
        } catch (error) {
          errors.push(
            `Line ${line}: ${
              error instanceof Error ? error.message : "could not create staff"
            }`
          );
        }
      }

      setResult(
        `Created ${created} staff profile${created === 1 ? "" : "s"}${
          errors.length ? `; ${errors.length} skipped.` : "."
        }`
      );

      if (errors.length) {
        Alert.alert("Import finished with skips", errors.slice(0, 6).join("\n"));
      } else {
        Alert.alert("Import complete", `Created ${created} staff profiles.`);
      }
    } finally {
      setImporting(false);
    }
  }

  if (adminLoading || !adminReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAwareScreen>
      <ScrollView className="flex-1 bg-slate-300" contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row items-center mb-4">
          <Pressable onPress={() => router.back()} className="p-1 mr-2" hitSlop={8}>
            <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
          </Pressable>
          <Text className="text-2xl font-extrabold text-slate-900">
            Bulk Import Staff
          </Text>
        </View>

        <Text className="text-sm text-slate-700 mb-2">
          Paste CSV with headers: name, email, role, staffId. Staff ID is optional.
        </Text>
        <Text className="text-xs text-slate-600 mb-2">
          Roles: teacher, non_teaching_staff, staff, general_staff.
        </Text>

        <TextInput
          value={csvText}
          onChangeText={setCsvText}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          className="bg-white border border-slate-200 rounded-xl p-3 mb-4 min-h-[220px]"
        />

        <View className="bg-white rounded-xl p-4 mb-4 border border-slate-200">
          <Text className="font-bold text-slate-900 mb-2">
            Preview: {validRows.length} valid row{validRows.length === 1 ? "" : "s"}
          </Text>
          {validRows.slice(0, 6).map((row, index) => (
            <Text key={`${row.email}-${index}`} className="text-sm text-slate-600 mb-1">
              {index + 1}. {row.name} - {row.email} ({row.roleType})
            </Text>
          ))}
          {validRows.length > 6 ? (
            <Text className="text-xs text-slate-500">And {validRows.length - 6} more...</Text>
          ) : null}
        </View>

        {result ? <Text className="text-slate-800 mb-3">{result}</Text> : null}

        <Pressable
          onPress={handleImport}
          disabled={importing}
          className="bg-primary py-3 rounded-xl"
          style={importing ? { opacity: 0.7 } : undefined}
        >
          <Text className="text-white text-center font-semibold">
            {importing ? "Importing..." : "Import Staff"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}
