import * as Location from "expo-location";
import { getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../app/firebase";
import { logAdminAction } from "./adminLogs";

const LOCATION_DOC = doc(db, "settings", "location");
const LOCATION_SAMPLE_COUNT = 3;
const CURRENT_LOCATION_TIMEOUT_MS = 8_000;
const MAX_ACCEPTABLE_ACCURACY_METERS = 80;
const MAX_ACCURACY_BUFFER_METERS = 120;
const CAMPUS_SERVER_TIMEOUT_MS = 2500;

export type PresenceVerificationMode =
  | "gps"
  | "campus_network"
  | "campus_network_or_gps"
  | "wifi_bssid"
  | "wifi_bssid_or_gps"
  | "campus_network_or_wifi_bssid_or_gps"
  | "disabled";

export type CampusServerSettings = {
  enabled: boolean;
  baseUrl: string;
  tokenEndpoint: string;
  pairEndpoint?: string | null;
  institutionId?: string | null;
  serverName?: string | null;
  publicKey?: string | null;
  pairedAt?: string | null;
  pairedBy?: string | null;
};

export type InstitutionWifiNetwork = {
  enabled: boolean;
  bssid: string;
  ssid?: string | null;
  label?: string | null;
};

type SchoolLocationSettings = {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  geofencingEnabled: boolean;
  geofencingDisabledReason?: string | null;
  geofencingDisabledBy?: string | null;
  geofencingDisabledUntil?: string | null;
  presenceVerificationMode?: PresenceVerificationMode;
  campusServer?: CampusServerSettings | null;
  institutionWifiNetworks?: InstitutionWifiNetwork[];
  setupAccuracyMeters?: number | null;
  updatedAt?: any;
};

type ConfiguredSchoolLocationSettings = SchoolLocationSettings & {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type Coords = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export type LocationValidationResult = {
  verificationMethod:
    | "gps"
    | "campus_network"
    | "wifi_bssid"
    | "geofence_bypass";
  campusNetworkVerified?: boolean;
  campusServerName?: string | null;
  campusInstitutionId?: string | null;
  campusTokenExpiresAt?: string | null;
  wifiBssidVerified?: boolean;
  wifiBssid?: string | null;
  wifiSsid?: string | null;
  wifiLabel?: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  distanceMeters: number | null;
  allowedDistanceMeters: number | null;
  radiusMeters: number | null;
  geofencingBypassed: boolean;
  bypassReason?: string | null;
  bypassedBy?: string | null;
  bypassExpiresAt?: string | null;
};

export type SchoolLocationReadiness = {
  configured: boolean;
  geofencingEnabled: boolean;
  emergencyBypassActive: boolean;
  presenceVerificationMode: PresenceVerificationMode;
  campusServer: CampusServerSettings | null;
  institutionWifiNetworks: InstitutionWifiNetwork[];
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  setupAccuracyMeters?: number | null;
  disabledReason?: string | null;
  disabledBy?: string | null;
  disabledUntil?: string | null;
  updatedAt?: any;
};

/**
 * Validates that the device is inside the configured school geofence.
 * GPS can drift indoors, so we add a capped accuracy buffer instead of
 * rejecting a user because of one noisy reading.
 */
export async function validateSchoolLocation(): Promise<LocationValidationResult> {
  const settings = await getSchoolLocationSettings();
  const mode = getPresenceVerificationMode(settings);

  if (mode === "disabled" || (!settings.geofencingEnabled && isBypassActive(settings))) {
    return {
      verificationMethod: "geofence_bypass",
      campusNetworkVerified: false,
      latitude: null,
      longitude: null,
      accuracyMeters: null,
      distanceMeters: null,
      allowedDistanceMeters: null,
      radiusMeters: settings.radiusMeters,
      geofencingBypassed: true,
      bypassReason:
        settings.geofencingDisabledReason ?? "Geofencing disabled by admin",
      bypassedBy: settings.geofencingDisabledBy ?? null,
      bypassExpiresAt: settings.geofencingDisabledUntil ?? null,
    };
  }

  if (
    mode === "campus_network" ||
    mode === "campus_network_or_gps" ||
    mode === "campus_network_or_wifi_bssid_or_gps"
  ) {
    const campusResult = await validateCampusNetwork(settings).catch((error) => {
      if (mode === "campus_network") {
        throw error;
      }
      return null;
    });

    if (campusResult) {
      return campusResult;
    }
  }

  if (usesWifiBssid(mode)) {
    const wifiResult = await validateInstitutionWifi(settings).catch((error) => {
      if (mode === "wifi_bssid") {
        throw error;
      }
      return null;
    });

    if (wifiResult) {
      return wifiResult;
    }
  }

  if (!isConfigured(settings)) {
    throw new Error(
      mode === "campus_network_or_gps"
        || mode === "wifi_bssid_or_gps"
        || mode === "campus_network_or_wifi_bssid_or_gps"
        ? "Campus server unavailable and school GPS location is not configured"
        : "School location not configured"
    );
  }

  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Location permission is required for check-in");
  }

  const current = await getReliableCurrentCoords();

  const distance = getDistanceInMeters(
    current.latitude,
    current.longitude,
    settings.latitude,
    settings.longitude
  );

  const accuracyBuffer = Math.min(
    Math.max(current.accuracy ?? 0, 0),
    MAX_ACCURACY_BUFFER_METERS
  );
  const allowedDistance = settings.radiusMeters + accuracyBuffer;

  if (distance > allowedDistance) {
    const accuracyText =
      typeof current.accuracy === "number"
        ? ` GPS accuracy: +/-${Math.round(current.accuracy)}m.`
        : "";

    throw new Error(
      `You are outside the school premises (${Math.round(
        distance
      )}m away; allowed ${settings.radiusMeters}m).${accuracyText}`
    );
  }

  return {
    verificationMethod: "gps",
    campusNetworkVerified: false,
    latitude: current.latitude,
    longitude: current.longitude,
    accuracyMeters: current.accuracy ?? null,
    distanceMeters: distance,
    allowedDistanceMeters: allowedDistance,
    radiusMeters: settings.radiusMeters,
    geofencingBypassed: false,
  };
}

async function getSchoolLocationSettings(): Promise<SchoolLocationSettings> {
  const snap = await getDoc(LOCATION_DOC);

  if (!snap.exists()) {
    return {
      latitude: null,
      longitude: null,
      radiusMeters: null,
      geofencingEnabled: true,
    };
  }

  const data = snap.data();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const radiusMeters = Number(data.radiusMeters);

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radiusMeters:
      Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : null,
    geofencingEnabled: data.geofencingEnabled !== false,
    presenceVerificationMode: parsePresenceVerificationMode(
      data.presenceVerificationMode,
      data.geofencingEnabled !== false
    ),
    campusServer: parseCampusServerSettings(data.campusServer),
    institutionWifiNetworks: parseInstitutionWifiNetworks(
      data.institutionWifiNetworks
    ),
    geofencingDisabledReason: data.geofencingDisabledReason ?? null,
    geofencingDisabledBy: data.geofencingDisabledBy ?? null,
    geofencingDisabledUntil: data.geofencingDisabledUntil ?? null,
    setupAccuracyMeters:
      typeof data.setupAccuracyMeters === "number"
        ? data.setupAccuracyMeters
        : null,
    updatedAt: data.updatedAt,
  };
}

export async function getSchoolLocationReadiness(): Promise<SchoolLocationReadiness> {
  const settings = await getSchoolLocationSettings();

  return {
    configured: isConfigured(settings),
    geofencingEnabled: settings.geofencingEnabled,
    emergencyBypassActive:
      !settings.geofencingEnabled && isBypassActive(settings),
    presenceVerificationMode: getPresenceVerificationMode(settings),
    campusServer: settings.campusServer ?? null,
    institutionWifiNetworks: settings.institutionWifiNetworks ?? [],
    latitude: settings.latitude,
    longitude: settings.longitude,
    radiusMeters: settings.radiusMeters,
    setupAccuracyMeters: settings.setupAccuracyMeters,
    disabledReason: settings.geofencingDisabledReason ?? null,
    disabledBy: settings.geofencingDisabledBy ?? null,
    disabledUntil: settings.geofencingDisabledUntil ?? null,
    updatedAt: settings.updatedAt,
  };
}

export async function savePresenceVerificationSettings({
  mode,
  campusServer,
  institutionWifiNetworks,
  adminUid,
}: {
  mode: PresenceVerificationMode;
  campusServer?: CampusServerSettings | null;
  institutionWifiNetworks?: InstitutionWifiNetwork[];
  adminUid?: string | null;
}) {
  await setDoc(
    LOCATION_DOC,
    {
      presenceVerificationMode: mode,
      geofencingEnabled: mode !== "disabled",
      campusServer: campusServer ?? null,
      institutionWifiNetworks: institutionWifiNetworks ?? [],
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await logAdminAction({
    action: "UPDATE_PRESENCE_VERIFICATION",
    targetType: "settings",
    targetId: "location",
    description: "Updated attendance presence verification settings",
    metadata: {
      mode,
      campusServerEnabled: campusServer?.enabled === true,
      campusServerBaseUrl: campusServer?.baseUrl ?? null,
      institutionWifiCount: institutionWifiNetworks?.length ?? 0,
      adminUid,
    },
  });
}

export async function pairCampusServer({
  baseUrl,
  pairEndpoint = "/pair",
  setupCode,
  institutionId,
  adminUid,
}: {
  baseUrl: string;
  pairEndpoint?: string;
  setupCode: string;
  institutionId?: string | null;
  adminUid?: string | null;
}): Promise<CampusServerSettings> {
  const url = buildCampusUrl(baseUrl, pairEndpoint);
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setupCode,
      institutionId: institutionId ?? null,
      requestedBy: adminUid ?? auth.currentUser?.uid ?? null,
      requestedAt: new Date().toISOString(),
    }),
  });

  const data = await readJson(response);
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || "Campus server pairing failed.");
  }

  return {
    enabled: true,
    baseUrl: trimTrailingSlash(data?.baseUrl || baseUrl),
    tokenEndpoint: normalizeEndpoint(data?.tokenEndpoint || "/verify-attendance"),
    pairEndpoint: normalizeEndpoint(data?.pairEndpoint || pairEndpoint),
    institutionId: data?.institutionId ?? institutionId ?? null,
    serverName: data?.serverName ?? "Campus attendance server",
    publicKey: data?.publicKey ?? null,
    pairedAt: data?.pairedAt ?? new Date().toISOString(),
    pairedBy: adminUid ?? auth.currentUser?.uid ?? null,
  };
}

export async function setEmergencyGeofenceBypass({
  enabled,
  reason,
  adminUid,
  expiresAt,
}: {
  enabled: boolean;
  reason?: string;
  adminUid?: string;
  expiresAt?: string | null;
}) {
  await setDoc(
    LOCATION_DOC,
    enabled
      ? {
          geofencingEnabled: false,
          presenceVerificationMode: "disabled",
          geofencingDisabledReason:
            reason?.trim() || "Emergency attendance mode enabled by admin",
          geofencingDisabledBy: adminUid ?? null,
          geofencingDisabledUntil: expiresAt ?? endOfTodayIso(),
          updatedAt: serverTimestamp(),
        }
      : {
          geofencingEnabled: true,
          presenceVerificationMode: "gps",
          geofencingDisabledReason: null,
          geofencingDisabledBy: null,
          geofencingDisabledUntil: null,
          updatedAt: serverTimestamp(),
        },
    { merge: true }
  );
  await logAdminAction({
    action: enabled
      ? "ENABLE_GEOFENCE_BYPASS"
      : "DISABLE_GEOFENCE_BYPASS",
    targetType: "settings",
    targetId: "location",
    description: enabled
      ? "Enabled emergency geofence bypass"
      : "Disabled emergency geofence bypass",
    metadata: {
      reason,
      adminUid,
      expiresAt,
    },
  });
}

function isConfigured(
  settings: SchoolLocationSettings
): settings is ConfiguredSchoolLocationSettings {
  return (
    typeof settings.latitude === "number" &&
    typeof settings.longitude === "number" &&
    typeof settings.radiusMeters === "number" &&
    settings.radiusMeters > 0
  );
}

function isBypassActive(settings: SchoolLocationSettings) {
  if (settings.geofencingEnabled) return false;
  if (!settings.geofencingDisabledUntil) return true;

  const until = new Date(settings.geofencingDisabledUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
}

function getPresenceVerificationMode(settings: SchoolLocationSettings) {
  return (
    settings.presenceVerificationMode ??
    (settings.geofencingEnabled === false ? "disabled" : "gps")
  );
}

function parsePresenceVerificationMode(
  value: any,
  geofencingEnabled: boolean
): PresenceVerificationMode {
  if (
    value === "gps" ||
    value === "campus_network" ||
    value === "campus_network_or_gps" ||
    value === "wifi_bssid" ||
    value === "wifi_bssid_or_gps" ||
    value === "campus_network_or_wifi_bssid_or_gps" ||
    value === "disabled"
  ) {
    return value;
  }

  return geofencingEnabled ? "gps" : "disabled";
}

function usesWifiBssid(mode: PresenceVerificationMode) {
  return (
    mode === "wifi_bssid" ||
    mode === "wifi_bssid_or_gps" ||
    mode === "campus_network_or_wifi_bssid_or_gps"
  );
}

function parseInstitutionWifiNetworks(value: any): InstitutionWifiNetwork[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): InstitutionWifiNetwork[] => {
      if (!item || typeof item !== "object") return [];
      const bssid = normalizeBssid(item.bssid);
      if (!bssid) return [];

      return [{
        enabled: item.enabled !== false,
        bssid,
        ssid: typeof item.ssid === "string" ? item.ssid.trim() || null : null,
        label:
          typeof item.label === "string" ? item.label.trim() || null : null,
      }];
    });
}

async function validateInstitutionWifi(
  settings: SchoolLocationSettings
): Promise<LocationValidationResult> {
  const trustedNetworks = (settings.institutionWifiNetworks ?? []).filter(
    (network) => network.enabled
  );
  if (trustedNetworks.length === 0) {
    throw new Error("Institution WiFi BSSID is not configured.");
  }

  const currentWifi = await getCurrentWifiNetwork();
  if (!currentWifi?.bssid) {
    throw new Error(
      "WiFi BSSID could not be read on this device. Use campus server or GPS verification."
    );
  }

  const currentBssid = normalizeBssid(currentWifi.bssid);
  const matched = trustedNetworks.find(
    (network) => normalizeBssid(network.bssid) === currentBssid
  );

  if (!matched) {
    throw new Error("Device is not connected to an approved institution WiFi.");
  }

  return {
    verificationMethod: "wifi_bssid",
    campusNetworkVerified: false,
    wifiBssidVerified: true,
    wifiBssid: currentBssid,
    wifiSsid: currentWifi.ssid ?? matched.ssid ?? null,
    wifiLabel: matched.label ?? null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    distanceMeters: null,
    allowedDistanceMeters: null,
    radiusMeters: settings.radiusMeters,
    geofencingBypassed: false,
  };
}

async function getCurrentWifiNetwork(): Promise<{
  bssid: string | null;
  ssid?: string | null;
} | null> {
  return null;
}

function normalizeBssid(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/-/g, ":");
}

function parseCampusServerSettings(value: any): CampusServerSettings | null {
  if (!value || typeof value !== "object") return null;
  const baseUrl = typeof value.baseUrl === "string" ? value.baseUrl.trim() : "";
  const tokenEndpoint =
    typeof value.tokenEndpoint === "string"
      ? value.tokenEndpoint.trim()
      : "/verify-attendance";

  if (!baseUrl) return null;

  return {
    enabled: value.enabled === true,
    baseUrl: trimTrailingSlash(baseUrl),
    tokenEndpoint: normalizeEndpoint(tokenEndpoint),
    pairEndpoint:
      typeof value.pairEndpoint === "string"
        ? normalizeEndpoint(value.pairEndpoint)
        : "/pair",
    institutionId: value.institutionId ?? null,
    serverName: value.serverName ?? null,
    publicKey: value.publicKey ?? null,
    pairedAt: value.pairedAt ?? null,
    pairedBy: value.pairedBy ?? null,
  };
}

async function validateCampusNetwork(
  settings: SchoolLocationSettings
): Promise<LocationValidationResult> {
  const campusServer = settings.campusServer;
  if (!campusServer?.enabled || !campusServer.baseUrl) {
    throw new Error("Campus network server is not configured.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Sign in again before recording attendance.");
  }

  const idToken = await currentUser.getIdToken().catch(() => null);
  const nonce = createNonce();
  const response = await fetchWithTimeout(
    buildCampusUrl(campusServer.baseUrl, campusServer.tokenEndpoint),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        email: currentUser.email ?? null,
        institutionId: campusServer.institutionId ?? null,
        nonce,
        requestedAt: new Date().toISOString(),
        platform: "mobile",
      }),
    }
  );

  const data = await readJson(response);
  if (!response.ok || data?.ok !== true) {
    throw new Error(data?.message || "Campus network verification failed.");
  }

  return {
    verificationMethod: "campus_network",
    campusNetworkVerified: true,
    campusServerName: data?.serverName ?? campusServer.serverName ?? null,
    campusInstitutionId:
      data?.institutionId ?? campusServer.institutionId ?? null,
    campusTokenExpiresAt: data?.expiresAt ?? null,
    latitude: null,
    longitude: null,
    accuracyMeters: null,
    distanceMeters: null,
    allowedDistanceMeters: null,
    radiusMeters: settings.radiusMeters,
    geofencingBypassed: false,
  };
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeEndpoint(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "/verify-attendance";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCampusUrl(baseUrl: string, endpoint: string) {
  return `${trimTrailingSlash(baseUrl)}${normalizeEndpoint(endpoint)}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit
): Promise<Response> {
  return Promise.race([
    fetch(url, init),
    new Promise<Response>((_, reject) =>
      setTimeout(
        () => reject(new Error("Campus server did not respond in time.")),
        CAMPUS_SERVER_TIMEOUT_MS
      )
    ),
  ]);
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function endOfTodayIso() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
}

async function getReliableCurrentCoords(): Promise<Coords> {
  const samples: Coords[] = [];

  for (let index = 0; index < LOCATION_SAMPLE_COUNT; index += 1) {
    const current = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      }),
      CURRENT_LOCATION_TIMEOUT_MS
    ).catch(() => null);

    if (current?.coords) {
      samples.push(current.coords);
    }
  }

  if (samples.length > 0) {
    return chooseBestCoords(samples);
  }

  throw new Error(
    "Could not get your current location. Please turn on GPS and try again."
  );
}

function chooseBestCoords(samples: Coords[]): Coords {
  const accurateSamples = samples.filter((sample) => {
    if (typeof sample.accuracy !== "number") return false;
    return sample.accuracy <= MAX_ACCEPTABLE_ACCURACY_METERS;
  });

  if (accurateSamples.length === 0) {
    const best = [...samples].sort(
      (a, b) =>
        (a.accuracy ?? Number.MAX_SAFE_INTEGER) -
        (b.accuracy ?? Number.MAX_SAFE_INTEGER)
    )[0];

    const accuracyText =
      typeof best?.accuracy === "number" ? ` Current accuracy is +/-${Math.round(best.accuracy)}m.` : "";

    throw new Error(
      `Location accuracy is too low for attendance.${accuracyText} Move closer to an open area, turn on high-accuracy location, and try again.`
    );
  }

  const latitudes = accurateSamples.map((sample) => sample.latitude).sort((a, b) => a - b);
  const longitudes = accurateSamples.map((sample) => sample.longitude).sort((a, b) => a - b);
  const bestAccuracy = Math.min(
    ...accurateSamples.map((sample) => sample.accuracy ?? MAX_ACCEPTABLE_ACCURACY_METERS)
  );

  return {
    latitude: median(latitudes),
    longitude: median(longitudes),
    accuracy: bestAccuracy,
  };
}

function median(values: number[]) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Location request timed out")),
      timeoutMs
    );

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Haversine distance formula.
 */
function getDistanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMeters = 6371e3;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}
