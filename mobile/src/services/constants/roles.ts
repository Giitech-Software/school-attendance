// mobile/src/services/constants/roles.ts
export const USER_ROLES = [
  "parent",
  "teacher",
  "non_teaching_staff",
  "staff",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
