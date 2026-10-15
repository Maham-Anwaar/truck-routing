import { memo, useEffect, useRef } from "react";
import { RoadHorizon, CaretLeft } from "@phosphor-icons/react";
import TripForm from "./TripForm.jsx";
import TripSummary from "./TripSummary.jsx";
import RouteCard from "./RouteCard.jsx";
import WhyPanel from "./WhyPanel.jsx";
import Banners from "./Banners.jsx";
import CheckpointTable from "./CheckpointTable.jsx";
import Legend from "./Legend.jsx";
import styles from "./SidePanel.module.css";

// Memoised so it doesn't re-render at 60fps while the forecast plays
// (its props are stable during play — only the slider's hour changes).
function SidePanel({
  data,
  form,
  setField,
  setForm,
  phase,
  loadStep,
  submit,
  editing,
  setEditing,
  selected,
  view,
  setView,
  whyOpen,
  setWhyOpen,
  pin,
  spacing,
  onSelectRoute,
  onHoverRoute,
  onHoverCp,
  onPinCp,
  layout = "desktop",
  onCollapse,
}) {
  const showForm = editing || phase !== "results";
  const isResults = phase === "results" && !!data;
  const sel = data?.routes.find((r) => r.id === selected);
  const scrollRef = useRef(null);

  // Scroll the selected route's card into view (e.g. when selected from the map).
  useEffect(() => {
    if (view !== "cards" || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-route="${selected}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, view, isResults]);

  const rootClass = [
    styles.panel,
    layout === "phone" && styles.panelPhone,
    layout === "tablet" && styles.panelTablet,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={rootClass}>
      <header className={styles.header}>
        <div className={styles.brand}>Truck Routing</div>
        {layout === "tablet" && onCollapse && (
          <button className={styles.collapse} onClick={onCollapse} aria-label="Collapse panel">
            <CaretLeft size={16} />
          </button>
        )}
      </header>

      {showForm ? (
        <TripForm
          form={form}
          setField={setField}
          setForm={setForm}
          phase={phase}
          loadStep={loadStep}
          onSubmit={() => {
            setEditing(false);
            submit();
          }}
        />
      ) : (
        <TripSummary form={form} onEdit={() => setEditing(true)} />
      )}

      {phase === "loading" && (
        <div className={styles.scroll}>
          <div className={styles.listTitle}>Planning routes…</div>
          <div className={styles.cards}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={styles.skel} style={{ opacity: 1 - i * 0.22 }}>
                <div className={styles.skelHead} />
                <div className={styles.skelBar} />
                <div className={styles.skelRow} />
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === "noRoute" && (
        <div className={styles.banner}>
          <RoadHorizon weight="fill" size={18} />
          <div>
            <strong>No drivable route found between these places.</strong>
            <span>
              {form.origin} → {form.dest}. Check the destination, or pick a place reachable by road.
            </span>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className={styles.banner}>
          <RoadHorizon weight="fill" size={18} />
          <div>
            <strong>Couldn’t plan this trip.</strong>
            <span>The routing service didn’t respond. Check the backend is running, then try again.</span>
          </div>
        </div>
      )}

      {isResults && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.listTitle}>
              {data.routes.length} route{data.routes.length > 1 ? "s" : ""}, safest first
            </div>
            <div className={styles.tabs}>
              <button
                className={view === "cards" ? styles.tabOn : styles.tab}
                onClick={() => setView("cards")}
              >
                Routes
              </button>
              <button
                className={view === "table" ? styles.tabOn : styles.tab}
                onClick={() => setView("table")}
              >
                Checkpoints
              </button>
            </div>
          </div>

          {view === "cards" ? (
            <div className={styles.scroll} ref={scrollRef}>
              <Banners data={data} />
              <div className={styles.cards}>
                <WhyPanel data={data} open={whyOpen} onToggle={() => setWhyOpen((v) => !v)} />
                {data.ranked.map((r) => (
                  <RouteCard
                    key={r.id}
                    route={r}
                    data={data}
                    selected={r.id === selected}
                    recommended={r.id === data.recId}
                    onSelect={() => onSelectRoute(r.id)}
                    onHover={onHoverRoute}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.scroll}>
              <CheckpointTable
                route={sel}
                data={data}
                spacing={spacing}
                pin={pin}
                onHoverCp={onHoverCp}
                onPinCp={onPinCp}
              />
            </div>
          )}
        </>
      )}

      {!isResults && <div className={styles.spacer} />}

      <div className={styles.footer}>
        <Legend />
      </div>
    </aside>
  );
}

export default memo(SidePanel);
