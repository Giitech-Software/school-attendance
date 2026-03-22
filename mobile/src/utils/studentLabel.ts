// mobile/src/utils/studentLabel.ts

export function getStudentLabel(student: {
  name?: string;
  studentId?: string;
  rollNo?: string;
  id?: string;
}) {
  if (!student) return "";

  const name = student.name?.trim();
  const studentId = student.studentId?.trim();
  const rollNo = student.rollNo?.trim();

  // Preferred: Name + Student ID
  if (name && studentId) {
    return `${name} (${studentId})`;
  }

  // Fallbacks (strict order)
  if (name) return name;
  if (studentId) return studentId;
  if (rollNo) return `Roll: ${rollNo}`;

  return "Unknown Student";
}
