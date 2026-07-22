import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signIn, signOutUser } from "../services/auth";
import { getUserById } from "../services/users";
import AuthBrandHeader from "../components/AuthBrandHeader";

function friendlyAuthError(err: any) {
  const code = String(err?.code ?? "");
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Invalid email or password.";
  if (code.includes("user-not-found")) return "No account was found for this email.";
  if (code.includes("too-many-requests")) return "Too many attempts. Please wait and try again.";
  if (code.includes("api-key-expired")) return "Firebase API key has expired. Renew the Firebase web key.";
  return err?.message ?? "Unable to sign in. Please try again.";
}

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signIn(email.trim(), password);

      if (!credential.user.emailVerified) {
        await signOutUser();
        setError("Please verify your email before logging in.");
        return;
      }

      const user = await getUserById(credential.user.uid);
      if (!user) throw new Error("User profile not found.");

      if (user.role !== "admin" && user.role !== "super_admin" && user.approved !== true) {
        await signOutUser();
        setError("Your account is pending administrator approval.");
        return;
      }

      navigate((user.role === "parent" || (user.wards?.length ?? 0) > 0) ? "/users" : "/", { replace: true });
    } catch (err: any) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <AuthBrandHeader />
      <div className="auth-card">
        <h1 className="mb-4 text-center text-3xl font-bold text-slate-950">Sign In</h1>

        <form onSubmit={handleLogin} className="space-y-3">
          <label className="block">
            <span className="auth-label">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="enterprise-input mt-1.5" />
          </label>

          <label className="block">
            <span className="auth-label">Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Your password" className="enterprise-input mt-1.5" />
          </label>

          <button type="button" onClick={() => setShowPassword((value) => !value)} className="auth-link">
            {showPassword ? "Hide password" : "Show password"}
          </button>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="auth-link text-sm font-medium">
              Forgot password?
            </Link>
          </div>

          {error ? <div className="status-error">{error}</div> : null}

          <button type="submit" disabled={loading} className="enterprise-button-primary w-full py-3 text-base">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Don't have an account? <Link to="/signup" className="auth-link">Create account</Link>
        </p>
      </div>
    </div>
  );
}


