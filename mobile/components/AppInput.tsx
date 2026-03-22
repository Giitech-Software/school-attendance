// mobile/components/AppInput.tsx
import React from "react";
import { TextInput, Platform, TextInputProps } from "react-native";

export default function AppInput(props: TextInputProps) {
  return (
    <TextInput
      {...props}
      placeholderTextColor="rgba(100,116,139,0.35)" // faded placeholder
      autoCorrect={false}
      autoCapitalize="none"
      style={[
        {
          color: "#0f172a",   // strong real text
        },
        props.style,
      ]}
      {...(Platform.OS === "android" && {
        importantForAutofill: "no",
        autoComplete: "off",
      })}
    />
  );
}
