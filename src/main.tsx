import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AdminPanel } from "./components/AdminPanel";
import "./styles/globals.css";

// Tiny path-based route: /admin serves Luke's pricing editor, everything else
// serves the calculator. (Vercel's SPA fallback serves index.html for /admin.)
const isAdmin =
  window.location.pathname.replace(/\/+$/, "").toLowerCase() === "/admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>{isAdmin ? <AdminPanel /> : <App />}</React.StrictMode>,
);
