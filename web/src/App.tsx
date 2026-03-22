// web/src/App.tsx
import { type JSX } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Students from "./pages/Students";
import Checkin from "./pages/Checkin";
import Reports from "./pages/Reports";

export default function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/students" element={<Students />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
