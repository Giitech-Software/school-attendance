import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../../app/firebase";

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

export async function uploadProfilePhoto(uri: string, storagePath: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Could not read the selected photo (HTTP ${response.status}).`);
  const blob = await response.blob();
  if (!blob.size || blob.size >= MAX_PROFILE_PHOTO_BYTES) {
    throw new Error("The photo must be smaller than 2 MB. Retake it with the in-app camera and try again.");
  }

  const photoRef = ref(storage, storagePath);
  await uploadBytes(photoRef, blob, {
    contentType: blob.type || "image/jpeg",
    cacheControl: "public,max-age=0,must-revalidate",
  });
  const url = await getDownloadURL(photoRef);
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

export function describeProfilePhotoUploadError(error: any): string {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  if (code === "storage/unauthorized") {
    return "Firebase Storage denied this upload. Confirm that your profile is linked to the correct staff record and organisation.";
  }
  if (code === "storage/retry-limit-exceeded" || code === "storage/network-request-failed") {
    return "The photo could not reach Firebase Storage. Check your internet connection and try again.";
  }
  if (typeof error?.message === "string" && error.message.trim()) return `${code}: ${error.message}`;
  return `Photo upload failed (${code}). Check your connection and try again.`;
}
