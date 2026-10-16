// Configuração central dos tiles de mapa (CARTO Basemaps).
// A CARTO passou a exigir uma API key gratuita para os tiles dark_all;
// sem ela aparece a marca d'água "API KEY REQUIRED" sobre o mapa.
// Obtenha a sua em https://carto.com/basemaps/apikey e cole o valor abaixo.
export const CARTO_API_KEY = "";

export const CARTO_DARK_TILE_URL = `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`;