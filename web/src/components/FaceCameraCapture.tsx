import { useCallback, useEffect, useRef, useState } from "react";

type FaceCameraCaptureProps = {
  disabled?: boolean;
  autoStart?: boolean;
  autoCaptureOnEnable?: boolean;
  captureLabel: string;
  processingLabel?: string;
  onCapture: (base64Image: string) => Promise<void>;
};

export default function FaceCameraCapture({ disabled = false, autoStart = false, autoCaptureOnEnable = false, captureLabel, processingLabel = "Processing…", onCapture }: FaceCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [autoCaptureRequested, setAutoCaptureRequested] = useState(false);
  const autoStartAttemptedRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (cameraStarting || cameraActive) return;
    setCameraStarting(true);
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a camera.");
      setCameraStarting(false);
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
    } finally {
      setCameraStarting(false);
    }
  }, [cameraActive, cameraStarting, stopCamera]);

  useEffect(() => {
    if (!autoStart || autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;
    void startCamera();
  }, [autoStart, startCamera]);

  const captureFrame = useCallback(async () => {
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
      // Front-camera previews can be mirrored by the browser/device. Normalize
      // the recognition image to natural orientation so left/right movement is
      // consistent with the user's view and face-registration images.
      context.save();
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.restore();
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
  }, [disabled, capturing, onCapture]);

  useEffect(() => {
    if (!autoCaptureOnEnable || disabled || !cameraActive || autoCaptureRequested) return;
    setAutoCaptureRequested(true);
    void captureFrame();
  }, [autoCaptureOnEnable, disabled, cameraActive, autoCaptureRequested, captureFrame]);

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-950">
        <video ref={videoRef} className={`aspect-[3/4] w-full object-cover scale-x-[-1] sm:aspect-video ${cameraActive ? "block" : "hidden"}`} aria-label="Face camera preview" />
        {!cameraActive ? (
            <div className="flex aspect-[3/4] items-center justify-center px-4 text-center text-sm font-semibold text-slate-300 sm:aspect-video">
            Front camera preview will appear here
          </div>
        ) : null}
        {cameraActive ? (
          <button
            type="button"
            onClick={captureFrame}
            disabled={disabled || capturing}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg ring-2 ring-white/80 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {capturing ? processingLabel : captureLabel}
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-sm font-medium text-slate-700">
        Position your face in the frame, look directly at the camera, and keep still. Then press “Capture face.”
      </p>

      {cameraError ? <div className="status-error mt-3">{cameraError}</div> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={startCamera} disabled={disabled || cameraActive || cameraStarting} className="enterprise-button-primary self-start w-fit whitespace-nowrap">
          {cameraStarting ? "Starting camera…" : cameraActive ? "Camera Ready" : "Start Camera"}
        </button>
        <button type="button" onClick={stopCamera} disabled={!cameraActive || capturing} className="enterprise-button-secondary">
          Stop
        </button>
      </div>
    </div>
  );
}
