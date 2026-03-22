import * as Location from "expo-location";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../../app/firebase";

/**
 * Validates that user is inside configured school geofence
 */
export async function validateSchoolLocation() {
  // Request permission
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission is required for check-in");
  }

  // Get device location
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  // Get school location from Firestore
  const snap = await getDoc(doc(db, "settings", "location"));

  if (!snap.exists()) {
    throw new Error("School location not configured");
  }

  const { latitude, longitude, radiusMeters } = snap.data();

  const distance = getDistanceInMeters(
    current.coords.latitude,
    current.coords.longitude,
    latitude,
    longitude
  );

  if (distance > radiusMeters) {
    throw new Error(
      `You are outside the school premises (${Math.round(
        distance
      )}m away)`
    );
  }

  return true;
}

/**
 * Haversine distance formula
 */
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}