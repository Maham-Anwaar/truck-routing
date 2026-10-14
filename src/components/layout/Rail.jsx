import { CaretRight } from "@phosphor-icons/react";
import styles from "./Rail.module.css";

// Collapsed tablet rail: route dots + an expand affordance.
export default function Rail({ data, selected, onSelectRoute, onExpand }) {
  return (
    <aside className={styles.rail}>
      <button className={styles.expand} onClick={onExpand} aria-label="Expand panel">
        <CaretRight size={16} />
      </button>
      <div className={styles.dots}>
        {data?.ranked.map((r) => (
          <button
            key={r.id}
            className={r.id === selected ? styles.dotOn : styles.dot}
            onClick={() => onSelectRoute(r.id)}
            aria-label={`Route ${r.id}`}
            style={r.id === data.recId && r.id !== selected ? { boxShadow: "inset 0 0 0 1px var(--color-accent-700)" } : undefined}
          >
            {r.id}
          </button>
        ))}
      </div>
    </aside>
  );
}
