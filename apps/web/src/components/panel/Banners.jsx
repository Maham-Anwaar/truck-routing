import { Octagon, Info, CloudSlash, ClockCountdown } from "@phosphor-icons/react";
import { clock, TZ } from "../../domain/format.js";
import styles from "./Banners.module.css";

// Result-state advisories, matching the original's banner rules.
export default function Banners({ data }) {
  if (!data) return null;
  const banners = [];

  if (data.routes.every((r) => r.ntCp))
    banners.push({
      Icon: Octagon, weight: "fill", tone: "nt",
      title: "No route is safe at this departure time.",
      sub: "Every option crosses No Travel conditions. Scrub the forecast for a calmer window, then change your departure.",
    });
  if (data.routes.length < 3)
    banners.push({
      Icon: Info, tone: "info",
      title: `Only ${data.routes.length} route option${data.routes.length > 1 ? "s" : ""} found for this trip.`,
      sub: "Ranking compares the options the routing service returned.",
    });
  if (data.routes.some((r) => r.missing))
    banners.push({
      Icon: CloudSlash, tone: "info",
      title: "Weather is incomplete for some checkpoints.",
      sub: "Gray checkpoints have no data. The recommendation uses the checkpoints that reported.",
    });
  if (data.routes.some((r) => r.beyond))
    banners.push({
      Icon: ClockCountdown, tone: "info",
      title: "Part of this trip is beyond the 48 h forecast.",
      sub: `Checkpoints after ${clock(data.dep + data.horizon * 3.6e6)} ${TZ} are gray and not ranked. Leave earlier for a full picture.`,
    });

  if (!banners.length) return null;
  return (
    <div className={styles.banners}>
      {banners.map((b, i) => (
        <div key={i} className={[styles.banner, styles[b.tone]].join(" ")}>
          <b.Icon weight={b.weight || "regular"} size={18} className={styles.icon} />
          <div>
            <strong>{b.title}</strong>
            <span>{b.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
