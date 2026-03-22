import React from "react";
import { Stack } from "expo-router";
import KeyboardAwareScreen from "@/components/KeyboardAwareScreen";

export default function AuthLayout() {
  return (
    <KeyboardAwareScreen>
      <Stack
        screenOptions={{
          headerShown: false, // 🔥 THIS removes the header
        }}
      />
    </KeyboardAwareScreen>
  );
}
