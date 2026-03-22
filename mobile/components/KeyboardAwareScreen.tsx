import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  View,
} from "react-native";

export default function KeyboardAwareScreen({
  children,
  scrollEnabled = true,
}: {
  children: React.ReactNode;
  scrollEnabled?: boolean;
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 40,
          }}
        >
          <View style={{ flex: 1 }}>{children}</View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
