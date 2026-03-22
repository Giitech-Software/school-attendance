// mobile/app/(auth)/login.tsx
import React, {useState} from "react";
import AppInput from "@/components/AppInput";

import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { signIn, signOutUser } from "@/src/services/auth";
import { getUserById} from "@/src/services/users";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);


  async function handleLogin() {
  if (!email.trim() || !password) {
    Alert.alert("Validation", "Email and password are required.");
    return;
  }

  setLoading(true);
  try {
    const cred = await signIn(email.trim(), password);

    if (!cred.user.emailVerified) {
      await signOutUser();

      Alert.alert(
        "Email not verified",
        "Please verify your email before logging in.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(auth)/verify-email"),
          },
        ]
      );
      return;
    }

    const user = await getUserById(cred.user.uid);
    if (!user) throw new Error("User profile not found");

  // 🔐 Approval gate (role-aware)
if (user.role !== "admin" && user.approved !== true) {
  router.replace("/(auth)/pending-approval");
  return;
}
if (user.role !== "admin" && user.approved !== true) {
  await signOutUser();
  router.replace("/(auth)/pending-approval");
  return;
}




// ✅ Existing role-based logic (unchanged)
if (user.role === "parent" || (user.wards?.length ?? 0) > 0) {
  router.replace("/wards");
} else {
  router.replace("/");
}

 } catch (err: any) {
  const code = err?.code ?? "";

  let message = "Unable to sign in.";

  if (
    code === "auth/user-not-found" ||
    code === "auth/invalid-credential"
  ) {
    message =
      "You are not registered or your login details are incorrect. Please create an account.";
  } else if (code === "auth/wrong-password") {
    message = "Incorrect password. Please try again.";
  } else if (code === "auth/too-many-requests") {
    message =
      "Too many failed attempts. Please wait a moment or reset your password.";
  } else if (code === "auth/invalid-email") {
    message = "Invalid email address.";
  }

  Alert.alert("Login failed", message);
}
 finally {
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
          <Text className="text-3xl font-bold mb-4 text-center">
            Sign In 
          </Text>

          {/* Email */}
          <Text className="text-m text-slate-600 mb-1">Email</Text>
          <AppInput
  value={email}
  onChangeText={setEmail}
  placeholder="you@example.com"
  keyboardType="email-address"
  className="border p-3 rounded-xl mb-3 bg-white"
/>


          {/* Password */}
          <Text className="text-m text-slate-600 mb-1">Password</Text>
         <AppInput
  value={password}
  onChangeText={setPassword}
  placeholder="Your password"
  secureTextEntry={!showPassword}
  className="border p-3 rounded-xl mb-1 bg-white"
  onSubmitEditing={handleLogin}
/>
 

          {/* Show / Hide password */}
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Text className="text-m text-blue-600 mb-4">
              {showPassword ? "Hide password" : "Show password"}
            </Text>
          </Pressable>

          {/* Forgot password */}
          <View className="items-end mb-4">
            <Link href="/(auth)/forgot-password" asChild>
              <Pressable>
                <Text className="text-sm text-blue-600">
                  Forgot password?
                </Text>
              </Pressable> 
            </Link>
          </View>

          {/* Login button */}
          <Pressable
            onPress={handleLogin}
            className="bg-primary py-3 rounded-xl mb-3"
            disabled={loading}
          >
            <Text className="text-white text-center text-xl">
              {loading ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>

          {/* Link to signup */}
          <View className="flex-row justify-center">
            <Text className="text-m text-neutral mr-2">
              Don’t have an account?
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text className="text-primary text-m">
                  Create account
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>

       
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
