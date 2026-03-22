// mobile/src/services/exports/buildAttendancePdf.ts

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

type BuildPdfParams = {
  html: string;
  fileName: string;
};

export async function buildAttendancePdf({
  html,
  fileName,
}: BuildPdfParams) {
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }

  const result = await Print.printToFileAsync({ html });

  if (!result?.uri) {
    throw new Error("Failed to generate PDF");
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: "application/pdf",
    dialogTitle: fileName,
    UTI: "com.adobe.pdf",
  });
}
