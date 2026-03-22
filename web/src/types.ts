// types.ts
export type Student = {
  id: string;            // Firestore doc id
  name: string;
  classId?: string;
  rollNo?: string;
  photoUrl?: string;
  fingerprintId?: string; // opaque identifier, NOT raw biometric data
  createdAt?: { seconds: number; nanoseconds: number } | string | number;
};

export type AttendanceRecord = {
  id?: string;           // Firestore doc id
  studentId: string;
  classId?: string;
  date: string;          // ISO date (YYYY-MM-DD) for aggregation
  checkInTime?: string;  // ISO datetime
  checkOutTime?: string; // ISO datetime
  status?: 'present' | 'absent' | 'late' | 'excused';
  method?: 'qr' | 'fingerprint' | 'manual';
  createdAt?: { seconds: number; nanoseconds: number } | string | number;
};

export type Term = {
  id?: string;
  name: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
};
