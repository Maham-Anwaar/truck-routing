import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { X } from "@phosphor-icons/react";
import { LV, GRAY } from "../../domain/levels.js";
import { clock, dur, TZ } from "../../domain/format.js";
import styles from "./CheckpointPopover.module.css";

// A themed tooltip/dialog pinned to a checkpoint's map position.
// `pin` = clicked (sticky dialog with a close button); `hover` = transient.
export default function CheckpointPopover({ data, pin, hover, onClose }) {
  const map = useMap();
  const [, force] = useState(0);

  // Reposition while the map moves.
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    map.on("move zoom resize", rerender);
    return () => map.off("move zoom resize", rerender);
  }, [map]);

  // Esc closes a pinned popover.
  useEffect(() => {
    if (!pin) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pin, onClose]);

  const target = pin || hover;
  if (!data || !target) return null;
  const route = data.routes.find((r) => r.id === target.rid);
  const c = route?.cps[target.i];
  if (!c) return null;

  const pinned = !!pin && (!hover || (pin.rid === target.rid && pin.i === target.i));
  const pt = map.latLngToContainerPoint(c.ll);
  const below = pt.y < 240;
  const ok = c.lv >= 0;
  const L = ok ? LV[c.lv] : null;

  const metrics = ok
    ? [
        { k: "Wind gusts", v: `${c.w.wind} mph`, on: c.driver === "wind" },
        { k: "Rain", v: `${c.w.rain.toFixed(2)} in/hr`, on: c.driver === "rain" },
        { k: "Snow", v: `${c.w.snow.toFixed(1)} in/hr`, on: c.driver === "snow" },
      ]
    : [];

  const content = (
    <div
      className={[styles.pop, pinned && styles.pinned].filter(Boolean).join(" ")}
      role={pinned ? "dialog" : "tooltip"}
      style={{
        left: Math.max(146, Math.min(map.getSize().x - 146, pt.x)),
        top: pt.y,
        transform: below ? "translate(-50%, 16px)" : "translate(-50%, calc(-100% - 16px))",
        pointerEvents: pinned ? "auto" : "none",
      }}
    >
      <div className={styles.head}>
        <span className={styles.glyph} style={{ background: ok ? L.c : GRAY, color: ok ? L.fg : "#f3f5fe" }}>
          {ok ? L.g || "•" : "?"}
        </span>
        <div className={styles.headText}>
          <strong>{ok ? L.n : c.st === "nodata" ? "No data" : "Beyond forecast"}</strong>
          {ok && c.driver && <span className={styles.driver}>driven by {c.driver}</span>}
        </div>
        {pinned && (
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X size={13} />
          </button>
        )}
      </div>

      <div className={styles.sub}>
        Mile {Math.round(c.m)} of {Math.round(route.total)}, Route {route.id}
      </div>
      <div className={styles.eta}>
        {clock(data.dep + c.eta * 3.6e6)} {TZ} (+{dur(c.eta)})
      </div>

      {ok ? (
        <div className={styles.metrics}>
          {metrics.map((m) => (
            <div key={m.k} className={styles.metric} style={m.on ? { boxShadow: `inset 0 0 0 1px ${L.c}` } : undefined}>
              <span className={styles.mk}>{m.k}</span>
              <span className={styles.mv}>{m.v}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.note}>
          {c.st === "nodata"
            ? "The weather service returned no data for this point. It is left out of the ranking."
            : `This ETA is past the 48 h forecast range (ends ${clock(data.dep + data.horizon * 3.6e6)} ${TZ}).`}
        </div>
      )}

      {c.rule && <div className={styles.rule}>{c.rule}</div>}
    </div>
  );

  return createPortal(content, map.getContainer());
}
