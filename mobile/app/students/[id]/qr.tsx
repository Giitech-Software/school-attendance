// mobile/app/students/[id]/qr.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getStudentById } from "../../../src/services/students";
import UserQrCode from "../../../components/UserQrCode";
import { generateQrPayload } from "../../../src/services/qr";
import { getStudentLabel } from "../../../src/utils/studentLabel";
import { useRequireAdmin } from "../../../src/hooks/useRouteAuthorization";

export default function StudentQrScreen() {
  const { id } = useLocalSearchParams();
  const { loading: adminLoading, ready: adminReady } = useRequireAdmin();
  const studentId = Array.isArray(id) ? id[0] : id;

  const [student, setStudent] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    (async () => {
      if (!studentId) return;
      const s = await getStudentById(studentId);
      if (!s) return;
      setStudent(s);

    const qr = await generateQrPayload(
  s.studentId ?? s.id, // ✅ use human-readable studentId
  "student",
  s.classId
);



      setPayload(qr);
    })();
  }, [studentId]);

  if (adminLoading || !adminReady || !student || !payload) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white p-6 items-center">
     <Text className="text-2xl font-semibold mb-4">
  {getStudentLabel(student)}'s QR Code
</Text>


      <UserQrCode payload={payload} />

      <Text className="text-sm text-neutral mt-4">
        This code is linked to the student profile.
      </Text>
    </View>
  );
}
