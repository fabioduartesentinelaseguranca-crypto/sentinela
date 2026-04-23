import { useState } from "react";
import { useGeofenceAlerts } from "@/hooks/useGeofenceAlerts";
import { MapPin, X, AlertTriangle } from "lucide-react";

export default function GeofenceAlertBanner() {
  const [alerts, setAlerts] = useState([]);

  useGeofenceAlerts({
    enabled: true,
    onAlert: (info) => {
      setAlerts((prev) => {
        // Avoid duplicate alert for same agent
        const exists = prev.find((a) => a.agentId === info.agentId);
        if (exists) return prev.map((a) => a.agentId === info.agentId ? info : a);
        return [...prev, info];
      });
    },
  });

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((info) => (
        <div
          key={info.agentId}
          className="flex items-center gap-3 p-3 rounded-xl border border-warning/50 bg-warning/5 text-sm animate-fade-in"
        >
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          <MapPin className="w-3.5 h-3.5 text-warning flex-shrink-0" />
          <span className="text-warning font-medium flex-1">
            Cerca virtual: <strong>{info.agentName}</strong> está {info.distanceM}m fora da zona <strong>"{info.zone}"</strong>
          </span>
          <button
            onClick={() => setAlerts((prev) => prev.filter((a) => a.agentId !== info.agentId))}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}