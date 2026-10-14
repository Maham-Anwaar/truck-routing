import { PencilSimple } from "@phosphor-icons/react";
import { DAYS, MONS, NOW } from "../../domain/constants.js";
import { parseDep, clock, TZ } from "../../domain/format.js";
import styles from "./TripSummary.module.css";

export default function TripSummary({ form, onEdit }) {
  const depMs = parseDep(form.dep);
  const d = new Date(isNaN(depMs) ? NOW : depMs);
  const line = `${DAYS[d.getDay()]} ${MONS[d.getMonth()]} ${d.getDate()}, ${clock(d.getTime())
    .split(" ")
    .slice(1)
    .join(" ")} ${TZ} · ${form.load || "—"} lb`;

  return (
    <div className={styles.summary}>
      <div className={styles.trip}>
        <span>{form.origin}</span>
        <span className={styles.arrow}>→</span>
        <span>{form.dest}</span>
      </div>
      <div className={styles.meta}>{line}</div>
      <button type="button" className={styles.edit} onClick={onEdit}>
        <PencilSimple size={14} /> Edit trip
      </button>
    </div>
  );
}
