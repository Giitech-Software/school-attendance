import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getSchoolLocationReadiness,
  pairCampusServer,
  saveSchoolLocation,
  setEmergencyGeofenceBypass,
  type CampusServerSettings,
  type InstitutionWifiNetwork,
  type PresenceVerificationMode,
} from "../services/locationGuard";
import { getCurrentTerm } from "../services/terms";
import useCurrentUser from "../hooks/useCurrentUser";
import { allowsStudentAndParentFeatures } from "../services/tenantScope";

type BypassDuration = "day" | "week" | "month" | "term" | "year";

const bypassDurationOptions: {
  value: BypassDuration;
  label: string;
  description: string;
}[] = [
  { value: "day", label: "Day", description: "Until 11:59 PM today" },
  { value: "week", label: "Week", description: "7 calendar days" },
  { value: "month", label: "Month", description: "1 calendar month" },
  { value: "term", label: "Term", description: "Until current term ends" },
  { value: "year", label: "Year", description: "1 calendar year" },
];

async function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    });
  });
}

const verificationModes: { value: PresenceVerificationMode; label: string; helper: string }[] = [
  { value: "campus_network_or_gps", label: "Campus network + GPS", helper: "Fast local server check first, GPS fallback if needed." },
  { value: "campus_network_or_wifi_bssid_or_gps", label: "Campus + WiFi + GPS", helper: "Tries local server, trusted WiFi BSSID, then GPS." },
  { value: "campus_network", label: "Campus network only", helper: "Requires the institution server for every check-in." },
  { value: "wifi_bssid_or_gps", label: "WiFi BSSID + GPS", helper: "Uses trusted institution WiFi first, then GPS." },
  { value: "wifi_bssid", label: "WiFi BSSID only", helper: "Mobile-only unless browser support is added." },
  { value: "gps", label: "GPS geofence only", helper: "Uses browser or device location against the saved radius." },
  { value: "disabled", label: "Disabled / emergency", helper: "Allows controlled bypass with audit records." },
];

export default function AdminSetupSchoolLocation() {
  const { userDoc } = useCurrentUser();
  const allowsSchoolFeatures = allowsStudentAndParentFeatures(userDoc);
  const locationLabel = allowsSchoolFeatures ? "School" : "Workplace";
  const locationLabelLower = locationLabel.toLowerCase();
  const bypassFallbackReason = `${locationLabel} verification temporarily unavailable`;
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("150");
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [presenceMode, setPresenceMode] = useState<PresenceVerificationMode>("gps");
  const [campusServer, setCampusServer] = useState<CampusServerSettings | null>(null);
  const [campusBaseUrl, setCampusBaseUrl] = useState("");
  const [campusTokenEndpoint, setCampusTokenEndpoint] = useState("/verify-attendance");
  const [campusPairEndpoint, setCampusPairEndpoint] = useState("/pair");
  const [campusInstitutionId, setCampusInstitutionId] = useState("");
  const [campusServerName, setCampusServerName] = useState("");
  const [campusSetupCode, setCampusSetupCode] = useState("");
  const [wifiBssidList, setWifiBssidList] = useState("");
  const [disabledUntil, setDisabledUntil] = useState<string | null>(null);
  const [bypassReason, setBypassReason] = useState(bypassFallbackReason);
  const [bypassDuration, setBypassDuration] = useState<BypassDuration>("day");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const readiness = await getSchoolLocationReadiness();
        if (!active) return;
        setLatitude(readiness.latitude?.toString() ?? "");
        setLongitude(readiness.longitude?.toString() ?? "");
        setRadius(readiness.radiusMeters?.toString() ?? "150");
        setGeofencingEnabled(readiness.geofencingEnabled);
        setPresenceMode(readiness.presenceVerificationMode);
        setCampusServer(readiness.campusServer);
        setCampusBaseUrl(readiness.campusServer?.baseUrl ?? "");
        setCampusTokenEndpoint(readiness.campusServer?.tokenEndpoint ?? "/verify-attendance");
        setCampusPairEndpoint(readiness.campusServer?.pairEndpoint ?? "/pair");
        setCampusInstitutionId(readiness.campusServer?.institutionId ?? "");
        setCampusServerName(readiness.campusServer?.serverName ?? "");
        setWifiBssidList(formatWifiNetworks(readiness.institutionWifiNetworks));
        setDisabledUntil(readiness.disabledUntil ?? null);
        setBypassReason(readiness.disabledReason ?? bypassFallbackReason);
      } catch (err) {
        console.error("load location readiness", err);
        if (active) setError(`Unable to load ${locationLabelLower} verification settings.`);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [bypassFallbackReason, locationLabelLower]);

  function buildWifiNetworks(): InstitutionWifiNetwork[] {
    return parseWifiNetworkList(wifiBssidList);
  }

  function buildCampusSettings(): CampusServerSettings | null {
    const baseUrl = campusBaseUrl.trim();
    if (!baseUrl) return null;

    return {
      enabled: presenceMode === "campus_network" || presenceMode === "campus_network_or_gps" || presenceMode === "campus_network_or_wifi_bssid_or_gps",
      baseUrl,
      tokenEndpoint: campusTokenEndpoint.trim() || "/verify-attendance",
      pairEndpoint: campusPairEndpoint.trim() || "/pair",
      institutionId: campusInstitutionId.trim() || null,
      serverName: campusServerName.trim() || "Campus attendance server",
      publicKey: campusServer?.publicKey ?? null,
      pairedAt: campusServer?.pairedAt ?? null,
      pairedBy: campusServer?.pairedBy ?? null,
    };
  }

  async function saveSettings(nextStatus: string) {
    setError(null);
    setStatus(null);
    const lat = Number(latitude);
    const lng = Number(longitude);
    const rad = Number(radius);
    const campus = buildCampusSettings();
    const wifiNetworks = buildWifiNetworks();

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(rad) || rad <= 0) {
      setError("Enter valid numbers for latitude, longitude, and radius.");
      return;
    }

    if ((presenceMode === "campus_network" || presenceMode === "campus_network_or_gps" || presenceMode === "campus_network_or_wifi_bssid_or_gps") && !campus) {
      setError("Enter the campus server URL before enabling campus network verification.");
      return;
    }

    try {
      setSaving(true);
      await saveSchoolLocation({
        latitude: lat,
        longitude: lng,
        radiusMeters: rad,
        geofencingEnabled: presenceMode !== "disabled",
        presenceVerificationMode: presenceMode,
        campusServer: campus,
        institutionWifiNetworks: wifiNetworks,
      });
      setCampusServer(campus);
      setGeofencingEnabled(presenceMode !== "disabled");
      setDisabledUntil(null);
      setStatus(nextStatus);
    } catch (err) {
      console.error("save school location", err);
      setError(`Failed to save ${locationLabelLower} verification settings.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveSettings(`${locationLabel} verification settings saved.`);
  }

  async function handleRefreshLocation() {
    setError(null);
    setStatus(null);
    try {
      setSaving(true);
      const pos = await getBrowserPosition();
      setLatitude(pos.coords.latitude.toString());
      setLongitude(pos.coords.longitude.toString());
      setStatus("Loaded browser location. Review and save it.");
    } catch (err: any) {
      console.error("browser position", err);
      setError(err?.message ?? "Unable to read browser location.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePairCampusServer() {
    setError(null);
    setStatus(null);
    if (!campusBaseUrl.trim() || !campusSetupCode.trim()) {
      setError("Enter the verification server URL and setup code.");
      return;
    }

    try {
      setSaving(true);
      const paired = await pairCampusServer({
        baseUrl: campusBaseUrl.trim(),
        pairEndpoint: campusPairEndpoint.trim() || "/pair",
        setupCode: campusSetupCode.trim(),
        institutionId: campusInstitutionId.trim() || null,
      });
      setCampusServer(paired);
      setCampusBaseUrl(paired.baseUrl);
      setCampusTokenEndpoint(paired.tokenEndpoint);
      setCampusPairEndpoint(paired.pairEndpoint ?? "/pair");
      setCampusInstitutionId(paired.institutionId ?? "");
      setCampusServerName(paired.serverName ?? "");
      setPresenceMode("campus_network_or_gps");
      setCampusSetupCode("");
      setStatus("Verification server paired. Save settings to activate it.");
    } catch (err: any) {
      console.error("pair campus server", err);
      setError(err?.message ?? "Verification server pairing failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableEmergencyMode() {
    setError(null);
    setStatus(null);

    const selectedDuration = bypassDurationOptions.find((option) => option.value === bypassDuration);
    const confirmed = window.confirm(
      `Disable geofencing for the selected ${selectedDuration?.label.toLowerCase() ?? "period"}? Attendance will continue without GPS checks and records will be audited.`
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      const expiresAt = await getBypassExpiry(bypassDuration);
      await setEmergencyGeofenceBypass({
        enabled: true,
        reason: `${bypassReason.trim() || "Geofencing disabled by admin"} (${selectedDuration?.label ?? bypassDuration})`,
        expiresAt: expiresAt.toISOString(),
      });
      setGeofencingEnabled(false);
      setPresenceMode("disabled");
      setDisabledUntil(expiresAt.toISOString());
      setStatus(`Geofencing disabled until ${expiresAt.toLocaleString()}.`);
    } catch (err: any) {
      console.error("enable geofence bypass", err);
      setError(err?.message ?? "Unable to disable geofencing.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableEmergencyMode() {
    setError(null);
    setStatus(null);
    try {
      setSaving(true);
      await setEmergencyGeofenceBypass({ enabled: false });
      setGeofencingEnabled(true);
      setPresenceMode("gps");
      setDisabledUntil(null);
      setStatus("Geofencing has been re-enabled. GPS checks are active again.");
    } catch (err) {
      console.error("disable geofence bypass", err);
      setError("Unable to re-enable geofencing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/admin" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to admin">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">{locationLabel} Verification Setup</h1>
            <p className="mt-1 text-xs text-white/70">Configure GPS, WiFi, and network verification for attendance.</p>
          </div>
        </div>
      </section>

      <section className="enterprise-panel p-4">
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-extrabold text-slate-950">Current status</p>
              <p className="mt-1 text-sm text-slate-600">{geofencingEnabled ? `Verification mode: ${presenceMode.replace(/_/g, " ")}` : "Geofencing is currently disabled."}</p>
              {campusServer?.enabled ? <p className="mt-1 text-xs text-slate-500">Campus server: {campusServer.serverName ?? campusServer.baseUrl}</p> : null}
              {disabledUntil ? <p className="mt-1 text-xs text-slate-500">Disabled until: {new Date(disabledUntil).toLocaleString()}</p> : null}
              {!geofencingEnabled ? (
                <button type="button" onClick={handleDisableEmergencyMode} disabled={saving} className="mt-3 inline-flex items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60">
                  Re-enable geofencing
                </button>
              ) : null}
            </div>
            <span className={`w-fit rounded px-3 py-1 text-xs font-bold uppercase tracking-wide ${geofencingEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
              {geofencingEnabled ? "Enabled" : "Bypass on"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="text-slate-500">Loading verification settings...</div>
        ) : (
          <div className="space-y-4">
            {error ? <div className="status-error">{error}</div> : null}
            {status ? <div className="status-success">{status}</div> : null}

            <div>
              <p className="mb-2 text-sm font-extrabold text-slate-950">Attendance verification</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {verificationModes.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPresenceMode(option.value)}
                    className={`rounded-lg border p-3 text-left transition ${presenceMode === option.value ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
                  >
                    <span className="block text-sm font-extrabold">{option.label}</span>
                    <span className={`mt-1 block text-xs ${presenceMode === option.value ? "text-white/80" : "text-slate-500"}`}>{option.helper}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <label className="admin-field-card block">
                <span className="auth-label">Latitude</span>
                <input value={latitude} onChange={(event) => setLatitude(event.target.value)} className="enterprise-input mt-2" placeholder="Latitude" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Longitude</span>
                <input value={longitude} onChange={(event) => setLongitude(event.target.value)} className="enterprise-input mt-2" placeholder="Longitude" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Radius (meters)</span>
                <input value={radius} onChange={(event) => setRadius(event.target.value)} className="enterprise-input mt-2" placeholder="150" />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="admin-field-card block">
                <span className="auth-label">Campus server URL</span>
                <input value={campusBaseUrl} onChange={(event) => setCampusBaseUrl(event.target.value)} className="enterprise-input mt-2" placeholder="http://attendance.local" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Verification endpoint</span>
                <input value={campusTokenEndpoint} onChange={(event) => setCampusTokenEndpoint(event.target.value)} className="enterprise-input mt-2" placeholder="/verify-attendance" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Pairing endpoint</span>
                <input value={campusPairEndpoint} onChange={(event) => setCampusPairEndpoint(event.target.value)} className="enterprise-input mt-2" placeholder="/pair" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Institution ID</span>
                <input value={campusInstitutionId} onChange={(event) => setCampusInstitutionId(event.target.value)} className="enterprise-input mt-2" placeholder="institution_001" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Server name</span>
                <input value={campusServerName} onChange={(event) => setCampusServerName(event.target.value)} className="enterprise-input mt-2" placeholder="Campus attendance server" />
              </label>
              <label className="admin-field-card block">
                <span className="auth-label">Setup code</span>
                <input value={campusSetupCode} onChange={(event) => setCampusSetupCode(event.target.value)} className="enterprise-input mt-2" placeholder="One-time code" />
              </label>
              <label className="admin-field-card block md:col-span-2">
                <span className="auth-label">Institution WiFi BSSID</span>
                <textarea value={wifiBssidList} onChange={(event) => setWifiBssidList(event.target.value)} className="enterprise-input mt-2 min-h-24" placeholder={"BSSID, SSID, Label\naa:bb:cc:dd:ee:ff, Workplace WiFi, Main Office"} />
                <span className="mt-1 block text-xs text-slate-500">Add one WiFi access point per line. BSSID is required; SSID and label are optional.</span>
              </label>
            </div>

            <div className="admin-field-card">
              <label className="block">
                <span className="auth-label">Emergency bypass reason</span>
                <input value={bypassReason} onChange={(event) => setBypassReason(event.target.value)} className="enterprise-input mt-2" placeholder="Reason for disabling geofencing" />
              </label>
              <div className="mt-3">
                <p className="auth-label mb-2">Bypass duration</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {bypassDurationOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setBypassDuration(option.value)}
                      className={`rounded-lg border p-3 text-left transition ${bypassDuration === option.value ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"}`}
                    >
                      <span className="block text-sm font-extrabold">{option.label}</span>
                      <span className={`mt-1 block text-xs ${bypassDuration === option.value ? "text-red-50" : "text-slate-500"}`}>{option.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <button type="button" onClick={handleSave} disabled={saving} className="enterprise-button-primary">
                {saving ? "Saving..." : "Save settings"}
              </button>
              <button type="button" onClick={handlePairCampusServer} disabled={saving} className="enterprise-button-secondary">
                Pair verification server
              </button>
              <button type="button" onClick={handleRefreshLocation} disabled={saving} className="enterprise-button-secondary">
                Use current browser location
              </button>
              {geofencingEnabled ? (
                <button type="button" onClick={handleEnableEmergencyMode} disabled={saving} className="enterprise-button-danger">
                  Disable geofencing
                </button>
              ) : (
                <button type="button" onClick={handleDisableEmergencyMode} disabled={saving} className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60">
                  Re-enable geofencing
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
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

