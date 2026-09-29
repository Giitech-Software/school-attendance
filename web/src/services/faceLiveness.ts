import { auth } from "../firebase";

const PROJECT_ID = "astem-student-register";
const REGION = "us-central1";
const endpoint = (name: string) => `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;

async function call(name: string, body: unknown) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in before starting face verification.");
  const response = await fetch(endpoint(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? `Face liveness request failed (${response.status}).`);
  return data;
}

export async function createFaceLivenessSession(): Promise<{ sessionId: string }> {
  return call("createFaceLivenessSession", {});
}

export async function getFaceLivenessCredentials(sessionId: string) {
  const data = await call("getFaceLivenessCredentials", { sessionId });
  return {
    ...data,
    expiration: data.expiration ? new Date(data.expiration) : undefined,
  };
}

export async function getFaceLivenessSessionResults(sessionId: string) {
  return call("getFaceLivenessSessionResults", { sessionId });
}
