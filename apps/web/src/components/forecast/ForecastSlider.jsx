import { useEffect, useRef } from "react";
import { Play, Pause, FlagCheckered } from "@phosphor-icons/react";
import { clock, TZ } from "../../domain/format.js";
import styles from "./ForecastSlider.module.css";

export default function ForecastSlider({ data, selected, hour, setHour, playing, setPlaying }) {
  const dep = data?.dep ?? 0;
  const horizon = data?.horizon ?? 48;
  const sel = data?.routes.find((r) => r.id === selected);
  const horizonPct = Math.max(0, Math.min(100, (horizon / 48) * 100));
  const arrivalPct = sel ? Math.min(100, (sel.hours / 48) * 100) : null;
  const arrivalLabel = sel ? `Route ${sel.id} arrives ${clock(dep + sel.hours * 3.6e6)}` : "";
  // Play stops when the truck reaches the destination (first whole hour at/after arrival).
  const stopHour = sel ? Math.min(48, Math.ceil(sel.hours)) : 48;
  const timer = useRef();

  // Play loop: advance one forecast hour every 500ms, stopping when the truck
  // reaches its destination (the selected route's arrival hour).
  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setHour((h) => {
        if (h >= stopHour) {
          setPlaying(false);
          return h;
        }
        return h + 1;
      });
    }, 500);
    return () => clearInterval(timer.current);
  }, [playing, stopHour, setHour, setPlaying]);

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (hour >= stopHour) setHour(0); // already arrived — replay from the start
    setPlaying(true);
  };

  // Keyboard: ±1 (±6 with Shift), Home/End, Space toggles play.
  const onKeyDown = (e) => {
    if (!data) return;
    const step = e.shiftKey ? 6 : 1;
    let n = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") n = hour + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") n = hour - step;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = 48;
    else if (e.key === " ") {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (n !== null) {
      e.preventDefault();
      setPlaying(false);
      setHour(Math.max(0, Math.min(48, n)));
    }
  };

  const beyond = hour > horizon;
  const ticks = [];
  for (let h = 0; h <= 48; h += 12)
    ticks.push({ pct: (h / 48) * 100, label: data ? clock(dep + h * 3.6e6, false) : `+${h}h` });

  return (
    <div className={styles.wrap} style={{ opacity: data ? 1 : 0.45 }}>
      <button
        className={styles.play}
        onClick={togglePlay}
        disabled={!data}
        aria-label={playing ? "Pause forecast" : "Play forecast"}
      >
        {playing ? <Pause weight="fill" size={16} /> : <Play weight="fill" size={16} />}
      </button>

      <div className={styles.track}>
        <div className={styles.caption}>
          Forecast · moves the heatmap and truck, not checkpoints
        </div>
        {/* Chosen route's arrival, tied to the selected route */}
        {arrivalPct != null && (
          <div className={styles.markerRow}>
            <span
              className={styles.arrivalLabel}
              style={{
                left: `${arrivalPct}%`,
                transform: arrivalPct > 82 ? "translateX(-100%)" : arrivalPct < 18 ? "none" : "translateX(-50%)",
              }}
              title={arrivalLabel}
            >
              <FlagCheckered size={11} weight="fill" />
              Arrives {clock(dep + sel.hours * 3.6e6)}
            </span>
          </div>
        )}
        <div className={styles.rangeWrap}>
          {/* Track groove + elapsed fill (0 -> current hour) */}
          <span className={styles.trackBase} />
          <span className={styles.fill} style={{ width: `${(hour / 48) * 100}%` }} />
          {/* Beyond-forecast shading */}
          {horizonPct < 100 && (
            <span
              className={styles.beyondShade}
              style={{ left: `${horizonPct}%`, width: `${100 - horizonPct}%` }}
              title="Beyond the 48 h forecast"
            />
          )}
          {/* Arrival marker */}
          {arrivalPct != null && (
            <span className={styles.arrival} style={{ left: `${arrivalPct}%` }} title="Arrival" />
          )}
          <input
            className={styles.range}
            type="range"
            min={0}
            max={48}
            step={1}
            value={hour}
            disabled={!data}
            onChange={(e) => {
              setPlaying(false);
              setHour(Number(e.target.value));
            }}
            onKeyDown={onKeyDown}
            aria-label="Forecast hour"
          />
        </div>
        <div className={styles.ticks}>
          {ticks.map((t, i) => (
            <span key={i} className={styles.tick} style={{ left: `${t.pct}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.readout}>
        <strong>{data ? `${clock(dep + hour * 3.6e6)} ${TZ}` : "—"}</strong>
        <span className={beyond ? styles.beyond : ""}>
          +{hour} h{beyond ? " · Beyond forecast" : ""}
        </span>
      </div>
    </div>
  );
}
