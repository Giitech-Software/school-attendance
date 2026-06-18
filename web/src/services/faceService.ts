const PROJECT_ID = "astem-student-register";
const REGION = "us-central1";

const INDEX_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/indexStaffFace`;
const SEARCH_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchStaffFace`;
const DELETE_STAFF_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/deleteStaffFace`;
const INDEX_STUDENT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/indexStudentFace`;
const SEARCH_STUDENT_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/searchStudentFace`;

export type FaceSubjectType = "staff" | "student";

type FaceIndexResult = {
  success?: boolean;
  faceId?: string;
  error?: string;
  similarity?: number;
};

type FaceSearchResult = {
  matched?: boolean;
  subjectId?: string;
  staffId?: string;
  studentId?: string;
  similarity?: number;
};

async function readError(response: Response, fallback: string) {
  let details = "";
  try {
    const data = await response.json();
    details = data?.details ?? data?.error ?? JSON.stringify(data);
  } catch {
    details = await response.text();
  }
  return details ? `${fallback} (${response.status}): ${details}` : `${fallback} (${response.status})`;
}

export async function indexFace(subjectId: string, base64Image: string, subjectType: FaceSubjectType): Promise<FaceIndexResult> {
  const url = subjectType === "staff" ? INDEX_STAFF_URL : INDEX_STUDENT_URL;
  const idField = subjectType === "staff" ? "staffId" : "studentId";

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [idField]: subjectId, base64Image }),
  });

  if (!response.ok) throw new Error(await readError(response, "Face registration failed"));
  return response.json();
}

export async function searchFace(base64Image: string, subjectType: FaceSubjectType): Promise<FaceSearchResult> {
  const url = subjectType === "staff" ? SEARCH_STAFF_URL : SEARCH_STUDENT_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image }),
  });

  if (!response.ok) throw new Error(await readError(response, "Face search failed"));
  const data = await response.json();
  return {
    ...data,
    subjectId: data?.subjectId ?? (subjectType === "staff" ? data?.staffId : data?.studentId),
  };
}

export async function deleteFace(faceId: string): Promise<{ success?: boolean }> {
  const response = await fetch(DELETE_STAFF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ faceId }),
  });

  if (!response.ok) throw new Error(await readError(response, "Face delete failed"));
  return response.json();
}
