import { useEffect, useState } from "react";
import { Polyline, CircleMarker, Tooltip } from "react-leaflet";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

/**
 * Renders the breadcrumb trail of a shift on the LiveMap.
 * Fetches the ShiftBreadcrumb record for the given shiftId.
 */
export default function BreadcrumbMapLayer({ shiftId, color = "#38bdf8" }) {
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (!shiftId) return;
    base44.entities.ShiftBreadcrumb.filter({ shift_id: shiftId }).then((records) => {
      if (records[0]?.points?.length) setPoints(records[0].points);
    });
  }, [shiftId]);

  if (points.length < 2) return null;

  const positions = points.map((p) => [p.lat, p.lng]);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <>
      <Polyline positions={positions} pathOptions={{ color, weight: 3, opacity: 0.75, dashArray: "6 4" }} />
      <CircleMarker center={[first.lat, first.lng]} radius={5} pathOptions={{ color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 }}>
        <Tooltip permanent={false}>Início do turno · {format(new Date(first.ts), "HH:mm")}</Tooltip>
      </CircleMarker>
      <CircleMarker center={[last.lat, last.lng]} radius={6} pathOptions={{ color, fillColor: color, fillOpacity: 1 }}>
        <Tooltip permanent={false}>Posição atual · {format(new Date(last.ts), "HH:mm")}</Tooltip>
      </CircleMarker>
    </>
  );
}