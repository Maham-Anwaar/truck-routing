import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  ImageOverlay,
  Marker,
  Tooltip,
  AttributionControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { LV, GRAY } from "../../domain/levels.js";
import { ROADS, MAP_CITIES, COS } from "../../domain/geo.js";
import CheckpointPopover from "./CheckpointPopover.jsx";
import styles from "./MapView.module.css";

// --- custom marker icons (divIcon so they inherit the theme) ---
// Inlined Phosphor (fill) icon paths — avoids pulling in react-dom/server
// just to stringify two markers. Licensed MIT (phosphoricons.com).
const ICON = (d, px) =>
  `<svg width="${px}" height="${px}" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;
const TRUCK_D =
  "M255.43,117l-14-35A15.93,15.93,0,0,0,226.58,72H192V64a8,8,0,0,0-8-8H32A16,16,0,0,0,16,72V184a16,16,0,0,0,16,16H49a32,32,0,0,0,62,0h50a32,32,0,0,0,62,0h17a16,16,0,0,0,16-16V120A8.13,8.13,0,0,0,255.43,117ZM80,208a16,16,0,1,1,16-16A16,16,0,0,1,80,208ZM32,136V72H176v64Zm160,72a16,16,0,1,1,16-16A16,16,0,0,1,192,208Zm0-96V88h34.58l9.6,24Z";
const FLAG_D =
  "M227.32,48.75A8,8,0,0,0,218.76,50c-28,24.22-51.72,12.48-79.21-1.13C111.07,34.76,78.78,18.79,42.76,50h0A8,8,0,0,0,40,56V224a8,8,0,0,0,16,0V179.77c26.79-21.16,49.87-9.75,76.45,3.41,16.4,8.11,34.06,16.85,53,16.85,13.93,0,28.54-4.75,43.82-18a8,8,0,0,0,2.76-6V56A8,8,0,0,0,227.32,48.75ZM56,160.44V109.88c16.85-11.28,32.64-11.59,48-7.34v51.74C88.87,150.47,72.87,150.71,56,160.44ZM104,50.87c9.25,2.83,18.61,7.45,28.45,12.32,11.26,5.57,23.11,11.43,35.55,14.56v51.74c15.35,4.25,31.14,3.94,48-7.35v50.11c-16.87,13.32-32.27,13.72-48,8.91V129.49c-21.62-6-42.38-21-64-26.95Z";

const originIcon = L.divIcon({
  className: "",
  html: `<span class="${styles.originPin}"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
const destIcon = L.divIcon({
  className: "",
  html: `<span class="${styles.destPin}">${ICON(FLAG_D, 15)}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});
const truckIcon = L.divIcon({
  className: "",
  html: `<span class="${styles.truck}">${ICON(TRUCK_D, 17)}</span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});
const badgeIcon = (id, on) =>
  L.divIcon({
    className: "",
    html: `<span class="${on ? styles.badgeOn : styles.badge}">${id}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

// Fit the map to the current routes whenever the dataset changes.
function FitBounds({ data }) {
  const map = useMap();
  useEffect(() => {
    if (!data) return;
    const pts = [];
    data.routes.forEach((r) => r.cps.forEach((c) => pts.push(c.ll)));
    if (pts.length) map.fitBounds(pts, { padding: [60, 60] });
  }, [data, map]);
  return null;
}

// Report the Leaflet map instance up to App (for external zoom/fit controls).
function MapRef({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap?.(map);
    return () => onMap?.(null);
  }, [map, onMap]);
  return null;
}

// Map clicks: pick the nearest city when the form is open, else clear the pin.
function MapClicks({ picking, onPickCity, onClearPin }) {
  useMapEvents({
    click(e) {
      if (picking) {
        const { lat, lng } = e.latlng;
        let best = null,
          bd = Infinity;
        MAP_CITIES.forEach((p) => {
          const dd = (p.lat - lat) ** 2 + ((p.lon - lng) * COS) ** 2;
          if (dd < bd) {
            bd = dd;
            best = p;
          }
        });
        if (best) onPickCity(best.label);
      } else {
        onClearPin();
      }
    },
  });
  return null;
}

// City dots; labels appear only once zoomed in enough to avoid clutter.
function CityMarkers() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const showLabels = zoom >= 6;
  return MAP_CITIES.map((p) => (
    <CircleMarker
      key={`city${p.label}`}
      center={[p.lat, p.lon]}
      radius={2.4}
      pathOptions={{ color: GRAY, fillColor: GRAY, fillOpacity: 1, weight: 0 }}
      interactive={false}
    >
      {showLabels && (
        <Tooltip permanent direction="right" offset={[4, 0]} className={styles.cityLabel}>
          {p.label.replace(/, [A-Z]{2}$/, "")}
        </Tooltip>
      )}
    </CircleMarker>
  ));
}

export default function MapView({
  data,
  selected,
  hour,
  heatOn,
  allCps,
  hoverRoute,
  pin,
  hoverCp,
  onSelectRoute,
  onHoverRoute,
  onPinCheckpoint,
  onHoverCheckpoint,
  onMap,
  picking,
  onPickCity,
}) {
  const sel = data?.routes.find((r) => r.id === selected);

  // Current heat frame for the scrubbed hour.
  const heatUrl = useMemo(() => {
    if (!data || !heatOn) return null;
    return data.heat.frame(hour);
  }, [data, heatOn, hour]);

  // Truck position along the selected route.
  const truck = useMemo(() => {
    if (!sel) return null;
    const mi = Math.min(hour * sel.speed, sel.total);
    return sel.at(mi);
  }, [sel, hour]);

  const checkpointRoutes = data
    ? allCps
      ? [...data.routes.filter((r) => r.id !== selected), sel].filter(Boolean)
      : [sel].filter(Boolean)
    : [];

  return (
    <MapContainer
      className={styles.map + (picking ? " wr-picking" : "")}
      center={[40, -95]}
      zoom={5}
      maxZoom={16}
      zoomControl={false}
      attributionControl={false}
    >
      <AttributionControl position="bottomright" prefix={false} />
      <MapRef onMap={onMap} />
      <MapClicks picking={picking} onPickCity={onPickCity} onClearPin={() => onPinCheckpoint(null)} />
      {/* Esri "World Dark Gray Canvas" — keyless, dark. Note {z}/{y}/{x} order. */}
      <TileLayer
        url="https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxZoom={16}
        attribution='Tiles &copy; Esri &mdash; Esri, DeLorme, HERE, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <FitBounds data={data} />

      {/* Decorative road network */}
      {ROADS.map((road, i) => (
        <Polyline
          key={`road${i}`}
          positions={road}
          pathOptions={{ color: "#3f424d", weight: 1.25, opacity: 0.9 }}
          interactive={false}
        />
      ))}

      {/* Weather-risk heat field */}
      {heatUrl && (
        <ImageOverlay url={heatUrl} bounds={data.heat.bounds} opacity={1} />
      )}

      {/* City dots with zoom-gated labels */}
      <CityMarkers />

      {/* Unselected routes */}
      {data?.routes
        .filter((r) => r.id !== selected)
        .map((r) => {
          const hv = hoverRoute === r.id;
          return (
            <Polyline
              key={`u${r.id}`}
              positions={r.latlngs}
              pathOptions={{
                color: hv ? "#e4e7f5" : "#9397ab",
                opacity: hv ? 1 : 0.6,
                weight: hv ? 4 : 3,
                lineJoin: "round",
                lineCap: "round",
              }}
              eventHandlers={{
                click: () => onSelectRoute(r.id),
                mouseover: () => onHoverRoute(r.id),
                mouseout: () => onHoverRoute(null),
              }}
            />
          );
        })}

      {/* Selected route: dark casing + risk-coloured segments */}
      {sel && (
        <>
          <Polyline
            positions={sel.latlngs}
            pathOptions={{
              color: "#161826",
              weight: hoverRoute === sel.id ? 12 : 10,
              lineJoin: "round",
              lineCap: "round",
            }}
            interactive={false}
          />
          {sel.segs.map((g, i) => (
            <Polyline
              key={`s${i}`}
              positions={g.latlngs}
              pathOptions={{
                color: g.lv >= 0 ? LV[g.lv].c : GRAY,
                weight: 6,
                lineJoin: "round",
                lineCap: "round",
              }}
              eventHandlers={{
                click: () => onSelectRoute(sel.id),
                mouseover: () => onHoverRoute(sel.id),
                mouseout: () => onHoverRoute(null),
              }}
            />
          ))}
        </>
      )}

      {/* Checkpoints */}
      {checkpointRoutes.map((r) => {
        const main = r.id === selected;
        return r.cps.map((c) => {
          const on =
            (pin && pin.rid === r.id && pin.i === c.i) ||
            (hoverCp && hoverCp.rid === r.id && hoverCp.i === c.i);
          return (
            <CircleMarker
              key={`cp${r.id}${c.i}`}
              center={c.ll}
              radius={on ? 7.5 : main ? 5 : 4}
              pathOptions={{
                color: "#f3f5fe",
                weight: on ? 2.5 : 2,
                fillColor: c.lv >= 0 ? LV[c.lv].c : GRAY,
                fillOpacity: main ? 1 : 0.75,
              }}
              eventHandlers={{
                click: () => onPinCheckpoint({ rid: r.id, i: c.i }),
                mouseover: () => onHoverCheckpoint({ rid: r.id, i: c.i }),
                mouseout: () => onHoverCheckpoint(null),
              }}
            />
          );
        });
      })}

      {/* Route badges (A/B/C) */}
      {data?.routes.map((r) => (
        <Marker
          key={`badge${r.id}`}
          position={r.badge}
          icon={badgeIcon(r.id, r.id === selected)}
          eventHandlers={{ click: () => onSelectRoute(r.id) }}
        />
      ))}

      {/* Checkpoint tooltip / pinned dialog */}
      <CheckpointPopover
        data={data}
        pin={pin}
        hover={hoverCp}
        onClose={() => onPinCheckpoint(null)}
      />

      {/* Origin / destination pins */}
      {data?.routes[0] && (
        <>
          <Marker position={data.routes[0].cps[0].ll} icon={originIcon} interactive={false} />
          <Marker
            position={data.routes[0].cps[data.routes[0].cps.length - 1].ll}
            icon={destIcon}
            interactive={false}
          />
        </>
      )}

      {/* Truck */}
      {truck && <Marker position={truck} icon={truckIcon} interactive={false} />}
    </MapContainer>
  );
}
