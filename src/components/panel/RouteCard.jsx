import { useState } from "react";
import { Octagon, CloudSlash, ClockCountdown } from "@phosphor-icons/react";
import { LV, HATCH_NT, HATCH_GRAY } from "../../domain/levels.js";
import { clock, dur } from "../../domain/format.js";
import styles from "./RouteCard.module.css";

// Build the weighted risk-breakdown bar from a route's per-level mileage.
function buildBar(r) {
  return [
    ...r.levelMi.map((mi, i) => ({ i, mi, n: LV[i].n, bg: i === 4 ? HATCH_NT : LV[i].c })),
    { i: 5, mi: r.grayMi, n: r.beyond ? "Beyond forecast" : "No data", bg: HATCH_GRAY },
  ].filter((x) => x.mi > 0.5);
}

export default function RouteCard({ route: r, data, selected, recommended, onSelect, onHover }) {
  const [barHover, setBarHover] = useState(null);
  const bar = buildBar(r);
  const arrive = data.dep + r.hours * 3.6e6;

  const warns = [];
  if (r.ntCp)
    warns.push({ Icon: Octagon, weight: "fill", text: `No Travel conditions at mile ${Math.round(r.ntCp.m)}`, danger: true });
  if (r.missing)
    warns.push({ Icon: CloudSlash, text: `Weather missing for ${r.missing} of ${r.cps.length} checkpoints` });
  if (r.beyond)
    warns.push({ Icon: ClockCountdown, text: `Beyond forecast for ${r.beyond} of ${r.cps.length} checkpoints` });

  return (
    <button
      type="button"
      data-route={r.id}
      className={[styles.card, selected && styles.selected, recommended && styles.recommended]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      onMouseEnter={() => onHover(r.id)}
      onMouseLeave={() => onHover(null)}
      aria-label={`Route ${r.id} ${r.name}${recommended ? ", recommended" : ""}`}
    >
      <div className={styles.head}>
        <span className={styles.badge}>{r.id}</span>
        <span className={styles.name}>{r.name}</span>
        {recommended && <span className={styles.rec}>Recommended</span>}
      </div>

      {recommended && <div className={styles.reason}>{data.reason}</div>}

      <div className={styles.keyline}>
        {Math.round(r.total)} mi · {dur(r.hours)} · Arrives {clock(arrive)}
      </div>

      <div className={styles.bar} role="img" aria-label="Risk breakdown by distance">
        {bar.map((x) => (
          <span
            key={x.i}
            className={styles.seg}
            style={{ flex: x.mi, background: x.bg, opacity: barHover && barHover.i !== x.i ? 0.45 : 1 }}
            title={`${x.n}: ${Math.round(x.mi)} mi`}
            onMouseEnter={() =>
              setBarHover({ i: x.i, text: `${x.n} · ${Math.round(x.mi)} mi (${Math.round((x.mi / r.total) * 100)}%)` })
            }
            onMouseLeave={() => setBarHover(null)}
          />
        ))}
      </div>
      <div className={styles.barReadout}>{barHover ? barHover.text : " "}</div>

      <div className={styles.metrics}>
        <Metric label="Severe" value={`${r.sev} mi`} hot={r.sev > 0} color="#f2777d" />
        <Metric label="High" value={`${r.high} mi`} hot={r.high > 0} color="#f5a566" />
        <Metric label="Avg risk" value={r.avgR.toFixed(1)} />
      </div>

      {warns.length > 0 && (
        <div className={styles.warns}>
          {warns.map((w, i) => (
            <span key={i} className={[styles.warn, w.danger && styles.danger].filter(Boolean).join(" ")}>
              <w.Icon weight={w.weight || "regular"} size={14} />
              {w.text}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

function Metric({ label, value, hot, color }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={hot ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}
