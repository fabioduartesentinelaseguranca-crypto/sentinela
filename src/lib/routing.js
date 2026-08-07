const OSRM_BASE = "https://router.project-osrm.org/route/v1";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

/**
 * Busca a geometria de uma rota seguindo as ruas (OSRM).
 * @param {Object} origem - { lat, lng }
 * @param {Object} destino - { lat, lng }
 * @param {string} modo - "a_pe" | "carro"
 * @returns {Promise<{points: number[][], distanceKm: number, durationMin: number}>}
 */
export async function fetchRoute(origem, destino, modo = "a_pe") {
  const profiles = modo === "carro" ? ["driving"] : ["foot", "driving"];
  let lastErr;
  for (const profile of profiles) {
    try {
      const url = `${OSRM_BASE}/${profile}/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) throw new Error("Sem rota");
      const coords = data.routes[0].geometry.coordinates; // [lng, lat]
      return {
        points: coords.map(([lng, lat]) => [lat, lng]), // Leaflet: [lat, lng]
        distanceKm: (data.routes[0].distance || 0) / 1000,
        durationMin: Math.round((data.routes[0].duration || 0) / 60),
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Falha ao calcular rota");
}

/**
 * Geocoding reverso: coordenadas -> endereço completo (Nominatim).
 */
export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) throw new Error("Falha no geocoding reverso");
  const data = await res.json();
  return data.display_name || "";
}

/**
 * Geocoding direto: texto do endereço -> coordenadas (Nominatim).
 */
export async function geocodeAddress(query) {
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br&addressdetails=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!res.ok) throw new Error("Falha no geocoding");
  const data = await res.json();
  if (!data || data.length === 0) throw new Error("Endereço não encontrado");
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}