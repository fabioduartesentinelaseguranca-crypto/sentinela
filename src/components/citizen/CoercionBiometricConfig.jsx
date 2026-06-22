import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ShieldAlert, Key, Fingerprint, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function CoercionBiometricConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [showDisarm, setShowDisarm] = useState(false);

  const [form, setForm] = useState({
    coacao_pin: "",
    disarm_pin: "",
    coacao_ativada: true,
  });

  useEffect(() => {
    (async () => {
      const list = await base44.entities.Configuracoes_Biometria_Coacao.filter({ user_id: user?.id });
      const cfg = list?.[0];
      setConfig(cfg || null);
      if (cfg) {
        setForm({
          coacao_pin: cfg.coacao_pin || "",
          disarm_pin: cfg.disarm_pin || "",
          coacao_ativada: cfg.coacao_ativada !== false,
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const save = async () => {
    if (!form.coacao_pin || !form.disarm_pin) {
      toast.error("Preencha ambos os PINs.");
      return;
    }
    if (form.coacao_pin === form.disarm_pin) {
      toast.error("O PIN de coação não pode ser igual ao PIN de desarme.");
      return;
    }
    setSaving(true);
    try {
      if (config) {
        await base44.entities.Configuracoes_Biometria_Coacao.update(config.id, {
          coacao_pin: form.coacao_pin,
          disarm_pin: form.disarm_pin,
          coacao_ativada: form.coacao_ativada,
        });
      } else {
        await base44.entities.Configuracoes_Biometria_Coacao.create({
          user_id: user.id,
          user_name: user.full_name,
          coacao_pin: form.coacao_pin,
          disarm_pin: form.disarm_pin,
          coacao_ativada: form.coacao_ativada,
          metodo_coacao: "pin",
        });
      }
      toast.success("Configuração de coação salva!");
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
          <ShieldAlert className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Senha de Coação</h3>
          <p className="text-[11px] text-muted-foreground">Configure códigos secretos para situações de emergência</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium flex items-center gap-1 mb-1">
            <Key className="w-3 h-3 text-success" /> PIN de Desarme Normal
          </label>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Digitado na calculadora disfarçada, desarma o alarme silenciosamente.
          </p>
          <div className="relative">
            <Input
              type={showDisarm ? "text" : "password"}
              value={form.disarm_pin}
              onChange={(e) => setForm({ ...form, disarm_pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
              placeholder="Ex: 1234"
              maxLength={8}
              className="pr-10 font-mono text-sm"
            />
            <button onClick={() => setShowDisarm(!showDisarm)} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {showDisarm ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium flex items-center gap-1 mb-1">
            <Fingerprint className="w-3 h-3 text-destructive" /> PIN de Coação (Dedo Invertido)
          </label>
          <p className="text-[10px] text-muted-foreground mb-1.5">
            Se digitado sob ameaça, <strong>finge desarmar</strong> mas dispara alerta vermelho silencioso para a polícia.
          </p>
          <div className="relative">
            <Input
              type={showPin ? "text" : "password"}
              value={form.coacao_pin}
              onChange={(e) => setForm({ ...form, coacao_pin: e.target.value.replace(/\D/g, "").slice(0, 8) })}
              placeholder="Ex: 4321"
              maxLength={8}
              className="pr-10 font-mono text-sm border-destructive/40"
            />
            <button onClick={() => setShowPin(!showPin)} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {showPin ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <span className="text-xs font-medium">Coação Ativada</span>
            <p className="text-[10px] text-muted-foreground">Habilitar senha de coação na calculadora disfarçada</p>
          </div>
          <Switch checked={form.coacao_ativada} onCheckedChange={(v) => setForm({ ...form, coacao_ativada: v })} />
        </div>
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="w-full">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
        Salvar Configuração
      </Button>
    </div>
  );
}