// mobile/app/(auth)/verify-email.tsx
import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { getCurrentUser, reloadCurrentUser, sendEmailVerificationToCurrentUser, signOutUser } from "../../src/services/auth";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [checking, setChecking] = useState(false);

const [user, setUser] = useState<any | null>(null);

useEffect(() => {
  try {
    const u = getCurrentUser();
    setUser(u);
  } catch {
    setUser(null);
  }
}, []);


  function goToLoginUnverified(router: any) {
  router.replace({
    pathname: "/(auth)/login",
    params: { unverified: "1" },
  });
}

  useEffect(() => {
    // if user is not present, send them back to login
    if (!user) {
      router.replace("/(auth)/login");
    }
  }, [user, router]);

  async function handleResend() {
    setResendLoading(true);
    try {
      await sendEmailVerificationToCurrentUser();
      Alert.alert("Verification email sent", "Please check your email (and spam folder).");
    } catch (err: any) {
      Alert.alert("Failed to send email", err?.message ?? String(err));
    } finally {
      setResendLoading(false);
    }
  }

 async function handleCheck() {
  setChecking(true);
  try {
    const reloaded = await reloadCurrentUser();
    if (reloaded && reloaded.emailVerified) {
      // ✅ verified — force fresh login
      router.replace("/(auth)/login");
    } else {
     Alert.alert(
  "Not verified",
  "We couldn't detect verification. Try again after confirming in your email.",
  [
    {
      text: "OK",
      onPress: () => goToLoginUnverified(router),
    },
  ]
);

    }
  } catch (err: any) {
    Alert.alert("Error", err?.message ?? String(err));
  } finally {
    setChecking(false);
  }
}

  async function handleSignOut() {
    try {
    await signOutUser();
goToLoginUnverified(router);

    } catch (err: any) {
      Alert.alert("Sign out failed", err?.message ?? String(err));
    }
  }

  if (!user) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View className="flex-1 p-6 bg-white justify-center">
      <Text className="text-xl font-semibold mb-2">Verify your email</Text>
      <Text className="text-sm text-neutral mb-6">A verification link was sent to: {user.email}</Text>

      <Pressable onPress={handleResend} className="bg-primary py-3 rounded mb-3" disabled={resendLoading}>
        <Text className="text-white text-center">{resendLoading ? "Sending…" : "Resend verification email"}</Text>
      </Pressable>

      <Pressable onPress={handleCheck} className="py-3 rounded mb-3 border" disabled={checking}>
        <Text className="text-center">{checking ? "Checking…" : "I verified — Check now"}</Text>
      </Pressable>

      <Pressable onPress={handleSignOut} className="py-3 rounded border">
        <Text className="text-center text-red-600">Sign out</Text>
      </Pressable>

      <View style={{ marginTop: 12 }}>
       <Link
  href={{
    pathname: "/(auth)/login",
    params: { unverified: "1" },
  }}
  asChild
>

          <Pressable>
            <Text className="text-sm text-neutral text-center mt-3">Back to sign in</Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}
