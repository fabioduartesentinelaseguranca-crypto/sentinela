import { useState } from "react";
import { Search, X, MapPin, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { distanceKm } from "@/lib/geo";

const RADIUS_OPTIONS = [
  { value: "0.5", label: "500m" },
  { value: "1", label: "1 km" },
  { value: "2", label: "2 km" },
  { value: "5", label: "5 km" },
  { value: "10", label: "10 km" },
];

/**
 * MapSearchBar: filtra ocorrências e câmeras por raio ou setor de patrulha.
 * Props:
 *   occurrences, cameras, patrolZones, userLocation
 *   onFilter(filteredOccs, filteredCams)
 *   onClear()
 */
export default function MapSearchBar({ occurrences = [], cameras = [], patrolZones = [], userLocation, onFilter, onClear }) {
  const [mode, setMode] = useState("radius"); // "radius" | "zone"
  const [radius, setRadius] = useState("2");
  const [selectedZone, setSelectedZone] = useState("");
  const [keyword, setKeyword] = useState("");
  const [active, setActive] = useState(false);

  const applyFilter = () => {
    let filteredOccs = [...occurrences];
    let filteredCams = [...cameras];

    // Keyword filter
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      filteredOccs = filteredOccs.filter(
        (o) => o.subtype?.toLowerCase().includes(kw) || o.description?.toLowerCase().includes(kw) || o.address?.toLowerCase().includes(kw)
      );
      filteredCams = filteredCams.filter(
        (c) => c.name?.toLowerCase().includes(kw) || c.address?.toLowerCase().includes(kw)
      );
    }

    if (mode === "radius" && userLocation) {
      const r = parseFloat(radius);
      filteredOccs = filteredOccs.filter(
        (o) => o.lat && o.lng && distanceKm({ lat: o.lat, lng: o.lng }, userLocation) <= r
      );
      filteredCams = filteredCams.filter(
        (c) => c.lat && c.lng && distanceKm({ lat: c.lat, lng: c.lng }, userLocation) <= r
      );
    } else if (mode === "zone" && selectedZone) {
      const zone = patrolZones.find((z) => z.id === selectedZone);
      if (zone?.lat && zone?.lng) {
        const r = (zone.radius_km || 1);
        filteredOccs = filteredOccs.filter(
          (o) => o.lat && o.lng && distanceKm({ lat: o.lat, lng: o.lng }, { lat: zone.lat, lng: zone.lng }) <= r
        );
        filteredCams = filteredCams.filter(
          (c) => c.lat && c.lng && distanceKm({ lat: c.lat, lng: c.lng }, { lat: zone.lat, lng: zone.lng }) <= r
        );
      }
    }

    setActive(true);
    onFilter?.(filteredOccs, filteredCams);
  };

  const clear = () => {
    setActive(false);
    setKeyword("");
    onClear?.();
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px] relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Buscar ocorrência ou câmera..."
            className="pl-8 h-8 text-sm"
            onKeyDown={(e) => e.key === "Enter" && applyFilter()}
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
          <button
            onClick={() => setMode("radius")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "radius" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapPin className="w-3 h-3" /> Raio
          </button>
          <button
            onClick={() => setMode("zone")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              mode === "zone" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Radio className="w-3 h-3" /> Setor
          </button>
        </div>

        {mode === "radius" ? (
          <Select value={radius} onValueChange={setRadius}>
            <SelectTrigger className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RADIUS_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Selecionar zona" />
            </SelectTrigger>
            <SelectContent>
              {patrolZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
              {patrolZones.length === 0 && (
                <SelectItem value="_none" disabled>Nenhuma zona cadastrada</SelectItem>
              )}
            </SelectContent>
          </Select>
        )}

        <Button size="sm" className="h-8 text-xs" onClick={applyFilter}>
          <Search className="w-3 h-3 mr-1" /> Filtrar
        </Button>

        {active && (
          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={clear}>
            <X className="w-3 h-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      {active && (
        <p className="text-[11px] text-primary">
          Filtro ativo {mode === "radius" ? `· raio ${radius}km` : `· zona selecionada`}
          {keyword && ` · "${keyword}"`}
        </p>
      )}
    </div>
  );
}