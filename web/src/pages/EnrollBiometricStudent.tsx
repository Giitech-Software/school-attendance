import { Link } from "react-router-dom";

export default function EnrollBiometricStudent() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <section className="enterprise-panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
          <Link to="/students" className="rounded-lg border border-white/20 px-2.5 py-1 text-sm font-semibold text-white hover:bg-white/10" aria-label="Back to students">
            Back
          </Link>
          <div>
            <h1 className="text-xl font-extrabold">Enroll student biometric</h1>
            <p className="mt-1 text-xs text-white/70">Biometric enrollment for student attendance is managed via the mobile app.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="enterprise-panel p-4">
          <h2 className="text-base font-extrabold text-slate-950">Web App Limitation</h2>
          <p className="mt-2 text-sm text-slate-600">Biometric enrollment requires device hardware such as a fingerprint scanner or camera, which is only available through the mobile app flow.</p>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-700">
            Web reflects enrollment status after mobile capture is completed.
          </div>
        </div>

        <div className="enterprise-panel p-4">
          <h2 className="text-base font-extrabold text-slate-950">Mobile enrollment steps</h2>
          <ol className="mt-3 grid gap-2 text-sm text-slate-700">
            <li className="rounded-lg bg-slate-50 p-3">1. Open the mobile app on an Android or iOS device.</li>
            <li className="rounded-lg bg-slate-50 p-3">2. Go to Students, select the student, then choose Enroll Biometric.</li>
            <li className="rounded-lg bg-slate-50 p-3">3. Follow the capture prompts for fingerprint or biometric data.</li>
            <li className="rounded-lg bg-slate-50 p-3">4. Confirm enrollment completion.</li>
          </ol>
        </div>
      </section>

      <section className="enterprise-panel p-4">
        <h2 className="text-base font-extrabold text-slate-950">Supported biometric types</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded bg-slate-50 px-3 py-2 text-slate-700">Fingerprint scanning</span>
          <span className="rounded bg-slate-50 px-3 py-2 text-slate-700">Face recognition via mobile app</span>
        </div>
      </section>
    </div>
  );
}

