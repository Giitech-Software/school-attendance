import { NativeModules, Platform } from "react-native";

type FaceLivenessNativeModule = { start(sessionId: string, region: string, credentials: Record<string, unknown>): Promise<boolean> };

export async function startNativeFaceLiveness(sessionId: string, region: string) {
  if (Platform.OS !== "android") throw new Error("Native Android Face Liveness is not available on this platform yet.");
  const module = NativeModules.FaceLiveness as FaceLivenessNativeModule | undefined;
  if (!module?.start) throw new Error("This Android app build does not include the Face Liveness native module. Install a newly built APK after the Face Liveness config plugin has been applied. Expo Go cannot run this native feature.");
  const { getMobileFaceLivenessCredentials } = await import("./faceLiveness");
  const credentials = await getMobileFaceLivenessCredentials(sessionId);
  return module.start(sessionId, region, credentials);
}
