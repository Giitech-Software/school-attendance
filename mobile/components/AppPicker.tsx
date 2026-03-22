// mobile/components/AppPicker.tsx
import React from "react";
import { Platform } from "react-native";
import { Picker, PickerProps } from "@react-native-picker/picker";

export default function AppPicker<T>(props: PickerProps<T>) {
  return (
    <Picker
      {...props}
      style={[
        { color: "#0f172a" }, // REQUIRED for Android
        props.style,
      ]}
      {...(Platform.OS === "android" && {
        dropdownIconColor: "#0f172a",
      })}
    />
  );
}
