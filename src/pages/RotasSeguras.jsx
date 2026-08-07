import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Navigation, MapPin, Lightbulb, AlertTriangle, Loader2, Search, X, Car, Footprints } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import { fetchRoute } from "@/lib/routing";

const ICON_ORIGEM = L.divIcon({ html: '<div class="w-6 h-6 rounded-full bg-primary border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">A</div>', className: "", iconSize: [24, 24], iconAnchor: [12, 12] });
const ICON_DESTINO = L.divIcon({ html: '<div class="w-6 h-6 rounded-full bg-emergency border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-bold">B</div>', className: "", iconSize: [24, 24], iconAnchor: [12, 12] });

const NIVEL_CORES = {
  baixo: "text-success bg-success/10",
  moderado: "text-warning bg-warning/10",
  alto: "text-destructive bg-destructive/10",
  critico: "text-emergency bg-emergency/10",
};

function MapClickHandler({ onMapClick, mode }) {
  useMapEvents({
    click(e) { onMapClick(e.latlng); },
  });
  return null;
}

function MapBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [points, map]);
  return null;
}

export default function RotasSeguras() {
  const { user } = useAuth();
  const [origem, setOrigem] = useState(null);
  const [destino, setDestino] = useState(null);
  const [modo, setModo] = useState("a_pe");
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [addressSearch, setAddressSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [center, setCenter] = useState({ lat: -23.5505, lng: -46.6333 });
  const [routePoints, setRoutePoints] = useState([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCenter(loc);
          if (!origem) setOrigem(loc);
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  const searchAddress = async () => {
    if (!addressSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressSearch)}&limit=5&countrycodes=br`);
      const data = await res.json();
      setSearchResults(data.map((d) => ({
        label: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      })));
    } catch { toast.error("Erro ao buscar endereço"); }
    setSearching(false);
  };

  const mapClick = (latlng) => {
    if (!origem) { setOrigem(latlng); return; }
    if (!destino) { setDestino(latlng); return; }
    setOrigem(latlng); setDestino(null); setResultado(null);
  };

  const calcularRota = async () => {
    if (!origem || !destino) { toast.error("Selecione origem e destino no mapa"); return; }
    setLoading(true);
    setResultado(null);
    try {
      const res = await base44.functions.invoke("calcularRotaSegura", {
        origem_lat: origem.lat, origem_lng: origem.lng,
        destino_lat: destino.lat, destino_lng: destino.lng,
        modo,
      });
      setResultado(res.data);
    } catch { toast.error("Erro ao calcular rota segura"); }
    setLoading(false);
  };

  const clearAll = () => { setOrigem(null); setDestino(null); setResultado(null); setRoutePoints([]); };

  useEffect(() => {
    if (!origem || !destino) { setRoutePoints([]); return; }
    let cancelled = false;
    fetchRoute(origem, destino, modo)
      .then((r) => { if (!cancelled) setRoutePoints(r.points); })
      .catch(() => { if (!cancelled) setRoutePoints([]); });
    return () => { cancelled = true; };
  }, [origem, destino, modo]);

  const mapPoints = [origem, destino].filter(Boolean);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" /> Rotas Seguras
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Escolha origem e destino no mapa para calcular a rota mais segura, com análise de ocorrências e iluminação pública.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-border/60 bg-card">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar endereço..."
                  className="pl-8 h-9 text-sm"
                  value={addressSearch}
                  onChange={(e) => setAddressSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchAddress()}
                />
              </div>
              <Button size="sm" variant="outline" onClick={searchAddress} disabled={searching}>
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Buscar"}
              </Button>
            </div>

            <Select value={modo} onValueChange={setModo}>
              <SelectTrigger className="w-28 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a_pe"><Footprints className="w-3.5 h-3.5 inline mr-1" /> A pé</SelectItem>
                <SelectItem value="carro"><Car className="w-3.5 h-3.5 inline mr-1" /> Carro</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={calcularRota} disabled={loading || !origem || !destino} size="sm">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Navigation className="w-3.5 h-3.5 mr-1" />}
              Calcular Rota
            </Button>

            <Button variant="ghost" size="sm" onClick={clearAll}><X className="w-3.5 h-3.5" /></Button>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-2 max-h-40 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const pt = { lat: r.lat, lng: r.lng };
                    if (!origem || destino) { setOrigem(pt); setDestino(null); }
                    else setDestino(pt);
                    setCenter(pt);
                    setSearchResults([]);
                    setAddressSearch("");
                    setResultado(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs text-primary font-medium">
                    {!origem || destino ? "Definir como Origem" : "Definir como Destino"}
                  </span>
                  <div className="text-xs text-muted-foreground truncate">{r.label}</div>
                </button>
              ))}
            </div>
          )}

          {/* Map */}
          <div className="rounded-2xl border border-border/60 overflow-hidden" style={{ height: 400 }}>
            <MapContainer center={[center.lat, center.lng]} zoom={14} className="h-full w-full" scrollWheelZoom={true}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapClickHandler onMapClick={mapClick} />
              <MapBounds points={mapPoints} />
              {origem && <Marker position={[origem.lat, origem.lng]} icon={ICON_ORIGEM} />}
              {destino && <Marker position={[destino.lat, destino.lng]} icon={ICON_DESTINO} />}
              {origem && destino && routePoints.length > 0 && (
                <Polyline positions={routePoints} color="hsl(var(--primary))" weight={4} />
              )}
              {origem && destino && routePoints.length === 0 && (
                <Polyline positions={[[origem.lat, origem.lng], [destino.lat, destino.lng]]} color="hsl(var(--primary))" weight={3} dashArray="8 4" opacity={0.5} />
              )}
            </MapContainer>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {!origem ? "Clique no mapa para definir a origem" : !destino ? "Clique no mapa para definir o destino" : "Clique em Calcular Rota para analisar a segurança do trajeto"}
          </p>
        </div>

        {/* Results panel */}
        <div className="space-y-4">
          {loading && (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-sm font-medium">Analisando rota...</p>
              <p className="text-xs text-muted-foreground mt-1">Cruzando dados de ocorrências e iluminação pública</p>
            </div>
          )}

          {resultado && (
            <div className="space-y-4 animate-fade-in">
              {/* Score */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 text-center">
                <div className="text-4xl font-bold text-primary">{resultado.score_seguranca}</div>
                <div className="text-sm text-muted-foreground">Score de Segurança /100</div>
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${resultado.score_seguranca}%`,
                      background: resultado.score_seguranca >= 70 ? "hsl(var(--success))" : resultado.score_seguranca >= 40 ? "hsl(var(--warning))" : "hsl(var(--emergency))",
                    }}
                  />
                </div>
              </div>

              {/* Análise IA */}
              {resultado.analise_ia && (
                <div className="rounded-2xl border border-border/60 bg-card p-4">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold ${NIVEL_CORES[resultado.analise_ia.nivel_risco] || NIVEL_CORES.moderado}`}>
                    Risco {resultado.analise_ia.nivel_risco}
                  </span>
                  <p className="text-sm mt-2">{resultado.analise_ia.resumo}</p>
                  {resultado.analise_ia.recomendacoes?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {resultado.analise_ia.recomendacoes.map((r, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                          <Shield className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                  {resultado.analise_ia.rota_alternativa_sugerida && (
                    <p className="text-xs text-warning mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Considere uma rota alternativa — esta via apresenta riscos acima da média.
                    </p>
                  )}
                  {resultado.analise_ia.horario_recomendado && (
                    <p className="text-xs text-muted-foreground mt-1">🕐 Horário mais seguro: {resultado.analise_ia.horario_recomendado}</p>
                  )}
                </div>
              )}

              {/* Iluminação */}
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-warning" /> Iluminação Pública
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="font-bold text-success">{resultado.iluminacao?.funcionando || 0}</div>
                    <div className="text-muted-foreground">Funcionando</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="font-bold text-destructive">{resultado.iluminacao?.com_defeito || 0}</div>
                    <div className="text-muted-foreground">Com Defeito</div>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <div className="font-bold text-primary">{resultado.iluminacao?.taxa || 0}%</div>
                    <div className="text-muted-foreground">Taxa</div>
                  </div>
                </div>
              </div>

              {/* Ocorrências */}
              <div className="rounded-2xl border border-border/60 bg-card p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" /> Ocorrências no Corredor
                </h4>
                <div className="text-xs text-muted-foreground mb-2">
                  {resultado.total_ocorrencias_corredor} ocorrência(s) nos últimos 90 dias
                </div>
                {resultado.ocorrencias_por_tipo && Object.entries(resultado.ocorrencias_por_tipo).map(([tipo, count]) => (
                  <div key={tipo} className="flex justify-between text-xs py-1 border-b border-border/30 last:border-0">
                    <span className="capitalize">{tipo}</span>
                    <span className="font-mono">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && !resultado && origem && destino && (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center">
              <Navigation className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Pronto para analisar</p>
              <p className="text-xs text-muted-foreground mt-1">Clique em "Calcular Rota" para ver o score de segurança</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}