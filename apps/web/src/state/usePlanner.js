import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPlan, fetchWeatherField } from "../services/api.js";
import { adaptPlan } from "../domain/adapt.js";
import { heatRegion, buildHeatImage } from "../domain/heat.js";
import { toLocalStr } from "../domain/format.js";
import { isValidTrip } from "../domain/validation.js";

// Departure defined in UTC (backend convention), shown in the viewer's tz.
const DEP_DEFAULT = toLocalStr(Date.UTC(2026, 9, 15, 6, 0)); // Oct 15 06:00 UTC

export const DEFAULT_TRIP = {
  origin: "Dallas, TX",
  dest: "Minneapolis, MN",
  dep: DEP_DEFAULT,
  load: "42,000",
};

// Plans trips by calling POST /routes/plan and adapting the response.
// No synthetic routing/ranking runs in the frontend anymore.
export function usePlanner(initialSpacing = 25) {
  const [form, setForm] = useState(DEFAULT_TRIP);
  const [committed, setCommitted] = useState(DEFAULT_TRIP);
  const [phase, setPhase] = useState("loading"); // empty | loading | noRoute | error | results
  const [data, setData] = useState(null);
  const [loadStep, setLoadStep] = useState(0);
  const [spacing, setSpacing] = useState(initialSpacing);

  const reqId = useRef(0);
  const timers = useRef([]);
  const spacingRef = useRef(spacing);
  spacingRef.current = spacing;
  const committedRef = useRef(committed);
  committedRef.current = committed;

  const setField = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

  // Fire a plan request for `trip`; ignores stale responses.
  const runPlan = useCallback((trip) => {
    const id = ++reqId.current;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("loading");
    setLoadStep(0);
    setData(null);
    timers.current.push(setTimeout(() => setLoadStep(1), 500));
    fetchPlan(trip, spacingRef.current)
      .then(async (dto) => {
        if (id !== reqId.current) return;
        const planned = adaptPlan(dto);
        // Heatmap: fetch the risk grid for the route region, then colour it.
        const region = heatRegion(planned.routes);
        try {
          const grid = await fetchWeatherField(region.bbox, dto.departureUtc, dto.loadLb, region.resolutionDeg);
          planned.heat = buildHeatImage(grid, region.samples);
        } catch {
          /* heatmap is optional — routes still render without it */
        }
        if (id !== reqId.current) return;
        setCommitted(trip);
        setData(planned);
        setPhase("results");
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setData(null);
        setPhase(err && err.noRoute ? "noRoute" : "error");
      });
  }, []);

  // Plan the default trip on mount, and re-plan the committed trip when spacing changes.
  useEffect(() => {
    runPlan(committedRef.current);
  }, [spacing, runPlan]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const submit = useCallback(() => {
    if (!isValidTrip(form)) return;
    runPlan(form);
  }, [form, runPlan]);

  return { form, setForm, setField, committed, data, phase, loadStep, submit, spacing, setSpacing };
}
