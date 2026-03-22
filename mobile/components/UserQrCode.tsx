//mobile/components/UserQrCode.tsx
import React from "react";
import QRCode from "react-native-qrcode-svg";
import { View, Text } from "react-native";
import { UserQrPayload } from "../src/services/qr";

type Props = {
  payload: UserQrPayload;
  size?: number;
};

export default function UserQrCode({ payload, size = 220 }: Props) {
  return (
    <View className="items-center justify-center p-4">
      <QRCode
        value={JSON.stringify(payload)}
        size={size}
      />

      <Text className="text-sm text-neutral mt-3">
        Scan to Check-in / Check-out
      </Text>
    </View>
  );
}
