// types.ts
export type Student = {
  id: string;            // Firestore doc id
  shortId?: string;
  name?: string;
  studentId?: string;
  classId?: string;
  classDocId?: string;
  rollNo?: string;
  photoUrl?: string;
  faceEnrolledAt?: string | null;
  faceEmbedding?: number[];
  faceId?: string;
  biometricEnabled?: boolean;
  fingerprintId?: string; // opaque identifier, NOT raw biometric data
  isActive?: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | string | number;
  updatedAt?: { seconds: number; nanoseconds: number } | string | number;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type AttendanceRecord = {
  id?: string;           // Firestore doc id
  studentId?: string;
  staffId?: string;      // For staff attendance
  subjectType?: "student" | "staff";
  subjectId?: string;
  classId?: string;
  classDocId?: string;
  date: string;          // ISO date (YYYY-MM-DD) for aggregation
  type?: "in" | "out";
  checkInTime?: string;  // ISO datetime
  checkOutTime?: string | null; // ISO datetime
  status?: 'present' | 'absent' | 'late' | 'excused';
  lateReason?: string | null;
  lateMinutes?: number | null;
  earlyCheckoutReason?: string | null;
  earlyCheckoutMinutes?: number | null;
  method?: 'qr' | 'fingerprint' | 'face' | 'manual';
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
  createdAt?: { seconds: number; nanoseconds: number } | string | number;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type Term = {
  id?: string;
  name: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  isCurrent?: boolean;
  createdAt?: any;
  updatedAt?: any;
  tenantId?: string | null;
  tenantName?: string | null;
};

export type Week = {
  id?: string;
  termId: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  createdAt?: any;
  tenantId?: string | null;
  tenantName?: string | null;
};



