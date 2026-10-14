import { useState } from "react";
import { ArrowsDownUp, Scales, WarningCircle, CircleNotch } from "@phosphor-icons/react";
import { suggest, findPlace, fmtLoad, toLocalStr } from "../../domain/format.js";
import { hav } from "../../domain/geo.js";
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
  const [active, setActive] = useState(null); // which field's autocomplete is open

  const isLoading = phase === "loading";
  const valid = isValidTrip(form);
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  // Autocomplete items for a place field (only while focused & inexact).
  const acItems = (k) => {
    const v = form[k];
    if (active !== k || !v || v.length < 3 || findPlace(v)) return [];
    return suggest(v);
  };

  const errO = fieldError(form, touched, "origin");
  const errD = fieldError(form, touched, "dest");
  const loadBad = loadInvalid(form, touched);
  const depBad = depInvalid(form, touched);

  const pick = (k, label) => {
    setField(k, label);
    setTouched((t) => ({ ...t, [k]: true }));
    setActive(null);
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
          items={acItems("origin")}
          onChange={(v) => {
            setField("origin", v);
            setActive("origin");
          }}
          onFocus={() => setActive("origin")}
          onBlur={() => {
            setActive(null);
            touch("origin");
          }}
          onPick={(label) => pick("origin", label)}
        />
        <button type="button" className={styles.swap} onClick={swap} aria-label="Swap origin and destination">
          <ArrowsDownUp size={16} />
        </button>
        <PlaceField
          label="Destination"
          value={form.dest}
          err={errD}
          items={acItems("dest")}
          onChange={(v) => {
            setField("dest", v);
            setActive("dest");
          }}
          onFocus={() => setActive("dest")}
          onBlur={() => {
            setActive(null);
            touch("dest");
          }}
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

function PlaceField({ label, value, err, items, onChange, onFocus, onBlur, onPick }) {
  return (
    <label className={styles.field}>
      <span className={styles.lbl}>{label}</span>
      <div className={styles.acWrap}>
        <input
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="City, ST"
          style={err ? { boxShadow: "0 0 0 1px #e0464f" } : undefined}
        />
        {items.length > 0 && (
          <ul className={styles.ac}>
            {items.map((p) => (
              <li key={p.label}>
                {/* onMouseDown so the pick fires before the input blur closes the list */}
                <button type="button" className={styles.acItem} onMouseDown={(e) => { e.preventDefault(); onPick(p.label); }}>
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
                  onMouseDown={(e) => { e.preventDefault(); onPick(p.label); }}
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
