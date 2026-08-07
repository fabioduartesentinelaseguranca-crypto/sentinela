import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Crosshair, Loader2, Check, Navigation } from "lucide-react";
import L from "leaflet";
import { reverseGeocode } from "@/lib/routing";
import { toast } from "sonner";

const PIN_ICON = L.divIcon({
  html: '<div style="width:28px;height:28px;background:hsl(0 90% 55%);border:2px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
  className: "", iconSize: [28, 28], iconAnchor: [14, 28],
});

function MapClickCapture({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng); } });
  return null;
}

// Garante que o mapa se redimensione corretamente dentro do dialog
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export default function LocationPicker({ value, onChange, label = "Localização da ocorrência" }) {
  const [mapOpen, setMapOpen] = useState(false);
  const [pending, setPending] = useState(null); // { lat, lng } marcado no mapa
  const [pendingAddress, setPendingAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -15.7801, lng: -47.9292 });

  const captureGps = () => {
    if (!navigator.geolocation) { toast.error("Geolocalização não disponível"); return; }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      try {
        const addr = await reverseGeocode(lat, lng);
        onChange({ lat, lng, address: addr });
        toast.success("Localização capturada e endereço preenchido");
      } catch {
        onChange({ lat, lng, address: value.address || "" });
        toast.success("Coordenadas capturadas");
      }
      setCapturingGps(false);
    }, () => { toast.error("Não foi possível obter sua localização"); setCapturingGps(false); }, { enableHighAccuracy: true, timeout: 10000 });
  };

  const openMap = () => {
    if (value.lat && value.lng) setMapCenter({ lat: value.lat, lng: value.lng });
    else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }), () => {}, { timeout: 5000 });
    }
    setPending(null);
    setPendingAddress("");
    setMapOpen(true);
  };

  const handlePick = async (latlng) => {
    setPending(latlng);
    setPendingAddress("");
    setGeocoding(true);
    try {
      const addr = await reverseGeocode(latlng.lat, latlng.lng);
      setPendingAddress(addr);
    } catch {
      setPendingAddress("Endereço não encontrado para esta localização");
    }
    setGeocoding(false);
  };

  const confirmLocation = () => {
    onChange({ lat: pending.lat, lng: pending.lng, address: pendingAddress });
    setMapOpen(false);
    setPending(null);
    setPendingAddress("");
    toast.success("Localização confirmada");
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Digite o endereço ou marque no mapa"
            value={value.address || ""}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
          />
        </div>
        <Button type="button" variant="outline" size="icon" onClick={openMap} title="Marcar no mapa">
          <Navigation className="w-4 h-4" />
        </Button>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={captureGps} disabled={capturingGps} className="w-full">
        {capturingGps ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 mr-1.5" />}
        Capturar minha localização (GPS)
      </Button>
      {value.lat && value.lng && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <Check className="w-3.5 h-3.5" /> Localização definida: {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}
        </div>
      )}

      <Dialog open={mapOpen} onOpenChange={setMapOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Marque a localização no mapa</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Clique no mapa onde a ocorrência ocorreu.</p>
          <div className="rounded-xl overflow-hidden border border-border/60" style={{ height: 350 }}>
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={15} className="h-full w-full" scrollWheelZoom={true}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM" />
              <MapResizer />
              <MapClickCapture onPick={handlePick} />
              {pending && <Marker position={[pending.lat, pending.lng]} icon={PIN_ICON} />}
            </MapContainer>
          </div>

          {pending && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="w-4 h-4 text-primary" /> Confirme a localização
              </div>
              {geocoding ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Buscando endereço completo...</div>
              ) : (
                <div className="text-sm text-foreground">{pendingAddress}</div>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => { setPending(null); setPendingAddress(""); }}>Escolher outra</Button>
                <Button size="sm" onClick={confirmLocation} disabled={geocoding}><Check className="w-3.5 h-3.5 mr-1" /> Confirmar localização</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}