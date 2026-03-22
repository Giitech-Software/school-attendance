//app/components/Avatar.tsx
import React from "react";
import { View, Text } from "react-native";

function initialsFromEmail(email?: string | null): string {
  if (!email) return "U";
  const name = email.split("@")[0] || "U";
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({
  email,
  size = 48,
}: {
  email?: string | null;
  size?: number;
}) {
  return (
    <View
      className="bg-primary rounded-full items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-light font-bold" style={{ fontSize: size * 0.4 }}>
        {initialsFromEmail(email)}
      </Text>
    </View>
  );
}
