import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentLocation } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Users, Star, Phone, MapPin, Loader2, CheckCircle2, Shield, LifeBuoy } from "lucide-react";
import { toast } from "sonner";

function haversineKm(a, b) {
  if (!a?.lat || !b?.lat) return Infinity;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  return R * 2 * Math.asin(Math.sqrt(sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng));
}

export default function GuardianNetwork() {
  const { user } = useAuth();
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState({});
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    (async () => {
      const [glist, loc] = await Promise.all([
        base44.entities.Anjos_Guarda.filter({ status: "aprovado", disponibilidade: "disponivel" }, "-avaliacao_media", 50),
        getCurrentLocation(),
      ]);
      setUserLoc(loc);
      setGuardians(glist.map((g) => ({ ...g, distance: haversineKm(loc, g) })).sort((a, b) => a.distance - b.distance));
      setLoading(false);
    })();
  }, []);

  const requestHelp = async (guardian) => {
    setRequesting(true);
    try {
      const loc = userLoc || await getCurrentLocation();
      await base44.entities.Occurrence.create({
        type: "civil_defense",
        subtype: "Apoio Comunitário",
        description: `${user?.full_name} solicita apoio de Anjo da Guarda via Sentinela. Motivo: via pública / vulnerabilidade.`,
        lat: loc.lat, lng: loc.lng,
        reporter_id: user?.id,
        priority: "medium",
        status: "open",
        address: `Próximo a ${guardian.bairro || "localização atual"}`,
        resolution_notes: `Anjo acionado: ${guardian.user_name} — Tel: ${guardian.telefone || "não informado"}`,
      });
      setRequested((r) => ({ ...r, [guardian.id]: true }));
      toast.success(`${guardian.user_name} foi notificado e está a caminho!`, { duration: 6000 });
      // Attempt WhatsApp notification
      if (guardian.telefone) {
        const msg = encodeURIComponent(
          `🤝 ${user?.full_name} precisa de apoio via Sentinela — está próximo a você (${guardian.distance?.toFixed(1)}km). Entre em contato.`
        );
        window.open(`https://wa.me/${guardian.telefone.replace(/\D/g, "")}?text=${msg}`, "_blank");
      }
    } catch { toast.error("Erro ao solicitar apoio. Tente novamente."); }
    setRequesting(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  const nearby = guardians.filter((g) => g.distance < 5).slice(0, 6);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-success" /> Anjos da Guarda
        </h3>
        {nearby.length > 0 && (
          <span className="text-[11px] text-success bg-success/10 px-2 py-0.5 rounded-full font-medium">
            {nearby.length} próximo{nearby.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Voluntários certificados do seu bairro prontos para apoiar em situações de baixa complexidade.
      </p>

      {nearby.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs text-muted-foreground">Nenhum Anjo da Guarda disponível no seu bairro no momento.</p>
          <p className="text-[10px] text-muted-foreground mt-1">Peça para vizinhos se cadastrarem como voluntários!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {nearby.map((g) => (
            <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-success" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.user_name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" /> {g.distance?.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 text-warning" /> {g.avaliacao_media?.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {g.telefone && (
                  <a href={`tel:${g.telefone}`} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  </a>
                )}
                {requested[g.id] ? (
                  <span className="text-[10px] text-success flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Acionado
                  </span>
                ) : (
                  <Button size="sm" variant="outline" disabled={requesting} onClick={() => requestHelp(g)}
                    className="h-7 text-[11px] px-2 border-success/40 text-success hover:bg-success/10">
                    <LifeBuoy className="w-3 h-3 mr-1" /> Pedir Apoio
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}