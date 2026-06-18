import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { sendEmailVerificationToCurrentUser, signOutUser, signUp } from "../services/auth";
import { upsertUser, type UserRole } from "../services/users";

const roles: Array<{ value: UserRole; label: string }> = [
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
  { value: "non_teaching_staff", label: "Non-Teaching Staff" },
  { value: "staff", label: "Staff" },
];

function isValidEmail(email: string) {
  return /\S+@\S+\.\S+/.test(email);
}

function friendlySignupError(err: any) {
  const code = String(err?.code ?? "");
  if (code.includes("email-already-in-use")) return "An account already exists for this email.";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("api-key-expired")) return "Firebase API key has expired. Renew the Firebase web key.";
  return err?.message ?? "Unable to create your account. Please try again.";
}

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("teacher");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!fullName.trim() || !email.trim() || !password || !confirm) {
      setError("Please fill all fields.");
      return;
    }

    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signUp(email.trim(), password);

      try {
        await updateProfile(credential.user, { displayName: fullName.trim() || undefined });
      } catch (profileError) {
        console.warn("Failed to update display name", profileError);
      }

      const safeRole: UserRole = role === "admin" ? "teacher" : role;
      await upsertUser({
        id: credential.user.uid,
        uid: credential.user.uid,
        email: email.trim(),
        role: safeRole,
        displayName: fullName.trim(),
        approved: false,
        canTakeStaffAttendance: false,
        canTakeStudentAttendance: false,
        wards: [],
        createdAt: new Date(),
      });

      try {
        await sendEmailVerificationToCurrentUser();
      } catch (verificationError) {
        console.warn("Failed to send verification email", verificationError);
      }

      await signOutUser();
      setMessage("Account created. Please check your email for verification.");
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setRole("teacher");
    } catch (err: any) {
      setError(friendlySignupError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card max-w-lg">
        <h1 className="mb-4 text-center text-3xl font-bold text-slate-950">Create an account</h1>

        <form onSubmit={handleSignup} className="space-y-3">
          <label className="block">
            <span className="auth-label">Full Name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="enterprise-input mt-1.5" placeholder="Your full name" />
          </label>

          <label className="block">
            <span className="auth-label">Register as</span>
            <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className="enterprise-input mt-1.5">
              {roles.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="auth-label">Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="enterprise-input mt-1.5" placeholder="you@example.com" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="auth-label">Password</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" className="enterprise-input mt-1.5" placeholder="Create a password" />
            </label>
            <label className="block">
              <span className="auth-label">Confirm password</span>
              <input value={confirm} onChange={(event) => setConfirm(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" className="enterprise-input mt-1.5" placeholder="Confirm password" />
            </label>
          </div>

          <button type="button" onClick={() => setShowPassword((value) => !value)} className="auth-link">
            {showPassword ? "Hide password" : "Show password"}
          </button>

          {message ? <div className="status-success">{message}</div> : null}
          {error ? <div className="status-error">{error}</div> : null}

          <button type="submit" disabled={loading} className="enterprise-button-primary w-full py-3 text-base">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

