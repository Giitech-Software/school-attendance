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
import { createStudent, listStudents } from "../../src/services/students";
import { listClasses, type ClassRecord } from "../../src/services/classes";
import { parseCsvRows, pickCsvValue } from "../../src/utils/csvImport";

const SAMPLE = `name,classId,studentId,rollNo
Adwoa Mensah,grade-1a,STU-045,12
Kwame Boateng,grade-1a,,13`;

type StudentImportRow = {
  name: string;
  classId?: string;
  className?: string;
  classDocId?: string;
  studentId?: string;
  rollNo?: string;
  isActive?: boolean;
};

type ResolvedStudentImportRow = StudentImportRow & {
  resolvedClass?: ClassRecord;
  resolvedClassId?: string;
};

function normalizeKey(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeBoolean(value?: string) {
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;
  if (["true", "yes", "y", "1", "active"].includes(normalized)) return true;
  if (["false", "no", "n", "0", "inactive"].includes(normalized)) return false;
  return undefined;
}

function getRows(csvText: string): StudentImportRow[] {
  return parseCsvRows(csvText)
    .map((row) => ({
      name: pickCsvValue(row, ["name", "fullName", "studentName"]),
      classId: pickCsvValue(row, ["classId", "classCode"]) || undefined,
      className: pickCsvValue(row, ["className", "class"]) || undefined,
      classDocId: pickCsvValue(row, ["classDocId", "classDocumentId"]) || undefined,
      studentId: pickCsvValue(row, ["studentId", "studentCode", "id"]) || undefined,
      rollNo: pickCsvValue(row, ["rollNo", "roll", "rollNumber"]) || undefined,
      isActive: normalizeBoolean(pickCsvValue(row, ["isActive", "active", "status"])),
    }))
    .filter(
      (row) =>
        row.name ||
        row.classId ||
        row.className ||
        row.classDocId ||
        row.studentId ||
        row.rollNo
    );
}

function resolveClass(row: StudentImportRow, classes: ClassRecord[]) {
  const classDocId = normalizeKey(row.classDocId);
  const classId = normalizeKey(row.classId);
  const className = normalizeKey(row.className);

  return classes.find(
    (cls) =>
      normalizeKey(cls.id) === classDocId ||
      normalizeKey(cls.classId) === classId ||
      normalizeKey(cls.name) === className
  );
}

function resolveRows(
  rows: StudentImportRow[],
  classes: ClassRecord[]
): ResolvedStudentImportRow[] {
  return rows.map((row) => {
    const resolvedClass = resolveClass(row, classes);

    return {
      ...row,
      resolvedClass,
      resolvedClassId: resolvedClass?.classId ?? row.classId?.trim(),
    };
  });
}

export default function StudentBulkImport() {
  const router = useRouter();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const [csvText, setCsvText] = useState(SAMPLE);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const rows = useMemo(() => getRows(csvText), [csvText]);
  const resolvedRows = useMemo(() => resolveRows(rows, classes), [classes, rows]);
  const validRows = resolvedRows.filter((row) => row.name.trim());

  React.useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await listClasses();
        if (active) setClasses(data);
      } catch (error) {
        console.error("listClasses error", error);
        Alert.alert("Failed to load classes", "Student import can still run, but class validation is limited.");
      } finally {
        if (active) setLoadingClasses(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function handleImport() {
    if (validRows.length === 0) {
      Alert.alert("No valid rows", "Add at least one row with a student name.");
      return;
    }

    setImporting(true);
    setResult(null);

    const existing = await listStudents().catch(() => []);
    const existingStudentIds = new Set(
      existing.map((student) => normalizeKey(student.studentId)).filter(Boolean)
    );
    const existingRollKeys = new Set(
      existing
        .map((student) =>
          student.rollNo && student.classId
            ? `${normalizeKey(student.classId)}:${normalizeKey(student.rollNo)}`
            : ""
        )
        .filter(Boolean)
    );
    const seenStudentIds = new Set<string>();
    const seenRollKeys = new Set<string>();
    const errors: string[] = [];
    let created = 0;

    try {
      for (let index = 0; index < validRows.length; index += 1) {
        const row = validRows[index];
        const line = index + 2;
        const studentId = row.studentId?.trim();
        const studentIdKey = normalizeKey(studentId);
        const classValue = row.resolvedClassId?.trim();
        const rollNo = row.rollNo?.trim();
        const hasClassReference = !!(row.classId || row.className || row.classDocId);
        const classReferenceNotResolved =
          hasClassReference &&
          (!classValue || (classes.length > 0 && !row.resolvedClass));

        if (classReferenceNotResolved) {
          errors.push(
            `Line ${line}: class not found (${row.classId ?? row.className ?? row.classDocId})`
          );
          continue;
        }

        if (studentId) {
          if (existingStudentIds.has(studentIdKey) || seenStudentIds.has(studentIdKey)) {
            errors.push(`Line ${line}: duplicate Student ID ${studentId}`);
            continue;
          }
          seenStudentIds.add(studentIdKey);
        }

        const rollKey =
          classValue && rollNo
            ? `${normalizeKey(classValue)}:${normalizeKey(rollNo)}`
            : "";

        if (rollKey) {
          if (existingRollKeys.has(rollKey) || seenRollKeys.has(rollKey)) {
            errors.push(`Line ${line}: duplicate roll no ${rollNo} in ${classValue}`);
            continue;
          }
          seenRollKeys.add(rollKey);
        }

        try {
          const student = await createStudent({
            name: row.name.trim(),
            classId: classValue || undefined,
            studentId: studentId || undefined,
            rollNo: rollNo || undefined,
            isActive: row.isActive,
          });

          if (student.studentId) existingStudentIds.add(normalizeKey(student.studentId));
          if (student.rollNo && student.classId) {
            existingRollKeys.add(
              `${normalizeKey(student.classId)}:${normalizeKey(student.rollNo)}`
            );
          }
          created += 1;
        } catch (error) {
          errors.push(
            `Line ${line}: ${
              error instanceof Error ? error.message : "could not create student"
            }`
          );
        }
      }

      setResult(
        `Created ${created} student${created === 1 ? "" : "s"}${
          errors.length ? `; ${errors.length} skipped.` : "."
        }`
      );

      if (errors.length) {
        Alert.alert("Import finished with skips", errors.slice(0, 6).join("\n"));
      } else {
        Alert.alert("Import complete", `Created ${created} students.`);
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
            Bulk Import Students
          </Text>
        </View>

        <Text className="text-sm text-slate-700 mb-2">
          Paste CSV with headers: name, classId, studentId, rollNo. Student ID is optional.
        </Text>
        <Text className="text-xs text-slate-600 mb-2">
          Class can be matched by classId, className, or classDocId.
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
          {loadingClasses ? (
            <Text className="text-xs text-slate-500 mb-2">Checking classes...</Text>
          ) : null}
          {validRows.slice(0, 6).map((row, index) => (
            <Text key={`${row.name}-${index}`} className="text-sm text-slate-600 mb-1">
              {index + 1}. {row.name}{" "}
              {row.resolvedClassId ? `- ${row.resolvedClassId}` : ""}{" "}
              {row.studentId ? `(${row.studentId})` : ""}
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
            {importing ? "Importing..." : "Import Students"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAwareScreen>
  );
}
