import { useState } from "react";
import { Info, CaretDown, CaretRight } from "@phosphor-icons/react";
import { LV, GRAY } from "../../domain/levels.js";
import InfoPopover from "./InfoPopover.jsx";
import styles from "./Legend.module.css";

const ROWS = [
  ...LV.map((l) => ({ n: l.n, bg: l.c, fg: l.fg, g: l.g })),
  { n: "No data / beyond forecast", bg: GRAY, fg: "#f3f5fe", g: "?" },
];

export default function Legend() {
  const [infoOpen, setInfoOpen] = useState(false);
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.legend}>
      <div className={styles.titleRow}>
        <button className={styles.toggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? <CaretDown size={12} /> : <CaretRight size={12} />}
          <span className={styles.title}>Risk level</span>
        </button>
        <button className={styles.info} onClick={() => setInfoOpen(true)} aria-label="How risk is scored">
          <Info size={14} />
        </button>
      </div>
      {open && (
        <div className={styles.rows}>
          {ROWS.map((r) => (
            <div key={r.n} className={styles.row}>
              <span className={styles.swatch} style={{ background: r.bg, color: r.fg }}>
                {r.g}
              </span>
              <span className={styles.name}>{r.n}</span>
            </div>
          ))}
        </div>
      )}
      {infoOpen && <InfoPopover onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
