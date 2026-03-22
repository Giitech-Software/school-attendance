// mobile/app/(auth)/forgot-password.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/app/firebase";
import AppInput from "@/components/AppInput";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert("Validation", "Please enter your email address.");
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());

      Alert.alert(
        "Email sent",
        "A password reset link has been sent to your email address.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (err: any) {
      console.error("Password reset error:", err);

      let message = err?.message ?? "Unable to send reset email.";
      if (err?.code === "auth/user-not-found") {
        message = "No account found with this email address.";
      } else if (err?.code === "auth/invalid-email") {
        message = "Invalid email address.";
      }

      Alert.alert("Reset failed", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="bg-white rounded-lg p-6">
          {/* Title */}
          <Text className="text-3xl font-bold mb-2 text-center text-slate-900">
            Forgot password
          </Text>

          <Text className="text-sm text-slate-600 mb-6 text-center">
            Enter your email and we’ll send you a password reset link.
          </Text>

          {/* Email */}
          <Text className="text-sm font-medium text-slate-700 mb-1">
            Email
          </Text>
          <AppInput
  value={email}
  onChangeText={setEmail}
  placeholder="you@example.com"
  keyboardType="email-address"
  className="border-2 border-slate-400 rounded-xl px-4 py-3 mb-4 text-base bg-white"
/>

          {/* Reset button */}
          <Pressable
            onPress={handleReset}
            disabled={loading}
            className={`rounded-xl py-4 mb-4 ${
              loading ? "bg-slate-400" : "bg-blue-600"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Send reset link
              </Text>
            )}
          </Pressable>

          {/* Back to login */}
          <View className="flex-row justify-center">
            <Text className="text-sm text-slate-600 mr-2">
              Remembered your password?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-blue-600 font-semibold">
                  Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
