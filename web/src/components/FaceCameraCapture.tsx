import { useCallback, useEffect, useRef, useState } from "react";

type FaceCameraCaptureProps = {
  disabled?: boolean;
  captureLabel: string;
  onCapture: (base64Image: string) => Promise<void>;
};

export default function FaceCameraCapture({ disabled = false, captureLabel, onCapture }: FaceCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a camera.");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Camera preview is not ready.");
      videoRef.current.srcObject = stream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      await videoRef.current.play();
      setCameraActive(true);
    } catch (err: any) {
      console.error("start face camera", err);
      stopCamera();
      setCameraError(err?.message ?? "Could not start the camera. Check browser camera permission and try again.");
    }
  }

  async function captureFrame() {
    if (!videoRef.current || disabled || capturing) return;
    const video = videoRef.current;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCameraError("Camera is still loading. Try again in a moment.");
      return;
    }

    setCapturing(true);
    setCameraError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 960;
      canvas.height = video.videoHeight || 720;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare image capture.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      const base64 = dataUrl.split(",")[1];
      if (!base64) throw new Error("Could not capture image.");
      await onCapture(base64);
    } catch (err: any) {
      console.error("capture face image", err);
      setCameraError(err?.message ?? "Could not capture image.");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <video ref={videoRef} className={`aspect-video w-full object-cover ${cameraActive ? "block" : "hidden"}`} aria-label="Face camera preview" />
        {!cameraActive ? (
          <div className="flex aspect-video items-center justify-center px-4 text-center text-sm font-semibold text-slate-300">
            Front camera preview will appear here
          </div>
        ) : null}
      </div>

      {cameraError ? <div className="status-error mt-3">{cameraError}</div> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={startCamera} disabled={disabled || cameraActive} className="enterprise-button-primary">
          {cameraActive ? "Camera Ready" : "Start Camera"}
        </button>
        <button type="button" onClick={captureFrame} disabled={disabled || !cameraActive || capturing} className="enterprise-button-primary">
          {capturing ? "Capturing..." : captureLabel}
        </button>
        <button type="button" onClick={stopCamera} disabled={!cameraActive || capturing} className="enterprise-button-secondary">
          Stop
        </button>
      </div>
    </div>
  );
}
