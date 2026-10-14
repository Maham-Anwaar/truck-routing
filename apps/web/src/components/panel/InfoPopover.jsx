import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { LV } from "../../domain/levels.js";
import { THRESHOLDS } from "../../domain/weather.js";
import styles from "./InfoPopover.module.css";

export default function InfoPopover({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-label="How risk is scored" onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <strong>How risk is scored</strong>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <p className={styles.intro}>
          Each checkpoint takes the worst of its wind, rain, and snow level. Heavy loads can raise wind risk.
        </p>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Level</th>
              <th>Wind gusts</th>
              <th>Rain</th>
              <th>Snow</th>
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((row, i) => (
              <tr key={i}>
                <td>
                  <span className={styles.chip} style={{ background: LV[i].c, color: LV[i].fg }}>
                    {LV[i].g || "•"}
                  </span>
                  {LV[i].n}
                </td>
                <td>{row[0]}</td>
                <td>{row[1]}</td>
                <td>{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={styles.rules}>
          Load rules: 45–54 mph wind with &gt; 30,000 lb → No Travel. 35–44 mph wind with &gt; 40,000 lb → Severe.
        </p>
      </div>
    </div>,
    document.body,
  );
}
