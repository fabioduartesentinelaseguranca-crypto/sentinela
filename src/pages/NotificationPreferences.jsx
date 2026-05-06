import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { Bell, BellOff, Volume2, VolumeX, MapPin, Save, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const OCCURRENCE_TYPES = [
  { key: "panic", label: "🚨 Pânico / Emergência", description: "Alertas de botão de pânico acionado" },
  { key: "crime", label: "⚔️ Crime", description: "Furto, roubo, assalto, homicídio" },
  { key: "accident", label: "🚗 Acidente", description: "Acidentes de trânsito, colisões" },
  { key: "fire", label: "🔥 Incêndio", description: "Incêndio residencial, vegetal ou veicular" },
  { key: "medical", label: "🏥 Emergência Médica", description: "Parada cardíaca, desmaio, trauma" },
  { key: "violence", label: "👊 Violência Doméstica", description: "Agressão, ameaça, violência familiar" },
  { key: "civil_defense", label: "🌊 Defesa Civil", description: "Enchente, deslizamento, desastre natural" },
  { key: "drug", label: "💊 Tráfico", description: "Comércio e uso de entorpecentes" },
  { key: "other", label: "📋 Outras", description: "Demais categorias de ocorrência" },
];

const DEFAULT_PREFS = {
  enabled: true,
  sound_enabled: true,
  visual_enabled: true,
  proximity_radius_km: 5,
  types: {
    panic: true, crime: true, accident: true, fire: true,
    medical: true, violence: true, civil_defense: false,
    drug: false, other: false,
  },
};

const STORAGE_KEY = "sentinela_notification_prefs";

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; } catch { return DEFAULT_PREFS; }
}

export default function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(loadPrefs);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [browserPermission, setBrowserPermission] = useState("default");

  useEffect(() => {
    if ("Notification" in window) setBrowserPermission(Notification.permission);
    // Merge server-saved prefs if available
    if (user?.notification_prefs) {
      setPrefs(p => ({ ...p, ...user.notification_prefs }));
    }
  }, [user]);

  const update = (key, val) => setPrefs(p => ({ ...p, [key]: val }));
  const updateType = (type, val) => setPrefs(p => ({ ...p, types: { ...p.types, [type]: val } }));

  const requestBrowserPermission = async () => {
    if (!("Notification" in window)) return toast.error("Seu navegador não suporta notificações");
    const result = await Notification.requestPermission();
    setBrowserPermission(result);
    if (result === "granted") toast.success("Notificações do navegador ativadas!");
    else toast.error("Permissão negada pelo navegador");
  };

  const handleSave = async () => {
    setSaving(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    try {
      await base44.auth.updateMe({ notification_prefs: prefs });
    } catch { /* non-critical */ }
    setSaving(false);
    setSaved(true);
    toast.success("Preferências salvas com sucesso!");
    setTimeout(() => setSaved(false), 3000);
  };

  const allSelected = Object.values(prefs.types).every(Boolean);
  const toggleAll = () => {
    const val = !allSelected;
    setPrefs(p => ({ ...p, types: Object.fromEntries(OCCURRENCE_TYPES.map(t => [t.key, val])) }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" /> Preferências de Notificação
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure quais alertas você deseja receber e como eles devem aparecer.
        </p>
      </div>

      {/* Browser permission banner */}
      {browserPermission !== "granted" && (
        <div className="flex items-center justify-between p-4 rounded-xl border border-warning/40 bg-warning/5">
          <div>
            <p className="text-sm font-medium text-warning">Notificações do navegador desativadas</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {browserPermission === "denied"
                ? "Você bloqueou as notificações. Habilite manualmente nas configurações do navegador."
                : "Ative para receber alertas mesmo com o sistema minimizado."}
            </p>
          </div>
          {browserPermission !== "denied" && (
            <Button size="sm" onClick={requestBrowserPermission}>Ativar</Button>
          )}
        </div>
      )}

      {/* Master switches */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Configurações Gerais</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {prefs.enabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
            <div>
              <Label className="font-medium">Notificações ativas</Label>
              <p className="text-xs text-muted-foreground">Liga/desliga todos os alertas do sistema</p>
            </div>
          </div>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => update("enabled", v)} />
        </div>

        <div className={`space-y-4 transition-opacity ${prefs.enabled ? "" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {prefs.sound_enabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-muted-foreground" />}
              <div>
                <Label className="font-medium">Alertas sonoros</Label>
                <p className="text-xs text-muted-foreground">Som ao receber notificações críticas</p>
              </div>
            </div>
            <Switch checked={prefs.sound_enabled} onCheckedChange={(v) => update("sound_enabled", v)} />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-purple-400" />
              <div>
                <Label className="font-medium">Alertas visuais (banner)</Label>
                <p className="text-xs text-muted-foreground">Exibir banner de notificação na tela</p>
              </div>
            </div>
            <Switch checked={prefs.visual_enabled} onCheckedChange={(v) => update("visual_enabled", v)} />
          </div>
        </div>
      </div>

      {/* Proximity radius */}
      <div className={`rounded-2xl border border-border/60 bg-card p-5 space-y-4 transition-opacity ${prefs.enabled ? "" : "opacity-40 pointer-events-none"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-400" />
            <h2 className="font-semibold">Raio de Proximidade</h2>
          </div>
          <span className="text-lg font-bold text-primary">{prefs.proximity_radius_km} km</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Receba alertas apenas de ocorrências dentro deste raio da sua localização atual.
        </p>
        <Slider
          min={1} max={50} step={1}
          value={[prefs.proximity_radius_km]}
          onValueChange={([v]) => update("proximity_radius_km", v)}
          className="mt-2"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>1 km (bairro)</span>
          <span>10 km (cidade)</span>
          <span>50 km (região)</span>
        </div>
      </div>

      {/* Types */}
      <div className={`rounded-2xl border border-border/60 bg-card p-5 space-y-3 transition-opacity ${prefs.enabled ? "" : "opacity-40 pointer-events-none"}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Tipos de Ocorrência</h2>
          <button onClick={toggleAll} className="text-xs text-primary hover:underline">
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Selecione quais categorias devem gerar notificações.</p>

        <div className="space-y-2 pt-1">
          {OCCURRENCE_TYPES.map((t) => (
            <div key={t.key} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${prefs.types[t.key] ? "border-primary/30 bg-primary/5" : "border-border/40"}`}>
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
              <Switch checked={!!prefs.types[t.key]} onCheckedChange={(v) => updateType(t.key, v)} />
            </div>
          ))}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar Preferências"}
      </Button>
    </div>
  );
}