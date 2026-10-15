import { useCallback, useEffect, useState } from "react";
import { Plus, Minus, ArrowsOut, MapTrifold } from "@phosphor-icons/react";
import { usePlanner } from "./state/usePlanner.js";
import { useLayout } from "./state/useLayout.js";
import MapView from "./components/map/MapView.jsx";
import SidePanel from "./components/panel/SidePanel.jsx";
import ForecastSlider from "./components/forecast/ForecastSlider.jsx";
import BottomSheet from "./components/layout/BottomSheet.jsx";
import Rail from "./components/layout/Rail.jsx";
import styles from "./App.module.css";

export default function App() {
  const { form, setForm, setField, data, phase, loadStep, submit, spacing, setSpacing } = usePlanner();
  const layout = useLayout();

  // UI state (kept out of the compute pipeline).
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("cards");
  const [whyOpen, setWhyOpen] = useState(true);
  const [hour, setHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [heatOn, setHeatOn] = useState(true);
  const [allCps, setAllCps] = useState(false);
  const [hoverRoute, setHoverRoute] = useState(null);
  const [pin, setPin] = useState(null);
  const [hoverCp, setHoverCp] = useState(null);
  const [map, setMap] = useState(null);
  const [collapsed, setCollapsed] = useState(false); // tablet rail
  const [sheetH, setSheetH] = useState(260); // phone sheet height

  // Default the selection to the recommended route when the dataset changes.
  useEffect(() => {
    if (data) setSelected((s) => (data.routes.some((r) => r.id === s) ? s : data.recId));
  }, [data]);

  // Leaflet needs a nudge when the surrounding layout changes size.
  useEffect(() => {
    if (map) setTimeout(() => map.invalidateSize(), 220);
  }, [map, layout, collapsed]);

  const fitRoutes = useCallback(() => {
    if (!map || !data) return;
    const pts = [];
    data.routes.forEach((r) => r.cps.forEach((c) => pts.push(c.ll)));
    if (pts.length) map.fitBounds(pts, { padding: [60, 60] });
  }, [map, data]);

  const isPhone = layout === "phone";
  const picking = editing || phase !== "results"; // form is open -> allow map picks

  // Clicking the map while the form is open sets origin/dest (snapped to a city).
  const pickCity = useCallback(
    (label) => {
      setForm((f) => {
        const k = !f.origin ? "origin" : !f.dest || f.dest !== label ? "dest" : "origin";
        return { ...f, [k]: label };
      });
    },
    [setForm],
  );

  // Stable so the memoised SidePanel isn't re-rendered each frame during play.
  const collapsePanel = useCallback(() => setCollapsed(true), []);

  const panelProps = {
    data, form, setField, setForm, phase, loadStep, submit,
    editing, setEditing, selected, view, setView, whyOpen, setWhyOpen, pin, spacing,
    onSelectRoute: setSelected,
    onHoverRoute: setHoverRoute,
    onHoverCp: setHoverCp,
    onPinCp: setPin,
  };

  const stage = (
    <main className={styles.stage}>
      <MapView
        data={data}
        selected={selected}
        hour={Math.round(hour)}
        heatOn={heatOn}
        allCps={allCps}
        hoverRoute={hoverRoute}
        pin={pin}
        hoverCp={hoverCp}
        onSelectRoute={setSelected}
        onHoverRoute={setHoverRoute}
        onPinCheckpoint={setPin}
        onHoverCheckpoint={setHoverCp}
        onMap={setMap}
        picking={picking}
        onPickCity={pickCity}
      />

      {!data && phase !== "loading" && (
        <div className={styles.emptyHint}>
          <MapTrifold size={30} weight="light" />
          <strong>{picking ? "Click the map or fill the form to plan a trip." : "Plan a trip to see weather-aware routes."}</strong>
          <span>Routes are scored by wind, rain, and snow across a 48-hour forecast.</span>
        </div>
      )}

      <div className={styles.controls}>
        <button className={heatOn ? styles.ctlOn : styles.ctl} onClick={() => setHeatOn((v) => !v)}>
          Heatmap
        </button>
        <button className={allCps ? styles.ctlOn : styles.ctl} onClick={() => setAllCps((v) => !v)}>
          {isPhone ? "All points" : "All checkpoints"}
        </button>
        <div className={styles.spacing} role="group" aria-label="Checkpoint spacing">
          {!isPhone && <span className={styles.spacingLabel}>Every</span>}
          {[10, 25, 50].map((v) => (
            <button
              key={v}
              className={spacing === v ? styles.spacingOn : styles.spacingBtn}
              onClick={() => {
                setSpacing(v);
                setPin(null);
                setHoverCp(null);
              }}
              aria-pressed={spacing === v}
            >
              {v} mi
            </button>
          ))}
        </div>
      </div>

      {!isPhone && (
        <div className={styles.zoom}>
          <button className={styles.zoomBtn} onClick={() => map?.zoomIn()} aria-label="Zoom in">
            <Plus size={16} />
          </button>
          <button className={styles.zoomBtn} onClick={() => map?.zoomOut()} aria-label="Zoom out">
            <Minus size={16} />
          </button>
          <button className={styles.zoomBtn} onClick={fitRoutes} aria-label="Fit routes" disabled={!data}>
            <ArrowsOut size={15} />
          </button>
        </div>
      )}

      <div
        className={styles.slider}
        style={isPhone ? { bottom: sheetH + 12, left: "var(--space-3)", right: "var(--space-3)" } : undefined}
      >
        <ForecastSlider
          data={data}
          selected={selected}
          hour={hour}
          setHour={setHour}
          playing={playing}
          setPlaying={setPlaying}
        />
      </div>
    </main>
  );

  return (
    <div className={styles.app} data-layout={layout}>
      {isPhone ? (
        <>
          {stage}
          <BottomSheet onHeight={setSheetH}>
            <SidePanel {...panelProps} layout="phone" />
          </BottomSheet>
        </>
      ) : layout === "tablet" && collapsed ? (
        <>
          <Rail
            data={data}
            selected={selected}
            onSelectRoute={setSelected}
            onExpand={() => setCollapsed(false)}
          />
          {stage}
        </>
      ) : (
        <>
          <SidePanel
            {...panelProps}
            layout={layout}
            onCollapse={layout === "tablet" ? collapsePanel : undefined}
          />
          {stage}
        </>
      )}
    </div>
  );
}
