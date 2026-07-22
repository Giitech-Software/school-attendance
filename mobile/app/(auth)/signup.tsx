// mobile/app/(auth)/signup.tsx
import React, { JSX, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import {
  signUp,
  sendEmailVerificationToCurrentUser,
} from "../../src/services/auth";
import { upsertUser } from "../../src/services/users"; // optional, keep if you have it
import { getTenantInviteByCode, normalizeInviteCode, type TenantInvite } from "../../src/services/tenants";
import { updateProfile } from "firebase/auth"; // optional to update Firebase Auth displayName
import { type UserRole } from "../../src/services/constants/roles";

import { Picker } from "@react-native-picker/picker";

import AppPicker from "@/components/AppPicker";
import AppInput from "@/components/AppInput";
import { getFriendlyAuthErrorMessage } from "@/src/utils/friendlyError";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function Signup(): JSX.Element {
  const router = useRouter();

  const [fullName, setFullName] = useState(""); // ✅ added
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
const [role, setRole] = useState<UserRole>("teacher"); // default is safe



  async function handleSignup() {
    if (!fullName.trim() || !email.trim() || !password || !confirm) {
      Alert.alert("Validation", "Please fill all fields.");
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert("Validation", "Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Validation", "Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Validation", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const normalizedInviteCode = normalizeInviteCode(inviteCode);
      let tenantInvite: TenantInvite | null = null;

      if (normalizedInviteCode) {
        tenantInvite = await getTenantInviteByCode(normalizedInviteCode);
        if (!tenantInvite) {
          Alert.alert("Invalid invite", "Ask your administrator for the latest tenant invite code.");
          return;
        }
      }

      const credential = await signUp(email.trim(), password);

      // Optional: update Firebase Auth displayName
      try {
        await updateProfile(credential.user, {
          displayName: fullName.trim() || undefined,
        });
      } catch (e) {
        console.warn("Failed to update Firebase Auth displayName:", e);
      }
const safeRole: UserRole =
  role === "admin" || role === "super_admin" ? "teacher" : role;

      // Create Firestore user profile
     
try {
  if (typeof upsertUser === "function") {
   await upsertUser({
  id: credential.user.uid,
  email: email.trim(),
  role: safeRole,                 // role is informational only
  displayName: fullName.trim(),

  // 🔐 HARD SECURITY DEFAULTS
  approved: false,
  canTakeStaffAttendance: false,
  canTakeStudentAttendance: false,

  ...(tenantInvite ? {
    tenantId: tenantInvite.tenantId,
    tenantName: tenantInvite.tenantName,
    tenantType: tenantInvite.tenantType,
    tenantInviteCode: tenantInvite.code,
  } : {}),

  createdAt: new Date(),
});

  }
} catch (e) {
  console.warn("upsertUser failed:", e);
}
      try {
        await sendEmailVerificationToCurrentUser();
      } catch (e) {
        console.warn("Failed to send verification email:", e);
      }

      router.replace("/(auth)/verify-email");
    } catch (err: any) {
      Alert.alert(
        "Signup failed",
        getFriendlyAuthErrorMessage(
          err,
          "Unable to create your account. Please try again."
        )
      );
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
          <Text className="text-3xl font-bold mb-4 text-center">
            Create an account
          </Text>

          {/* Full Name */}
          <Text className="text-m text-slate-600 mb-1">Full Name</Text>
         <AppInput
  value={fullName}
  onChangeText={setFullName}
  placeholder="Your full name"
  className="border p-3 rounded-xl mb-3 bg-white"
/>

{/* Role selection */}<Text className="text-m text-slate-600 mb-1">Register as</Text>
<View className="border rounded-xl mb-3 overflow-hidden">
<AppPicker
  selectedValue={role}
  onValueChange={(value) => setRole(value)}
>
  <Picker.Item label="Parent" value="parent" />
  <Picker.Item label="Teacher" value="teacher" />
  <Picker.Item label="Non-Teaching Staff" value="non_teaching_staff" />
  <Picker.Item label="Staff" value="staff" />
</AppPicker>

</View>



          {/* Email */}
          <Text className="text-m text-slate-600 mb-1">Email</Text>
          <AppInput
  value={email}
  onChangeText={setEmail}
  placeholder="you@example.com"
  keyboardType="email-address"
  className="border p-3 rounded-xl mb-3 bg-white"
/>


          <Text className="text-m text-slate-600 mb-1">Tenant invite code</Text>
          <AppInput
  value={inviteCode}
  onChangeText={(value) => setInviteCode(value.toUpperCase())}
  placeholder="Optional"
  autoCapitalize="characters"
  className="border p-3 rounded-xl mb-3 bg-white"
/>

          {/* Password */}
          <Text className="text-m text-slate-600 mb-1">Password</Text>
         <AppInput
  value={password}
  onChangeText={setPassword}
  placeholder="Create a password"
  secureTextEntry={!showPassword}
  className="border p-3 rounded-xl mb-2 bg-white"
/>

          {/* Confirm Password */}
          <Text className="text-m text-slate-600 mb-1">
            Confirm password
          </Text>
         <AppInput
  value={confirm}
  onChangeText={setConfirm}
  placeholder="Confirm password"
  secureTextEntry={!showPassword}
  className="border p-3 rounded-xl mb-1 bg-white"
  onSubmitEditing={handleSignup}
/>


          {/* Show / Hide password toggle */}
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Text className="text-m text-blue-600 mb-4">
              {showPassword ? "Hide password" : "Show password"}
            </Text>
          </Pressable>

          {/* Signup button */}
          <Pressable
            onPress={handleSignup}
            className="bg-primary py-3 rounded-xl mb-3"
            disabled={loading}
          >
            <Text className="text-white text-center text-xl">
              {loading ? "Creating account…" : "Create account"}
            </Text>
          </Pressable>

          {/* Link to login */}
          <View className="flex-row justify-center">
            <Text className="text-m text-neutral mr-2">
              Already have an account?
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text className="text-primary text-m">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {loading && (
          <View style={{ marginTop: 16 }}>
            <ActivityIndicator />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

