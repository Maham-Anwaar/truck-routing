import { useMemo, useRef, useState } from "react";
import { ArrowsDownUp, Scales, WarningCircle, CircleNotch, CaretDown } from "@phosphor-icons/react";
import { findPlace, fmtLoad, toLocalStr } from "../../domain/format.js";
import { hav, getPlaces } from "../../domain/geo.js";
import { routeDefs, MODES } from "../../domain/routes.js";
import {
  isValidTrip,
  fieldError,
  loadInvalid,
  depInvalid,
  DEP_MIN_MS,
  DEP_MAX_MS,
} from "../../domain/validation.js";
import styles from "./TripForm.module.css";

const DEP_MIN = toLocalStr(Math.ceil(DEP_MIN_MS / 9e5) * 9e5);
const DEP_MAX = toLocalStr(DEP_MAX_MS - 2 * 6e4);

export default function TripForm({ form, setField, setForm, phase, loadStep, onSubmit }) {
  const [touched, setTouched] = useState({});

  const isLoading = phase === "loading";
  const valid = isValidTrip(form);
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const errO = fieldError(form, touched, "origin");
  const errD = fieldError(form, touched, "dest");
  const loadBad = loadInvalid(form, touched);
  const depBad = depInvalid(form, touched);

  const pick = (k, label) => {
    setField(k, label);
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const swap = () => setForm((f) => ({ ...f, origin: f.dest, dest: f.origin }));
  const fillExample = () => {
    setForm({ origin: "Dallas, TX", dest: "Minneapolis, MN", dep: "2026-10-15T06:00", load: "42,000" });
    setTouched({});
  };

  // Estimated checkpoint count for the loading copy.
  const o = findPlace(form.origin),
    d = findPlace(form.dest);
  const cpEstimate =
    o && d
      ? Math.round((routeDefs(o, d, MODES.results).length * hav([o.lat, o.lon], [d.lat, d.lon]) * 1.2) / 25)
      : "—";

  const submit = (e) => {
    e.preventDefault();
    setTouched({ origin: true, dest: true, dep: true, load: true });
    onSubmit();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      {/* Origin / destination with swap */}
      <div className={styles.places}>
        <PlaceField
          label="Origin"
          value={form.origin}
          err={errO}
          onChange={(v) => setField("origin", v)}
          onBlur={() => touch("origin")}
          onPick={(label) => pick("origin", label)}
        />
        <button type="button" className={styles.swap} onClick={swap} aria-label="Swap origin and destination">
          <ArrowsDownUp size={16} />
        </button>
        <PlaceField
          label="Destination"
          value={form.dest}
          err={errD}
          onChange={(v) => setField("dest", v)}
          onBlur={() => touch("dest")}
          onPick={(label) => pick("dest", label)}
        />
      </div>

      {/* Departure + load */}
      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.lbl}>Departure</span>
          <input
            type="datetime-local"
            className={styles.input}
            value={form.dep}
            min={DEP_MIN}
            max={DEP_MAX}
            onChange={(e) => setField("dep", e.target.value)}
            onBlur={() => touch("dep")}
            style={depBad ? { boxShadow: "0 0 0 1px #e0464f" } : undefined}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.lbl}>Load</span>
          <div className={styles.loadWrap}>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              value={form.load}
              placeholder="0"
              onChange={(e) => setField("load", fmtLoad(e.target.value))}
              onBlur={() => touch("load")}
              style={loadBad ? { boxShadow: "0 0 0 1px #e0464f" } : undefined}
            />
            <span className={styles.unit}>lb</span>
          </div>
        </label>
      </div>

      {/* Helper / error line */}
      <div className={[styles.helper, (loadBad || depBad) && styles.helperBad].filter(Boolean).join(" ")}>
        {loadBad || depBad ? <WarningCircle weight="fill" size={13} /> : <Scales size={13} />}
        {loadBad
          ? "Enter a load between 0 and 80,000 lb."
          : depBad
            ? "Departure must be within the next 48 hours."
            : "Loads over 30,000 lb and 40,000 lb raise wind risk."}
      </div>

      {/* Loading steps */}
      {isLoading && (
        <div className={styles.steps}>
          {[{ label: "Finding routes" }, { label: `Checking weather at ${cpEstimate} checkpoints` }].map(
            (s, i) => (
              <div
                key={i}
                className={[styles.step, loadStep === i && styles.stepActive, loadStep > i && styles.stepDone]
                  .filter(Boolean)
                  .join(" ")}
              >
                {loadStep === i ? (
                  <CircleNotch size={14} className={styles.spin} />
                ) : loadStep > i ? (
                  <span className={styles.check}>✓</span>
                ) : (
                  <span className={styles.dot} />
                )}
                {s.label}
              </div>
            ),
          )}
        </div>
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.example} onClick={fillExample}>
          Fill example
        </button>
        <button type="submit" className={styles.plan} disabled={!valid || isLoading}>
          {isLoading ? (
            <>
              <CircleNotch size={15} className={styles.spin} /> Planning…
            </>
          ) : (
            "Plan routes"
          )}
        </button>
      </div>
    </form>
  );
}

// Searchable dropdown over the (bounded) place list: click/focus to open the
// full list, type to filter, arrow keys + Enter to pick.
function PlaceField({ label, value, err, onChange, onBlur, onPick }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const blurTimer = useRef();

  // Exact pick hides the list; otherwise filter by substring (case-insensitive).
  const options = useMemo(() => {
    const all = getPlaces();
    const q = value.trim().toLowerCase();
    const list = !q || findPlace(value) ? all : all.filter((p) => p.label.toLowerCase().includes(q));
    return list;
  }, [value]);

  const choose = (label) => {
    onPick(label);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && options[hi]) {
      e.preventDefault();
      choose(options[hi].label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <label className={styles.field}>
      <span className={styles.lbl}>{label}</span>
      <div className={styles.acWrap}>
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          className={styles.input}
          value={value}
          placeholder="Select a city…"
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onFocus={() => {
            setOpen(true);
            setHi(0);
          }}
          onBlur={() => {
            // Delay so a mousedown on an option lands before we close.
            blurTimer.current = setTimeout(() => setOpen(false), 120);
            onBlur();
          }}
          onKeyDown={onKeyDown}
          style={err ? { boxShadow: "0 0 0 1px #e0464f" } : undefined}
        />
        <CaretDown size={14} className={styles.caret} />
        {open && options.length > 0 && (
          <ul className={styles.ac} role="listbox">
            {options.map((p, i) => (
              <li key={p.label} role="option" aria-selected={i === hi}>
                <button
                  type="button"
                  className={i === hi ? styles.acItemOn : styles.acItem}
                  onMouseEnter={() => setHi(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    clearTimeout(blurTimer.current);
                    choose(p.label);
                  }}
                >
                  {p.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {err && (
        <div className={styles.err}>
          {err.text}
          {err.sug.length > 0 && (
            <span className={styles.sugs}>
              {err.sug.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className={styles.sug}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(p.label);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
