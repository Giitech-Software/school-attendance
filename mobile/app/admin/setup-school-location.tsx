// mobile/app/admin/setup-school-location.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useRequireAdmin } from "../../src/hooks/useRouteAuthorization";
import {
  CampusServerSettings,
  getSchoolLocationReadiness,
  InstitutionWifiNetwork,
  pairCampusServer,
  PresenceVerificationMode,
  savePresenceVerificationSettings,
  setEmergencyGeofenceBypass,
} from "../../src/services/locationGuard";
import { getCurrentTerm } from "../../src/services/terms";
import { logAdminAction } from "../../src/services/adminLogs";

type LocationCoords = Location.LocationObjectCoords;
type BypassDuration = "day" | "week" | "month" | "term" | "year";

const SETUP_SAMPLE_COUNT = 5;
const SETUP_LOCATION_TIMEOUT_MS = 12_000;
const MAX_SETUP_ACCURACY_METERS = 80;
const BYPASS_DURATION_OPTIONS: {
  value: BypassDuration;
  label: string;
  description: string;
}[] = [
  {
    value: "day",
    label: "Day",
    description: "Until 11:59 PM today",
  },
  {
    value: "week",
    label: "Week",
    description: "7 calendar days",
  },
  {
    value: "month",
    label: "Month",
    description: "1 calendar month",
  },
  {
    value: "term",
    label: "Term",
    description: "Until current term ends",
  },
  {
    value: "year",
    label: "Year",
    description: "1 calendar year",
  },
];

export default function SetupSchoolLocation() {
  const router = useRouter();
  const {
    userDoc,
    loading: adminLoading,
    ready: adminReady,
  } = useRequireAdmin();

  const [latitude, setLatitude] = useState<string>("");
  const [longitude, setLongitude] = useState<string>("");
  const [radius, setRadius] = useState<string>("150");
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [presenceMode, setPresenceMode] =
    useState<PresenceVerificationMode>("gps");
  const [campusBaseUrl, setCampusBaseUrl] = useState("");
  const [campusTokenEndpoint, setCampusTokenEndpoint] =
    useState("/verify-attendance");
  const [campusPairEndpoint, setCampusPairEndpoint] = useState("/pair");
  const [campusInstitutionId, setCampusInstitutionId] = useState("");
  const [campusServerName, setCampusServerName] = useState("");
  const [campusSetupCode, setCampusSetupCode] = useState("");
  const [campusServer, setCampusServer] =
    useState<CampusServerSettings | null>(null);
  const [wifiBssidList, setWifiBssidList] = useState("");
  const [bypassReason, setBypassReason] = useState(
    "School location temporarily unavailable"
  );
  const [bypassDuration, setBypassDuration] =
    useState<BypassDuration>("day");
  const [disabledUntil, setDisabledUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchingLocation, setFetchingLocation] = useState<boolean>(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission denied",
          "Location permission is required to set school location."
        );
        return null;
      }

      const samples: LocationCoords[] = [];

      const currentSamples = await Promise.all(
        Array.from({ length: SETUP_SAMPLE_COUNT }, () =>
          withTimeout(
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.High,
              mayShowUserSettingsDialog: true,
            }),
            SETUP_LOCATION_TIMEOUT_MS
          ).catch(() => null)
        )
      );

      currentSamples.forEach((loc) => {
        if (loc?.coords) {
          samples.push(loc.coords);
        }
      });

      if (samples.length === 0) return null;

      return chooseBestSetupCoords(samples);
    } catch (err) {
      console.error("getCurrentLocation error:", err);
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const readiness = await getSchoolLocationReadiness().catch(() => null);

      if (readiness) {
        setGeofencingEnabled(readiness.geofencingEnabled);
        setPresenceMode(readiness.presenceVerificationMode);
        setCampusServer(readiness.campusServer);
        setCampusBaseUrl(readiness.campusServer?.baseUrl ?? "");
        setCampusTokenEndpoint(
          readiness.campusServer?.tokenEndpoint ?? "/verify-attendance"
        );
        setCampusPairEndpoint(readiness.campusServer?.pairEndpoint ?? "/pair");
        setCampusInstitutionId(readiness.campusServer?.institutionId ?? "");
        setCampusServerName(readiness.campusServer?.serverName ?? "");
        setWifiBssidList(formatWifiNetworks(readiness.institutionWifiNetworks));
        setBypassReason(
          readiness.disabledReason ?? "School location temporarily unavailable"
        );
        setDisabledUntil(readiness.disabledUntil ?? null);

        if (readiness.configured) {
          setLatitude(String(readiness.latitude));
          setLongitude(String(readiness.longitude));
          setRadius(String(readiness.radiusMeters ?? 150));
          setAccuracy(readiness.setupAccuracyMeters ?? null);
          setFetchingLocation(false);
          return;
        }
      }

      const coords = await getCurrentLocation();

      if (!coords) {
        Alert.alert(
          "Location unavailable",
          "Failed to fetch current location. Make sure GPS/location services are enabled."
        );
      } else {
        setLatitude(coords.latitude.toString());
        setLongitude(coords.longitude.toString());
        setAccuracy(coords.accuracy ?? null);
      }

      setFetchingLocation(false);
    })();
  }, []);

  const handleSave = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const rad = parseInt(radius, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(rad) || rad <= 0) {
      return Alert.alert(
        "Invalid input",
        "Please enter valid numbers for latitude, longitude, and radius."
      );
    }

    if (typeof accuracy === "number" && accuracy > MAX_SETUP_ACCURACY_METERS) {
      return Alert.alert(
        "GPS accuracy too low",
        `Current accuracy is +/-${Math.round(
          accuracy
        )}m. Move to an open area and refresh before saving the school location.`
      );
    }

    try {
      setLoading(true);
      await setDoc(
        doc(db, "settings", "location"),
        {
          latitude: lat,
          longitude: lng,
          radiusMeters: rad,
          setupAccuracyMeters: accuracy,
          geofencingEnabled: presenceMode !== "disabled",
          presenceVerificationMode: presenceMode,
          campusServer: buildCampusSettings(),
          institutionWifiNetworks: buildWifiNetworks(),
          geofencingDisabledReason: null,
          geofencingDisabledBy: null,
          geofencingDisabledUntil: null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await logAdminAction({
        action: "UPDATE_SCHOOL_LOCATION",
        targetType: "settings",
        targetId: "location",
        description: "Updated school geofence location",
        metadata: {
          latitude: lat,
          longitude: lng,
          radiusMeters: rad,
          setupAccuracyMeters: accuracy,
        },
      });

      Alert.alert("Success", "School location has been saved!");
      setGeofencingEnabled(presenceMode !== "disabled");
      setDisabledUntil(presenceMode === "disabled" ? disabledUntil : null);
      router.back();
    } catch (err) {
      console.error("Firestore save error:", err);
      Alert.alert(
        "Error",
        "Failed to save school location. Check your internet connection."
      );
    } finally {
      setLoading(false);
    }
  };

  const buildCampusSettings = (): CampusServerSettings | null => {
    const baseUrl = campusBaseUrl.trim();
    if (!baseUrl) return null;

    return {
      enabled:
        presenceMode === "campus_network" ||
        presenceMode === "campus_network_or_gps" ||
        presenceMode === "campus_network_or_wifi_bssid_or_gps",
      baseUrl,
      tokenEndpoint: campusTokenEndpoint.trim() || "/verify-attendance",
      pairEndpoint: campusPairEndpoint.trim() || "/pair",
      institutionId: campusInstitutionId.trim() || null,
      serverName: campusServerName.trim() || "Campus attendance server",
      publicKey: campusServer?.publicKey ?? null,
      pairedAt: campusServer?.pairedAt ?? null,
      pairedBy: campusServer?.pairedBy ?? null,
    };
  };

  const buildWifiNetworks = (): InstitutionWifiNetwork[] =>
    parseWifiNetworkList(wifiBssidList);

  const handlePairCampusServer = async () => {
    if (!campusBaseUrl.trim() || !campusSetupCode.trim()) {
      return Alert.alert(
        "Missing setup",
        "Enter the campus server URL and setup code."
      );
    }

    try {
      setLoading(true);
      const paired = await pairCampusServer({
        baseUrl: campusBaseUrl.trim(),
        pairEndpoint: campusPairEndpoint.trim() || "/pair",
        setupCode: campusSetupCode.trim(),
        institutionId: campusInstitutionId.trim() || null,
        adminUid: userDoc?.uid ?? userDoc?.id,
      });
      setCampusServer(paired);
      setCampusBaseUrl(paired.baseUrl);
      setCampusTokenEndpoint(paired.tokenEndpoint);
      setCampusPairEndpoint(paired.pairEndpoint ?? "/pair");
      setCampusInstitutionId(paired.institutionId ?? "");
      setCampusServerName(paired.serverName ?? "");
      setPresenceMode("campus_network_or_gps");
      setCampusSetupCode("");
      Alert.alert("Paired", "Campus server verification is ready.");
    } catch (err) {
      Alert.alert(
        "Pairing failed",
        err instanceof Error ? err.message : "Could not pair campus server."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVerificationSettings = async () => {
    const campus = buildCampusSettings();
    if (
      (presenceMode === "campus_network" ||
        presenceMode === "campus_network_or_gps" ||
        presenceMode === "campus_network_or_wifi_bssid_or_gps") &&
      !campus
    ) {
      return Alert.alert(
        "Campus server required",
        "Enter and pair or save a campus server before using network verification."
      );
    }

    try {
      setLoading(true);
      await savePresenceVerificationSettings({
        mode: presenceMode,
        campusServer: campus,
        institutionWifiNetworks: buildWifiNetworks(),
        adminUid: userDoc?.uid ?? userDoc?.id,
      });
      setGeofencingEnabled(presenceMode !== "disabled");
      setCampusServer(campus);
      Alert.alert("Saved", "Attendance verification settings updated.");
    } catch (err) {
      Alert.alert(
        "Failed",
        err instanceof Error
          ? err.message
          : "Could not save verification settings."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLocation = async () => {
    setFetchingLocation(true);
    const coords = await getCurrentLocation();
    if (!coords) {
      Alert.alert(
        "Location unavailable",
        "Still could not get current location. Make sure GPS/location services are on."
      );
    } else {
      setLatitude(coords.latitude.toString());
      setLongitude(coords.longitude.toString());
      setAccuracy(coords.accuracy ?? null);
    }
    setFetchingLocation(false);
  };

  const handleEnableEmergencyMode = () => {
    const selectedDuration = BYPASS_DURATION_OPTIONS.find(
      (option) => option.value === bypassDuration
    );

    Alert.alert(
      "Disable geofencing?",
      `Attendance will continue without GPS checks for the selected ${selectedDuration?.label.toLowerCase() ?? "period"}. Every affected attendance record will be audited.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Enable",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              const end = await getBypassExpiry(bypassDuration);
              await setEmergencyGeofenceBypass({
                enabled: true,
                reason: `${bypassReason.trim() || "Geofencing disabled by admin"} (${selectedDuration?.label ?? bypassDuration})`,
                adminUid: userDoc?.uid ?? userDoc?.id,
                expiresAt: end.toISOString(),
              });
              setGeofencingEnabled(false);
              setDisabledUntil(end.toISOString());
              Alert.alert(
                "Geofencing disabled",
                `GPS checks are disabled until ${end.toLocaleString()}.`
              );
            } catch (err) {
              console.error("enable geofence bypass", err);
              Alert.alert(
                "Failed",
                err instanceof Error
                  ? err.message
                  : "Could not disable geofencing."
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDisableEmergencyMode = async () => {
    try {
      setLoading(true);
      await setEmergencyGeofenceBypass({ enabled: false });
      setGeofencingEnabled(true);
      setDisabledUntil(null);
      Alert.alert("Geofencing enabled", "GPS checks are active again.");
    } catch (err) {
      console.error("disable geofence bypass", err);
      Alert.alert("Failed", "Could not re-enable geofencing.");
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading || !adminReady || fetchingLocation) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#0A4FB3" />
        <Text className="mt-4">Fetching current location...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      <View className="flex-row items-center mb-4">
        <Pressable
          onPress={() => router.back()}
          className="p-1 mr-2"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={26} color="#0f172a" />
        </Pressable>

        <Text className="text-2xl font-bold flex-1">
          Set School/Work Location
        </Text>
      </View>

      <View
        className={`rounded-xl p-4 mb-4 ${
          geofencingEnabled ? "bg-emerald-50" : "bg-red-50"
        }`}
      >
        <Text
          className={`font-bold ${
            geofencingEnabled ? "text-emerald-800" : "text-red-800"
          }`}
        >
          Geofencing {geofencingEnabled ? "enabled" : "disabled"}
        </Text>
        <Text className="text-slate-700 mt-1">
          {geofencingEnabled
            ? "Attendance requires staff to be inside the configured school radius."
            : `Emergency mode is active${disabledUntil ? ` until ${new Date(disabledUntil).toLocaleString()}` : ""}.`}
        </Text>

        {!geofencingEnabled ? (
          <Pressable
            onPress={handleDisableEmergencyMode}
            disabled={loading}
            className="bg-emerald-700 p-3 rounded-lg mt-3 items-center"
          >
            <Text className="text-white font-semibold">Re-enable Geofencing</Text>
          </Pressable>
        ) : null}
      </View>

      <View className="rounded-xl border border-slate-200 p-4 mb-4">
        <Text className="font-bold text-slate-900">
          Attendance Verification
        </Text>
        <Text className="text-slate-600 mt-1">
          Campus network + GPS is recommended for fast check-ins.
        </Text>

        {[
          ["campus_network_or_gps", "Campus network + GPS"],
          ["campus_network_or_wifi_bssid_or_gps", "Campus + WiFi + GPS"],
          ["campus_network", "Campus network only"],
          ["wifi_bssid_or_gps", "WiFi BSSID + GPS"],
          ["wifi_bssid", "WiFi BSSID only"],
          ["gps", "GPS geofence only"],
          ["disabled", "Disabled / emergency"],
        ].map(([value, label]) => {
          const selected = presenceMode === value;
          return (
            <Pressable
              key={value}
              onPress={() => setPresenceMode(value as PresenceVerificationMode)}
              className={`rounded-lg border p-3 mt-3 ${
                selected
                  ? "bg-blue-600 border-blue-600"
                  : "bg-white border-slate-300"
              }`}
            >
              <Text
                className={`font-semibold ${
                  selected ? "text-white" : "text-slate-900"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}

        <Text className="mt-4 font-medium">Campus server URL</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusBaseUrl}
          onChangeText={setCampusBaseUrl}
          autoCapitalize="none"
          placeholder="http://attendance.local"
        />

        <Text className="mt-2 font-medium">Verification endpoint</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusTokenEndpoint}
          onChangeText={setCampusTokenEndpoint}
          autoCapitalize="none"
          placeholder="/verify-attendance"
        />

        <Text className="mt-2 font-medium">Pairing endpoint</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusPairEndpoint}
          onChangeText={setCampusPairEndpoint}
          autoCapitalize="none"
          placeholder="/pair"
        />

        <Text className="mt-2 font-medium">Institution ID</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusInstitutionId}
          onChangeText={setCampusInstitutionId}
          autoCapitalize="none"
          placeholder="school_001"
        />

        <Text className="mt-2 font-medium">Server name</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusServerName}
          onChangeText={setCampusServerName}
          placeholder="Campus attendance server"
        />

        <Text className="mt-2 font-medium">Setup code</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={campusSetupCode}
          onChangeText={setCampusSetupCode}
          autoCapitalize="none"
          placeholder="One-time code from server"
        />

        <Text className="mt-4 font-medium">Institution WiFi BSSID</Text>
        <TextInput
          className="border p-2 rounded-lg mt-1"
          value={wifiBssidList}
          onChangeText={setWifiBssidList}
          autoCapitalize="none"
          multiline
          numberOfLines={4}
          placeholder="BSSID, SSID, Label&#10;aa:bb:cc:dd:ee:ff, School WiFi, Admin Block"
        />
        <Text className="text-slate-500 mt-1 text-xs">
          Add one WiFi access point per line. BSSID is required; SSID and label
          are optional.
        </Text>

        <View className="flex-row mt-3">
          <Pressable
            onPress={handlePairCampusServer}
            disabled={loading}
            className="bg-slate-800 p-3 rounded-lg mr-2 flex-1 items-center"
          >
            <Text className="text-white font-semibold">Pair Server</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveVerificationSettings}
            disabled={loading}
            className="bg-blue-600 p-3 rounded-lg flex-1 items-center"
          >
            <Text className="text-white font-semibold">Save Verification</Text>
          </Pressable>
        </View>
      </View>

      <Text className="mt-2 font-medium">Latitude</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={latitude}
        onChangeText={setLatitude}
        keyboardType="decimal-pad"
      />

      <Text className="mt-2 font-medium">Longitude</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={longitude}
        onChangeText={setLongitude}
        keyboardType="decimal-pad"
      />

      <Text className="mt-2 font-medium">Radius (meters)</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={radius}
        onChangeText={setRadius}
        keyboardType="numeric"
      />

      {accuracy !== null ? (
        <Text className="text-slate-600 mt-2">
          GPS accuracy: +/-{Math.round(accuracy)}m
        </Text>
      ) : null}

      <Text className="mt-4 font-medium">Emergency bypass reason</Text>
      <TextInput
        className="border p-2 rounded-lg mt-1"
        value={bypassReason}
        onChangeText={setBypassReason}
        placeholder="Reason for disabling geofencing"
      />

      <Text className="mt-4 font-medium">Bypass duration</Text>
      <View className="flex-row flex-wrap mt-2">
        {BYPASS_DURATION_OPTIONS.map((option) => {
          const selected = bypassDuration === option.value;

          return (
            <Pressable
              key={option.value}
              onPress={() => setBypassDuration(option.value)}
              className={`rounded-xl border p-3 mr-2 mb-2 ${
                selected
                  ? "bg-red-600 border-red-600"
                  : "bg-white border-slate-300"
              }`}
            >
              <Text
                className={`font-semibold ${
                  selected ? "text-white" : "text-slate-900"
                }`}
              >
                {option.label}
              </Text>
              <Text
                className={`text-xs mt-1 ${
                  selected ? "text-red-50" : "text-slate-500"
                }`}
              >
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleSave}
        className={`bg-blue-600 p-4 rounded-lg mt-6 ${loading ? "opacity-50" : ""}`}
        disabled={loading}
      >
        <Text className="text-white font-bold text-center">
          {loading ? "Saving..." : "Set School/Work Location"}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleRefreshLocation}
        className="bg-gray-300 p-3 rounded-lg mt-4 items-center"
      >
        <Text className="text-black font-semibold">Refresh GPS Location</Text>
      </Pressable>

      {geofencingEnabled ? (
        <Pressable
          onPress={handleEnableEmergencyMode}
          className="bg-red-600 p-3 rounded-lg mt-4 items-center"
          disabled={loading}
        >
          <Text className="text-white font-semibold">
            Disable Geofencing
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

async function getBypassExpiry(duration: BypassDuration) {
  const end = new Date();

  if (duration === "day") {
    end.setHours(23, 59, 59, 999);
    return end;
  }

  if (duration === "week") {
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  if (duration === "month") {
    end.setMonth(end.getMonth() + 1);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  if (duration === "year") {
    end.setFullYear(end.getFullYear() + 1);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  const currentTerm = await getCurrentTerm();
  if (!currentTerm?.endDate) {
    throw new Error("No current term is set. Choose another duration or set the current term first.");
  }

  const termEnd = parseDateOnly(currentTerm.endDate);
  if (!termEnd || termEnd.getTime() <= Date.now()) {
    throw new Error("The current term end date is missing or already past.");
  }

  termEnd.setHours(23, 59, 59, 999);
  return termEnd;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
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

function chooseBestSetupCoords(samples: LocationCoords[]): LocationCoords {
  const accurateSamples = samples.filter(
    (sample) =>
      typeof sample.accuracy === "number" &&
      sample.accuracy <= MAX_SETUP_ACCURACY_METERS
  );
  const usableSamples = accurateSamples.length > 0 ? accurateSamples : samples;
  const latitudes = usableSamples.map((sample) => sample.latitude).sort((a, b) => a - b);
  const longitudes = usableSamples.map((sample) => sample.longitude).sort((a, b) => a - b);
  const bestAccuracy = Math.min(
    ...usableSamples.map((sample) => sample.accuracy ?? Number.MAX_SAFE_INTEGER)
  );

  return {
    ...usableSamples[0],
    latitude: median(latitudes),
    longitude: median(longitudes),
    accuracy: Number.isFinite(bestAccuracy) ? bestAccuracy : null,
  };
}

function median(values: number[]) {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function parseWifiNetworkList(value: string): InstitutionWifiNetwork[] {
  return value
    .split(/\r?\n/)
    .flatMap((line): InstitutionWifiNetwork[] => {
      const [bssidRaw, ssidRaw, labelRaw] = line.split(",");
      const bssid = normalizeBssid(bssidRaw);
      if (!bssid) return [];

      return [{
        enabled: true,
        bssid,
        ssid: ssidRaw?.trim() || null,
        label: labelRaw?.trim() || null,
      }];
    });
}

function formatWifiNetworks(networks: InstitutionWifiNetwork[] = []) {
  return networks
    .map((network) =>
      [network.bssid, network.ssid ?? "", network.label ?? ""]
        .join(", ")
        .replace(/,\s*$/, "")
    )
    .join("\n");
}

function normalizeBssid(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/-/g, ":");
}
