const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

const MODIFIER_PT = {
  left: "à esquerda",
  right: "à direita",
  "sharp left": "totalmente à esquerda",
  "sharp right": "totalmente à direita",
  "slight left": "levemente à esquerda",
  "slight right": "levemente à direita",
  straight: "em frente",
  uturn: "retorno",
};

export function maneuverToText(step) {
  const { type, modifier } = step.maneuver || {};
  const name = step.name || "";
  const mod = MODIFIER_PT[modifier] || "";
  switch (type) {
    case "depart": return `Inicie${name ? ` na ${name}` : ""}`;
    case "arrive": return `Chegue ao destino`;
    case "turn": return `Vire ${mod}${name ? ` na ${name}` : ""}`;
    case "continue": return `Continue ${mod}${name ? ` pela ${name}` : ""}`.replace("em frente pela", "pela");
    case "merge": return `Entre ${mod}${name ? ` na ${name}` : ""}`;
    case "on ramp": return `Pegue a entrada${mod ? ` ${mod}` : ""}${name ? ` para ${name}` : ""}`;
    case "off ramp": return `Pegue a saída${mod ? ` ${mod}` : ""}${name ? ` para ${name}` : ""}`;
    case "fork": return `Na bifurcação, mantenha ${mod || "à esquerda"}`;
    case "end of road": return `No fim da via, vire ${mod}`;
    case "new name": return `Continue${name ? ` pela ${name}` : ""}`;
    case "keep": return `Mantenha ${mod}`;
    case "roundabout": return `Entre na rotatória${name ? ` (${name})` : ""}`;
    case "exit roundabout": return `Saia da rotatória`;
    case "notify": return `Continue${name ? ` pela ${name}` : ""}`;
    default: return `Continue${name ? ` na ${name}` : ""}`;
  }
}

export function formatDistance(m) {
  if (!m || m < 1) return "";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/**
 * Busca a geometria de uma rota seguindo as ruas (OSRM) + instruções trecho a trecho.
 * @returns {Promise<{points: number[][], steps: Array, distanceKm: number, durationMin: number}>}
 */
export async function fetchRoute(origem, destino, modo = "a_pe") {
  // O servidor OSRM público (router.project-osrm.org) suporta apenas o perfil
  // "driving". Usamos a geometria da rota viária para ambos os modos, mas
  // calculamos o tempo de deslocamento conforme o modo:
  //   - carro: tempo estimado pelo OSRM (trânsito típico)
  //   - a pé: estimativa a 5 km/h (caminhada)
  // Assim o percurso e o tempo diferem corretamente entre os modos.
  const profile = "driving";
  const url = `${OSRM_BASE}/${profile}/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.routes || data.routes.length === 0) throw new Error("Sem rota");
  const route = data.routes[0];
  const coords = route.geometry.coordinates; // [lng, lat]
  const steps = (route.legs?.[0]?.steps || []).map((s) => ({
    instruction: maneuverToText(s),
    distanceM: s.distance || 0,
    durationS: s.distance || 0,
    name: s.name || "",
    maneuverType: s.maneuver?.type || "",
    modifier: s.maneuver?.modifier || "",
  }));
  const distanceKm = (route.distance || 0) / 1000;
  let durationMin;
  if (modo === "carro") {
    durationMin = Math.round((route.duration || 0) / 60);
  } else {
    // a pé: estimar tempo de caminhada a 5 km/h
    durationMin = Math.max(1, Math.round((distanceKm / 5) * 60));
  }
  return {
    points: coords.map(([lng, lat]) => [lat, lng]),
    steps,
    distanceKm,
    durationMin,
  };
}

export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) throw new Error("Falha no geocoding reverso");
  const data = await res.json();
  return data.display_name || "";
}

export async function geocodeAddress(query) {
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) throw new Error("Falha no geocoding");
  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Endereço não encontrado");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}