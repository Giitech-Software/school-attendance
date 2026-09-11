import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

type PresenceData = {
  latitude?: unknown;
  longitude?: unknown;
  accuracyMeters?: unknown;
};

const MAX_ACCURACY_BUFFER_METERS = 120;

export const verifyAttendancePresence = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in before verifying attendance.");
  }

  const db = admin.firestore();
  const userSnap = await db.collection("users").doc(request.auth.uid).get();
  const user = userSnap.data();
  const tenantId = typeof user?.tenantId === "string" ? user.tenantId.trim() : "";
  if (!tenantId) {
    throw new HttpsError("failed-precondition", "Your account is not assigned to an organisation.");
  }

  const locationSnap = await db.collection("settings").doc(`location__${tenantId}`).get();
  const settings = locationSnap.data();
  const geofencingEnabled = settings?.geofencingEnabled !== false;
  const bypassActive = !geofencingEnabled && isBypassActive(settings?.geofencingDisabledUntil);

  if (settings?.presenceVerificationMode === "disabled" || bypassActive) {
    return {
      verificationMethod: "geofence_bypass",
      geofencingBypassed: true,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      distanceMeters: null,
      allowedDistanceMeters: null,
      radiusMeters: numberOrNull(settings?.radiusMeters),
      bypassReason: settings?.geofencingDisabledReason ?? "Geofencing disabled by administrator",
      bypassedBy: settings?.geofencingDisabledBy ?? null,
      bypassExpiresAt: settings?.geofencingDisabledUntil ?? null,
      checkedAt: new Date().toISOString(),
    };
  }

  const data = (request.data ?? {}) as PresenceData;
  const latitude = finiteNumber(data.latitude);
  const longitude = finiteNumber(data.longitude);
  const accuracy = Math.min(Math.max(finiteNumber(data.accuracyMeters) ?? 80, 0), MAX_ACCURACY_BUFFER_METERS);
  const targetLatitude = finiteNumber(settings?.latitude);
  const targetLongitude = finiteNumber(settings?.longitude);
  const radius = numberOrNull(settings?.radiusMeters);

  if (latitude === null || longitude === null || targetLatitude === null || targetLongitude === null || radius === null || radius <= 0) {
    throw new HttpsError("failed-precondition", "School GPS location is not configured correctly.");
  }

  const distance = getDistanceInMeters(latitude, longitude, targetLatitude, targetLongitude);
  if (distance - accuracy > radius) {
    throw new HttpsError("permission-denied", `You appear to be outside the school premises (${Math.round(distance)}m away; GPS accuracy +/-${Math.round(accuracy)}m).`);
  }

  return {
    verificationMethod: "gps",
    geofencingBypassed: false,
    latitude,
    longitude,
    accuracyMeters: accuracy,
    distanceMeters: Math.round(distance),
    allowedDistanceMeters: Math.round(radius + accuracy),
    radiusMeters: radius,
    checkedAt: new Date().toISOString(),
  };
});

function finiteNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrNull(value: unknown): number | null {
  const number = finiteNumber(value);
  return number === null ? null : number;
}

function isBypassActive(until: unknown) {
  if (!until) return true;
  const time = new Date(String(until)).getTime();
  return Number.isFinite(time) && time > Date.now();
}

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusMeters = 6371e3;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
