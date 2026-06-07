import { distanceKm } from "@/lib/geo";

/**
 * Sugere a viatura mais próxima e gera a rota mais rápida para uma ocorrência.
 * Usa a localização em tempo real dos agentes (last_location) e compara
 * via distância haversine, depois gera URL para Google Maps Directions.
 */

export function findNearestUnit({ agents = [], occurrenceLat, occurrenceLng }) {
  if (!occurrenceLat || !occurrenceLng) return null;

  const dest = { lat: occurrenceLat, lng: occurrenceLng };

  const candidates = agents
    .filter((a) => a.last_location?.lat && a.last_location?.lng)
    .map((a) => {
      const dist = distanceKm({ lat: a.last_location.lat, lng: a.last_location.lng }, dest);
      return { agent: a, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  if (candidates.length === 0) return null;

  const nearest = candidates[0];
  const origin = `${nearest.agent.last_location.lat},${nearest.agent.last_location.lng}`;
  const destination = `${occurrenceLat},${occurrenceLng}`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

  return {
    agent: nearest.agent,
    distKm: nearest.dist,
    routeUrl,
    allCandidates: candidates.slice(0, 5),
  };
}

export function buildRouteUrl(fromLat, fromLng, toLat, toLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
}