// mobile/src/services/constants/roles.ts
export const USER_ROLES = [
  "super_admin",
  "parent",
  "teacher",
  "non_teaching_staff",
  "general_staff",
  "staff",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
