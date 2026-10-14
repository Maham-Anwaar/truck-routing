import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NOW } from "../domain/constants.js";
import { findPlace, parseDep, loadNum, toLocalStr } from "../domain/format.js";
import { routeDefs, buildRoute, rank, MODES, RESULT_SC } from "../domain/routes.js";
import { buildHeat } from "../domain/heat.js";
import { isValidTrip } from "../domain/validation.js";

// Departure instants are defined in UTC (the "backend" convention) and shown to
// the viewer in their local timezone via toLocalStr.
const DEP_DEFAULT = toLocalStr(Date.UTC(2026, 9, 15, 6, 0)); // Oct 15 06:00 UTC
const DEP_BEYOND = toLocalStr(Date.UTC(2026, 9, 16, 2, 0)); // Oct 16 02:00 UTC
const DEP_EMPTY = toLocalStr(Date.UTC(2026, 9, 14, 15, 0)); // Oct 14 15:00 UTC

// Default demo trip (the "results" scenario).
export const DEFAULT_TRIP = {
  origin: "Dallas, TX",
  dest: "Minneapolis, MN",
  dep: DEP_DEFAULT,
  load: "42,000",
};
const EMPTY_TRIP = { origin: "", dest: "", dep: DEP_EMPTY, load: "" };

// Demo scenarios (mirrors the original Component.initFor). Each sets a starting
// trip + phase; the weather MODE is the scenario name when it's a wx scenario.
export const SCENARIOS = {
  results: { form: DEFAULT_TRIP, phase: "results" },
  empty: { form: EMPTY_TRIP, phase: "empty" },
  loading: { form: DEFAULT_TRIP, phase: "loading" },
  popover: { form: DEFAULT_TRIP, phase: "results" },
  twoRoutes: { form: DEFAULT_TRIP, phase: "results" },
  weatherMissing: { form: DEFAULT_TRIP, phase: "results" },
  beyondForecast: { form: { ...DEFAULT_TRIP, dep: DEP_BEYOND }, phase: "results" },
  allNoTravel: { form: DEFAULT_TRIP, phase: "results" },
  allLow: { form: DEFAULT_TRIP, phase: "results" },
  notFound: { form: { ...DEFAULT_TRIP, dest: "Mineapolis, MM" }, phase: "empty" },
  noRoute: { form: { ...DEFAULT_TRIP, dest: "Honolulu, HI" }, phase: "noRoute" },
};
export const SCENARIO_NAMES = Object.keys(SCENARIOS);

export function tripFromForm(f) {
  return {
    o: findPlace(f.origin),
    d: findPlace(f.dest),
    dep: parseDep(f.dep),
    load: loadNum(f.load),
  };
}

// Pure compute pipeline — mirrors the original Component.compute().
function computeData(f, wxMode, spacing) {
  const t = tripFromForm(f);
  if (!t.o || !t.d) return null;
  const mode = MODES[wxMode] || MODES.results;
  const horizon = 48 - (t.dep - NOW) / 3.6e6;
  const routes = routeDefs(t.o, t.d, mode).map((def) => buildRoute(def, spacing, t, mode, horizon));
  if (!routes.length) return null;
  const heat = buildHeat(routes, mode, t.load, horizon);
  const rk = rank(routes);
  return {
    routes, heat, horizon, dep: t.dep, ...rk,
    recId: rk.ranked[0].id,
    total: routes.reduce((a, r) => a + r.cps.length, 0),
  };
}

// start: a scenario name (e.g. "results", "empty", "weatherMissing").
export function usePlanner(start = "results", initialSpacing = 25) {
  const init = SCENARIOS[start] || SCENARIOS.results;
  const [scenario, setScenario] = useState(SCENARIOS[start] ? start : "results");
  // Checkpoint spacing in miles: weather is sampled every `spacing` mi.
  const [spacing, setSpacing] = useState(initialSpacing);
  const [form, setForm] = useState(init.form); // editable draft
  const [committed, setCommitted] = useState(init.form); // drives compute
  const [phase, setPhase] = useState(init.phase); // empty|loading|noRoute|results
  const [loadStep, setLoadStep] = useState(0);
  // The weather MODE is the scenario name when it's a wx scenario, else "results".
  const wxMode = RESULT_SC.includes(scenario) ? scenario : "results";
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const setField = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  // Jump to a demo scenario.
  const applyScenario = useCallback((name) => {
    const c = SCENARIOS[name] || SCENARIOS.results;
    setScenario(name);
    setForm(c.form);
    setCommitted(c.form);
    setPhase(c.phase);
  }, []);

  const data = useMemo(
    () => (phase === "results" ? computeData(committed, wxMode, spacing) : null),
    [committed, phase, wxMode, spacing],
  );

  // Warm forecast frames in the background so scrubbing is instant.
  const warmRef = useRef();
  useEffect(() => {
    clearTimeout(warmRef.current);
    if (!data?.heat) return;
    let h = 1;
    const warm = () => {
      if (h > 48) return;
      data.heat.frame(h++);
      warmRef.current = setTimeout(warm, 16);
    };
    warmRef.current = setTimeout(warm, 300);
    return () => clearTimeout(warmRef.current);
  }, [data]);

  // Plan the current draft: a short loading sequence, then results —
  // faithful to the original's staged submit (incl. the Honolulu no-route case).
  const submit = useCallback(() => {
    if (!isValidTrip(form)) return;
    const t = tripFromForm(form);
    clearTimers();
    setPhase("loading");
    setLoadStep(0);
    if (t.o.label === "Honolulu, HI" || t.d.label === "Honolulu, HI") {
      timers.current.push(setTimeout(() => setPhase("noRoute"), 1100));
      return;
    }
    timers.current.push(setTimeout(() => setLoadStep(1), 900));
    timers.current.push(
      setTimeout(() => {
        setCommitted(form);
        setPhase("results");
      }, 2300),
    );
  }, [form]);

  return {
    form, setForm, setField, committed, data, phase, loadStep, submit,
    scenario, applyScenario, spacing, setSpacing,
  };
}
