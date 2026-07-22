import { Link } from "react-router-dom";

export default function AuthBrandHeader() {
  return (
    <header className="auth-brand-header">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-center px-4">
        <Link to="/login" className="text-center text-xl font-extrabold tracking-tight text-white sm:text-2xl">
          ASTEM Attendance Register
        </Link>
      </div>
    </header>
  );
}
