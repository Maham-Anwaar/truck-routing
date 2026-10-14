import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { dur } from "../../domain/format.js";
import styles from "./WhyPanel.module.css";

const LABELS = ["Fewest Severe miles", "Fewest High miles", "Lowest average risk", "Shortest travel time"];
const FMT = [(v) => `${v} mi`, (v) => `${v} mi`, (v) => v.toFixed(1), (v) => dur(v)];

export default function WhyPanel({ data, open, onToggle }) {
  const R = data.ranked;
  const vals = [R.map((r) => r.sev), R.map((r) => r.high), R.map((r) => r.avgR), R.map((r) => r.hours)];

  return (
    <div className={styles.why}>
      <button className={styles.toggle} onClick={onToggle} aria-expanded={open}>
        {open ? <CaretDown size={13} /> : <CaretRight size={13} />}
        Why this route?
      </button>

      {open && (
        <div className={styles.body}>
          <p className={styles.sentence}>{data.sentence}</p>
          <div
            className={styles.grid}
            style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${R.length}, 52px)` }}
          >
            <div className={styles.corner} />
            {R.map((r) => (
              <div key={r.id} className={styles.colHead}>
                {r.id}
              </div>
            ))}

            {LABELS.map((label, i) => {
              const dec = data.rule === i;
              const best = Math.min(...vals[i]);
              return (
                <Row key={label} label={label} dec={dec}>
                  {vals[i].map((v, j) => (
                    <div
                      key={j}
                      className={styles.cell}
                      style={{
                        color: j === 0 && dec ? "var(--color-accent-200)" : v === best ? "var(--color-neutral-100)" : "var(--color-neutral-400)",
                        fontWeight: j === 0 && dec ? 600 : 400,
                      }}
                    >
                      {FMT[i](v)}
                    </div>
                  ))}
                </Row>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, dec, children }) {
  return (
    <>
      <div
        className={styles.rowLabel}
        style={{
          background: dec ? "var(--color-accent-900)" : "transparent",
          boxShadow: dec ? "inset 0 0 0 1px var(--color-accent-700)" : "none",
          color: dec ? "var(--color-accent-200)" : "var(--color-neutral-200)",
        }}
      >
        {label}
      </div>
      {children}
    </>
  );
}
