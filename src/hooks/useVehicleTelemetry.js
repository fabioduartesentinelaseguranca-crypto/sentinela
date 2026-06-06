import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { nowISO } from "@/lib/deviceTime";

const INTERVAL_MS = 15_000; // 15s

/**
 * Pushes GPS location to Vehicle entity (assigned_lat/lng) and User (last_location)
 * so the LiveMap can display real-time unit positions.
 */
export function useVehicleTelemetry({ vehicleId, agentId, enabled = true }) {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!enabled || !agentId) return;

    const push = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const ts = nowISO();

          // Update agent location (shown on LiveMap already)
          base44.auth.updateMe({
            last_location: { lat, lng, updated_at: ts },
          }).catch(() => {});

          // Update vehicle location if assigned
          if (vehicleId) {
            base44.entities.Vehicle.update(vehicleId, {
              last_lat: lat,
              last_lng: lng,
              last_seen_at: ts,
            }).catch(() => {});
          }
        },
        () => {}
      );
    };

    push();
    intervalRef.current = setInterval(push, INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [vehicleId, agentId, enabled]);
}