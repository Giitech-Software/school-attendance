// mobile/app/(auth)/post-login.tsx
import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { getCurrentUser } from "../../src/services/auth";
import { getUserById } from "../../src/services/users";

export default function PostLogin() {
  const router = useRouter();
  const firebaseUser = getCurrentUser();

  useEffect(() => {
    const checkUser = async () => {
      if (!firebaseUser) {
        router.replace("/(auth)/login");
        return;
      }

      if (!firebaseUser.emailVerified) {
        router.replace("/(auth)/verify-email");
        return;
      }

      const userDoc = await getUserById(firebaseUser.uid);
      if (!userDoc || !userDoc.role) {
        console.warn("PostLogin: userDoc or role missing", userDoc);
        router.replace("/(auth)/login");
        return;
      }

      // ✅ Role-aware approval check (admin skips)
      if (userDoc.role !== "admin" && userDoc.approved !== true) {
        router.replace("/(auth)/pending-approval");
        return;
      }

      // ✅ Role-based routing
      switch (userDoc.role) {
        case "parent":
          router.replace("/wards");
          break;

        case "teacher":
        case "non_teaching_staff":
        case "staff":
        case "admin": // admin goes straight to index
          router.replace("/"); // landing page
          break;

        default:
          router.replace("/"); // fallback
      }
    };

    checkUser();
  }, [firebaseUser, router]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
    </View>
  );
}
