import { Camera, Video, VideoOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Haversine distance in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findNearbyCameras(cameras, lat, lng, radiusMeters = 200) {
  if (!lat || !lng) return [];
  return cameras
    .filter((c) => c.active && c.lat && c.lng)
    .map((c) => ({ ...c, distance: Math.round(distanceMeters(lat, lng, c.lat, c.lng)) }))
    .filter((c) => c.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance);
}

const TYPE_LABEL = { fixed: "Fixa", dome: "Dome", ptz: "PTZ" };

export default function NearCamerasAlert({ cameras, onClose }) {
  if (!cameras?.length) return null;
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
          <Camera className="w-4 h-4" />
          {cameras.length} câmera{cameras.length > 1 ? "s" : ""} próxima{cameras.length > 1 ? "s" : ""} (≤200m)
        </h3>
        {onClose && (
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {cameras.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/60 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <Camera className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {TYPE_LABEL[c.type] || c.type} · {c.distance}m
                  {c.address ? ` · ${c.address}` : ""}
                </div>
              </div>
            </div>
            {c.stream_url ? (
              <a href={c.stream_url} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 ml-2 flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                <Video className="w-3 h-3" /> Stream
              </a>
            ) : (
              <span className="flex-shrink-0 ml-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <VideoOff className="w-3 h-3" /> Sem stream
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}