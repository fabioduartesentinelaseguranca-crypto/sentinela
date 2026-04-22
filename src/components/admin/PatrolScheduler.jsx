import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Plus, Trash2, Navigation, UserCheck } from "lucide-react";
import { distanceKm } from "@/lib/geo";
import { toast } from "sonner";

const SHIFT_LABELS = {
  morning: "🌅 Manhã (06h–14h)",
  afternoon: "🌇 Tarde (14h–22h)",
  night: "🌙 Noite (22h–06h)",
  "24h": "⏰ 24 horas",
};

function nearestAvailableAgent(agents, zone) {
  if (!zone.lat || !zone.lng) return null;
  const withLoc = agents.filter((a) => a.last_location?.lat);
  if (!withLoc.length) return null;
  return withLoc.sort((a, b) => {
    const da = distanceKm({ lat: a.last_location.lat, lng: a.last_location.lng }, zone);
    const db = distanceKm({ lat: b.last_location.lat, lng: b.last_location.lng }, zone);
    return da - db;
  })[0];
}

export default function PatrolScheduler({ agents = [] }) {
  const [zones, setZones] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", lat: "", lng: "", shift_type: "morning", assigned_agent_id: "", notes: "" });

  const load = async () => {
    const z = await base44.entities.PatrolZone.list("-created_date", 100);
    setZones(z);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.lat || !form.lng) return toast.error("Nome e coordenadas são obrigatórios");
    await base44.entities.PatrolZone.create({
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
    });
    toast.success("Zona cadastrada");
    setForm({ name: "", lat: "", lng: "", shift_type: "morning", assigned_agent_id: "", notes: "" });
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.PatrolZone.delete(id);
    load();
  };

  const suggestAgent = async (zone) => {
    const best = nearestAvailableAgent(agents, zone);
    if (!best) return toast.error("Nenhum agente com localização ativa encontrada");
    await base44.entities.PatrolZone.update(zone.id, { assigned_agent_id: best.id });
    toast.success(`${best.full_name} sugerido para ${zone.name} (mais próximo)`);
    load();
  };

  const activeAgents = agents.filter((a) => a.last_location?.lat);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" /> Zonas de Patrulhamento
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Zona
        </Button>
      </div>

      {showForm && (
        <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nome / Bairro</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Centro" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Turno</Label>
              <Select value={form.shift_type} onValueChange={(v) => setForm({ ...form, shift_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIFT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Latitude</Label>
              <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="-23.550" className="mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs">Longitude</Label>
              <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-46.633" className="mt-1 font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Agente responsável (opcional)</Label>
            <Select value={form.assigned_agent_id} onValueChange={(v) => setForm({ ...form, assigned_agent_id: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Nenhum</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} className="w-full">Salvar Zona</Button>
        </div>
      )}

      {zones.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma zona cadastrada ainda.</p>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
        {zones.map((z) => {
          const assigned = agents.find((a) => a.id === z.assigned_agent_id);
          const nearest = nearestAvailableAgent(agents, z);
          const dist = assigned && assigned.last_location
            ? distanceKm({ lat: assigned.last_location.lat, lng: assigned.last_location.lng }, z).toFixed(1)
            : null;

          return (
            <div key={z.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/20">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{z.name}</span>
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    {SHIFT_LABELS[z.shift_type]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5">
                  {z.lat?.toFixed(4)}, {z.lng?.toFixed(4)}
                </div>
                {assigned ? (
                  <div className="flex items-center gap-1 mt-1 text-xs text-success">
                    <UserCheck className="w-3 h-3" />
                    {assigned.full_name}
                    {dist && <span className="text-muted-foreground ml-1">· {dist} km</span>}
                  </div>
                ) : (
                  <div className="text-xs text-warning mt-1">⚠ Sem agente atribuído</div>
                )}
                {nearest && nearest.id !== z.assigned_agent_id && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Mais próximo disponível: <strong>{nearest.full_name}</strong>
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" title="Sugerir agente mais próximo" onClick={() => suggestAgent(z)}>
                  <Navigation className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(z.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {activeAgents.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          🟢 {activeAgents.length} agente(s) com localização ativa disponíveis para sugestão automática.
        </p>
      )}
    </div>
  );
}