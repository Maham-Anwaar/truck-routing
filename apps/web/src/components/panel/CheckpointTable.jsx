import { LV, GRAY } from "../../domain/levels.js";
import { clock } from "../../domain/format.js";
import styles from "./CheckpointTable.module.css";

export default function CheckpointTable({ route, data, spacing = 25, pin, onHoverCp, onPinCp }) {
  if (!route) return <div className={styles.empty}>Select a route to see its checkpoints.</div>;

  return (
    <div className={styles.wrap}>
      <div className={styles.meta}>
        {route.cps.length} checkpoints · every {spacing} mi · Route {route.id}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Mile</th>
            <th>ETA</th>
            <th>Risk</th>
            <th className={styles.num}>Wind</th>
            <th className={styles.num}>Rain</th>
            <th className={styles.num}>Snow</th>
          </tr>
        </thead>
        <tbody>
          {route.cps.map((c) => {
            const ok = c.lv >= 0;
            const on = pin && pin.rid === route.id && pin.i === c.i;
            return (
              <tr
                key={c.i}
                className={on ? styles.on : ""}
                onMouseEnter={() => onHoverCp({ rid: route.id, i: c.i })}
                onMouseLeave={() => onHoverCp(null)}
                onClick={() => onPinCp({ rid: route.id, i: c.i })}
              >
                <td>{Math.round(c.m)}</td>
                <td className={styles.eta}>{clock(data.dep + c.eta * 3.6e6)}</td>
                <td>
                  <span
                    className={styles.chip}
                    style={{ background: ok ? LV[c.lv].c : GRAY, color: ok ? LV[c.lv].fg : "#f3f5fe" }}
                  >
                    {ok ? LV[c.lv].g || "•" : "?"}
                  </span>
                  {ok ? LV[c.lv].n : c.st === "nodata" ? "No data" : "Beyond"}
                </td>
                <td className={styles.num}>{ok ? c.w.wind : "—"}</td>
                <td className={styles.num}>{ok ? c.w.rain.toFixed(2) : "—"}</td>
                <td className={styles.num}>{ok ? c.w.snow.toFixed(1) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
