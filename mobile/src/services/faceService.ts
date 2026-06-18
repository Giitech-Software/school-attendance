// mobile/src/services/faceService.ts

/* =========================================================
   🔐 Production Rekognition Collection Integration
   Supports both staff and student face indexing/search 
   Uses Firebase Functions v2 (Secrets enabled)
========================================================= */

const PROJECT_ID = "astem-student-register"; // your Firebase project ID
const REGION = "us-central1"; // must match deployed functions region

// Default URLs for staff
const INDEX_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/indexStaffFace`;
const SEARCH_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchStaffFace`;
const DELETE_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/deleteStaffFace`;

// Student URLs (adjust if your functions are separate)
const INDEX_STUDENT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/indexStudentFace`;
const SEARCH_STUDENT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchStudentFace`;

async function readError(response: Response, fallback: string) {
  let details = "";
  try {
    const data = await response.json();
    if (data?.details) details = String(data.details);
    else if (data?.error) details = String(data.error);
    else details = JSON.stringify(data);
  } catch {
    details = await response.text();
  }
  const suffix = details ? `: ${details}` : "";
  return `${fallback} (${response.status})${suffix}`;
}

/* =========================================================
   1️⃣ Index Face (Registration)
   Supports staff and student
========================================================= */
export async function indexFace(
  subjectId: string,
  base64Image: string,
  subjectType: "staff" | "student" = "staff"
) {
  const url = subjectType === "staff" ? INDEX_STAFF_URL : INDEX_STUDENT_URL;
  const idField = subjectType === "staff" ? "staffId" : "studentId";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      [idField]: subjectId,
      base64Image,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Index failed"));
  }

  return await response.json(); // expected: { success: true, faceId }
}

/* =========================================================
   2️⃣ Search Face (Check-in)
   Supports staff and student
========================================================= */
export async function searchFace(
  base64Image: string,
  subjectType: "staff" | "student" = "staff"
) {
  const url = subjectType === "staff" ? SEARCH_STAFF_URL : SEARCH_STUDENT_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base64Image,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Search failed"));
  }

  const data = await response.json();
  const matchedSubjectId =
    data?.subjectId ??
    (subjectType === "staff" ? data?.staffId : data?.studentId);

  return {
    ...data,
    subjectId: matchedSubjectId,
  }; // expected: { matched: true/false, similarity, subjectId }
}

/* =========================================================
   3️⃣ Delete Face (Optional cleanup)
   Only for staff (can extend for student if needed)
========================================================= */
export async function deleteFace(faceId: string) {
  const response = await fetch(DELETE_STAFF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      faceId,
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Delete failed"));
  }

  return await response.json();
}
