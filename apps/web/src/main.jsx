import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App.jsx";
import { fetchAllPlaces } from "./services/api.js";
import { setPlaces } from "./domain/geo.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// Gate the app on the backend: load places from the API before rendering.
// There is no bundled place data — if the API is unreachable, we say so.
function Boot() {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    fetchAllPlaces()
      .then((places) => {
        if (!alive) return;
        setPlaces(places);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (status === "ready") return <App />;

  return (
    <div style={bootWrap}>
      {status === "loading" ? (
        <>
          <span style={spinner} />
          <div style={title}>Connecting to the routing service…</div>
        </>
      ) : (
        <>
          <div style={{ ...title, color: "var(--color-neutral-100)" }}>Can’t reach the API</div>
          <div style={sub}>
            Tried <code style={code}>{API_URL}</code>. Start the backend
            (<code style={code}>cd apps/api &amp;&amp; ./.venv/bin/python manage.py runserver</code>)
            and retry.
          </div>
          <button style={retry} onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}

const bootWrap = {
  position: "fixed",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "14px",
  padding: "24px",
  textAlign: "center",
  background: "var(--color-bg)",
  color: "var(--color-neutral-400)",
};
const title = { fontSize: "15px", fontWeight: 500, color: "var(--color-neutral-200)" };
const sub = { fontSize: "13px", maxWidth: "440px", lineHeight: 1.6 };
const code = {
  fontFamily: "ui-monospace, monospace",
  fontSize: "12px",
  background: "var(--color-surface)",
  padding: "1px 6px",
  borderRadius: "4px",
  color: "var(--color-neutral-200)",
};
const spinner = {
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  border: "2px solid var(--color-neutral-700)",
  borderTopColor: "var(--color-accent)",
  animation: "wr-spin .8s linear infinite",
};
const retry = {
  marginTop: "4px",
  padding: "8px 18px",
  borderRadius: "8px",
  background: "var(--color-accent)",
  color: "var(--color-bg)",
  fontWeight: 600,
  cursor: "pointer",
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Boot />
  </StrictMode>,
);
