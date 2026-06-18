import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendPasswordReset } from "../services/auth";

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setMessage("A password reset link has been sent to your email address.");
    } catch (err: any) {
      setError(err?.message ?? "Unable to send reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="mb-2 text-center text-3xl font-bold text-slate-950">Forgot password</h1>
        <p className="mb-5 text-center text-sm text-slate-600">Enter your email and we'll send you a password reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="auth-label">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="enterprise-input mt-1.5" placeholder="you@example.com" autoComplete="email" />
          </label>

          {message ? <div className="status-success">{message}</div> : null}
          {error ? <div className="status-error">{error}</div> : null}

          <button type="submit" disabled={loading} className="enterprise-button-primary w-full py-3 text-base">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Remembered your password? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

