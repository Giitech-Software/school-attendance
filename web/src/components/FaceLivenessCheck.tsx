import { useEffect, useState } from "react";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";
import "@aws-amplify/ui-react-liveness/styles.css";
import { createFaceLivenessSession, getFaceLivenessCredentials, getFaceLivenessSessionResults } from "../services/faceLiveness";

const AWS_REGION = "us-east-1".trim();
// Keep the threshold consistent with mobile. A 90-point cutoff can reject
// genuine users on modest cameras or in less-than-ideal lighting.
const MIN_CONFIDENCE = 80;

export default function FaceLivenessCheck({ onVerified, disabled }: { onVerified: () => void; disabled?: boolean }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    createFaceLivenessSession()
      .then(({ sessionId: id }) => { if (active) setSessionId(id); })
      .catch((err) => { if (active) setError(err?.message ?? "Could not start liveness verification."); })
      .finally(() => { if (active) setStarting(false); });
    return () => { active = false; };
  }, []);

  async function handleComplete() {
    if (!sessionId) return;
    const result = await getFaceLivenessSessionResults(sessionId);
    if (result.status !== "SUCCEEDED" || Number(result.confidence ?? 0) < MIN_CONFIDENCE) {
      throw new Error("Liveness verification was not strong enough. Please try again in good lighting.");
    }
    onVerified();
  }

  if (starting) return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Starting secure liveness verification…</div>;
  if (error) return <div role="alert" className="status-error">{error}</div>;
  if (!sessionId || disabled) return null;
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><FaceLivenessDetectorCore sessionId={sessionId} region={AWS_REGION} onAnalysisComplete={handleComplete} onError={(err) => setError(err?.error?.message ?? "Liveness verification failed.")} config={{ credentialProvider: async () => getFaceLivenessCredentials(sessionId) }} /></div>;
}
