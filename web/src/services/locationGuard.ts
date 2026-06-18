import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

const LOCATION_DOC = doc(db, "settings", "location");
const CAMPUS_SERVER_TIMEOUT_MS = 2500;
const CURRENT_LOCATION_TIMEOUT_MS = 8000;
const MAX_ACCURACY_BUFFER_METERS = 120;

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
  presenceVerificationMode?: PresenceVerificationMode;
  campusServer?: CampusServerSettings | null;
  institutionWifiNetworks?: InstitutionWifiNetwork[];
  geofencingDisabledReason?: string | null;
  geofencingDisabledBy?: string | null;
  geofencingDisabledUntil?: string | null;
  setupAccuracyMeters?: number | null;
  updatedAt?: any;
};

type ConfiguredSchoolLocationSettings = SchoolLocationSettings & {
  latitude: number;
  longitude: number;
  radiusMeters: number;
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

export type LocationValidationResult = {
  verificationMethod: "gps" | "campus_network" | "wifi_bssid" | "geofence_bypass";
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

async function getSchoolLocationSettings(): Promise<SchoolLocationSettings> {
  const snap = await getDoc(LOCATION_DOC);

  if (!snap.exists()) {
    return {
      latitude: null,
      longitude: null,
      radiusMeters: null,
      geofencingEnabled: true,
      presenceVerificationMode: "gps",
      campusServer: null,
      institutionWifiNetworks: [],
    };
  }

  const data = snap.data();
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  const radiusMeters = Number(data.radiusMeters);
  const geofencingEnabled = data.geofencingEnabled !== false;

  return {
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    radiusMeters:
      Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : null,
    geofencingEnabled,
    presenceVerificationMode: parsePresenceVerificationMode(
      data.presenceVerificationMode,
      geofencingEnabled
    ),
    campusServer: parseCampusServerSettings(data.campusServer),
    institutionWifiNetworks: parseInstitutionWifiNetworks(data.institutionWifiNetworks),
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

export async function getSchoolLocationReadiness(): Promise<SchoolLocationReadiness> {
  const settings = await getSchoolLocationSettings();

  return {
    configured: isConfigured(settings),
    geofencingEnabled: settings.geofencingEnabled,
    emergencyBypassActive: !settings.geofencingEnabled && isBypassActive(settings),
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

export async function saveSchoolLocation(config: {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  geofencingEnabled?: boolean;
  presenceVerificationMode?: PresenceVerificationMode;
  campusServer?: CampusServerSettings | null;
  institutionWifiNetworks?: InstitutionWifiNetwork[];
  setupAccuracyMeters?: number | null;
}) {
  await setDoc(
    LOCATION_DOC,
    {
      latitude: config.latitude,
      longitude: config.longitude,
      radiusMeters: config.radiusMeters,
      geofencingEnabled: config.geofencingEnabled !== false,
      presenceVerificationMode: config.presenceVerificationMode ?? "gps",
      campusServer: config.campusServer ?? null,
      institutionWifiNetworks: config.institutionWifiNetworks ?? [],
      setupAccuracyMeters: config.setupAccuracyMeters ?? null,
      geofencingDisabledReason: null,
      geofencingDisabledBy: null,
      geofencingDisabledUntil: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
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
}

export async function validateAttendancePresence(): Promise<LocationValidationResult> {
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
      if (mode === "campus_network") throw error;
      return null;
    });
    if (campusResult) return campusResult;
  }

  if (usesWifiBssid(mode)) {
    const wifiResult = await validateInstitutionWifi(settings).catch((error) => {
      if (mode === "wifi_bssid") throw error;
      return null;
    });
    if (wifiResult) return wifiResult;
  }

  if (!isConfigured(settings)) {
    throw new Error(
      mode === "campus_network_or_gps" ||
        mode === "wifi_bssid_or_gps" ||
        mode === "campus_network_or_wifi_bssid_or_gps"
        ? "Campus/WiFi verification unavailable and school GPS location is not configured."
        : "School location not configured."
    );
  }

  const current = await getBrowserPosition();
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
    throw new Error(
      `You are outside the school premises (${Math.round(
        distance
      )}m away; allowed ${settings.radiusMeters}m).`
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
  const response = await fetchWithTimeout(buildCampusUrl(baseUrl, pairEndpoint), {
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

function endOfTodayIso() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
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
      label: typeof item.label === "string" ? item.label.trim() || null : null,
    }];
  });
}

function parseCampusServerSettings(value: any): CampusServerSettings | null {
  if (!value || typeof value !== "object") return null;
  const baseUrl = typeof value.baseUrl === "string" ? value.baseUrl.trim() : "";
  if (!baseUrl) return null;

  return {
    enabled: value.enabled === true,
    baseUrl: trimTrailingSlash(baseUrl),
    tokenEndpoint: normalizeEndpoint(value.tokenEndpoint || "/verify-attendance"),
    pairEndpoint: normalizeEndpoint(value.pairEndpoint || "/pair"),
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
  if (!currentUser) throw new Error("Sign in again before recording attendance.");
  const idToken = await currentUser.getIdToken().catch(() => null);

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
        nonce: createNonce(),
        requestedAt: new Date().toISOString(),
        platform: "web",
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
    campusInstitutionId: data?.institutionId ?? campusServer.institutionId ?? null,
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
      "WiFi BSSID is not available in this browser. Use campus server or GPS verification."
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

async function getBrowserPosition() {
  return new Promise<GeolocationCoordinates>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => reject(new Error("Could not get your current location.")),
      {
        enableHighAccuracy: true,
        timeout: CURRENT_LOCATION_TIMEOUT_MS,
        maximumAge: 5000,
      }
    );
  });
}

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeEndpoint(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "/verify-attendance";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildCampusUrl(baseUrl: string, endpoint: string) {
  return `${trimTrailingSlash(baseUrl)}${normalizeEndpoint(endpoint)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
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

function normalizeBssid(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/-/g, ":");
}

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


