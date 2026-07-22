// mobile/src/services/types.ts

export type Student = {
  id: string;
  shortId?: string;

  name?: string;
  rollNo?: string;

  studentId?: string; // display ID
  classId?: string;

  isActive?: boolean;
  classDocId?: string;

  // ✅ biometric fields (SAFE)
  faceEnrolledAt?: string | null;
  faceEmbedding?: number[];
  fingerprintId?: string;

  createdAt?: any;
  updatedAt?: any;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type AttendanceRecord = {
  id?: string; // Firestore doc id

  studentId: string;
  classId?: string;
  classDocId?: string;

  date: string;               // YYYY-MM-DD
  type: "in" | "out";         // check-in or check-out

  checkInTime?: string;
  checkOutTime?: string | null;

  status?: "present" | "absent" | "late" | "excused";
  lateReason?: string | null;
  lateMinutes?: number | null;
  earlyCheckoutReason?: string | null;
  earlyCheckoutMinutes?: number | null;

  // ✅ FIXED + COMPLETE
  method?: "qr" | "fingerprint" | "face" | "manual";

  biometric?: boolean;

  location?: {
    verificationMethod?: "gps" | "campus_network" | "wifi_bssid" | "geofence_bypass";
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
    geofencingBypassed?: boolean;
    bypassReason?: string | null;
    bypassedBy?: string | null;
    bypassExpiresAt?: string | null;
    checkedAt: string;
  };

  createdAt?: {
    seconds: number;
    nanoseconds: number;
  } | string | number;
};

export type Term = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;

  isCurrent?: boolean;

  createdAt?: any;
  updatedAt?: any;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type AdminLog = {
  id: string;
  actorUid: string;
  actorName?: string | null;
  actorRole: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  description: string;
  metadata?: Record<string, any>;
  createdAt?: any;
};
export type AttendanceActor = "student" | "staff";

export interface Staff {
  id?: string;
  staffId?: string;     // human-readable ID
   userUid?: string; // 👈 new
  name: string;
  email: string;
  role?: string;        // teacher, admin, non-teaching, etc
  roleType?: string;
  fingerprintId?: string;
    faceImageUrl?: string;
    faceId?: string;   // ✅ ADD THIS
    faceEnrolled?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

