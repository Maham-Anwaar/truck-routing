import { useEffect, useRef, useState } from "react";
import styles from "./BottomSheet.module.css";

// Phone bottom sheet with peek / half / full snap points.
// Drag the handle to resize; tap it to cycle. Reports its height via onHeight
// so the forecast slider can sit just above it.
const ORDER = ["peek", "half", "full"];

export default function BottomSheet({ children, onHeight }) {
  const [snap, setSnap] = useState("half");
  const [dragH, setDragH] = useState(null);
  const [vh, setVh] = useState(typeof window !== "undefined" ? window.innerHeight : 800);
  const drag = useRef(null);

  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const SH = { peek: 226, half: Math.round(vh * 0.5), full: vh - 64 };
  const height = dragH != null ? dragH : SH[snap];

  useEffect(() => {
    onHeight?.(height);
  }, [height, onHeight]);

  const onPointerDown = (e) => {
    drag.current = { y: e.clientY, h: height, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setDragH(Math.max(120, Math.min(SH.full, d.h - dy)));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      setSnap((s) => ORDER[(ORDER.indexOf(s) + 1) % ORDER.length]);
      return;
    }
    // Snap to the nearest configured height.
    const cur = dragH ?? height;
    const nearest = Object.keys(SH).reduce((a, b) =>
      Math.abs(SH[b] - cur) < Math.abs(SH[a] - cur) ? b : a,
    );
    setSnap(nearest);
    setDragH(null);
  };

  return (
    <div className={styles.sheet} style={{ height }}>
      <div
        className={styles.handle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        role="button"
        aria-label="Resize panel"
      >
        <span className={styles.grip} />
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
