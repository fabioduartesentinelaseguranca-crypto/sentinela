import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Frown, Meh, Smile, SmilePlus, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MOODS = [
  { value: "critical", label: "Péssimo", icon: AlertCircle, color: "text-destructive border-destructive/40 bg-destructive/10" },
  { value: "bad", label: "Ruim", icon: Frown, color: "text-orange-400 border-orange-400/40 bg-orange-400/10" },
  { value: "neutral", label: "Regular", icon: Meh, color: "text-warning border-warning/40 bg-warning/10" },
  { value: "good", label: "Bem", icon: Smile, color: "text-success border-success/40 bg-success/10" },
  { value: "great", label: "Ótimo", icon: SmilePlus, color: "text-primary border-primary/40 bg-primary/10" },
];

const TRIGGERS = [
  "Conflito com superiores", "Cena de violência", "Ameaça pessoal",
  "Morte em serviço", "Carga excessiva de trabalho", "Problemas familiares",
  "Falta de suporte da equipe", "Medo de represália",
];

function SliderField({ label, value, onChange, color }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-bold ${color}`}>{value}/10</span>
      </div>
      <input
        type="range" min={0} max={10} step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
        <span>Nenhum</span><span>Extremo</span>
      </div>
    </div>
  );
}

export default function PsychSelfEvalForm({ agentId, agentName, onSubmitted }) {
  const [stress, setStress] = useState(3);
  const [fatigue, setFatigue] = useState(3);
  const [sleep, setSleep] = useState(7);
  const [mood, setMood] = useState("neutral");
  const [triggers, setTriggers] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleTrigger = (t) =>
    setTriggers((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);

  const isCritical = stress >= 8 || fatigue >= 8 || mood === "critical" || triggers.length >= 3;

  const submit = async () => {
    setLoading(true);
    const record = await base44.entities.PsychEvaluation.create({
      agent_id: agentId,
      agent_name: agentName,
      stress_level: stress,
      fatigue_level: fatigue,
      sleep_hours: sleep,
      mood,
      panic_triggers: triggers,
      notes,
      is_critical: isCritical,
      hr_alert_sent: false,
    });

    if (isCritical) {
      // Send HR alert email
      await base44.integrations.Core.SendEmail({
        to: "rh@sentinela.gov.br",
        subject: `🚨 Alerta Psicológico — ${agentName}`,
        body: `O agente ${agentName} atingiu indicadores críticos na autoavaliação psicológica.\n\nEstresse: ${stress}/10 | Cansaço: ${fatigue}/10 | Humor: ${mood}\nGatilhos: ${triggers.join(", ") || "Nenhum"}\nRelato: ${notes || "—"}\n\nAção recomendada: contato imediato com psicólogo corporativo.`,
      }).catch(() => {});
      await base44.entities.PsychEvaluation.update(record.id, { hr_alert_sent: true });
      toast.error("Indicadores críticos detectados — Alerta enviado ao RH.");
    } else {
      toast.success("Autoavaliação registrada com sucesso.");
    }
    setLoading(false);
    onSubmitted?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">Autoavaliação Psicológica</h3>
        <span className="text-xs text-muted-foreground ml-auto">Confidencial — apenas psicólogo e RH</span>
      </div>

      {/* Mood */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Como você está hoje?</p>
        <div className="grid grid-cols-5 gap-2">
          {MOODS.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.value}
                onClick={() => setMood(m.value)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition-all ${mood === m.value ? m.color : "border-border/60 text-muted-foreground hover:border-border"}`}
              >
                <Icon className="w-5 h-5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <SliderField
          label="Nível de Estresse"
          value={stress}
          onChange={setStress}
          color={stress >= 8 ? "text-destructive" : stress >= 5 ? "text-warning" : "text-success"}
        />
        <SliderField
          label="Nível de Cansaço / Fadiga"
          value={fatigue}
          onChange={setFatigue}
          color={fatigue >= 8 ? "text-destructive" : fatigue >= 5 ? "text-warning" : "text-success"}
        />
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Horas de Sono (última noite)</span>
            <span className={`font-bold ${sleep < 5 ? "text-destructive" : "text-success"}`}>{sleep}h</span>
          </div>
          <input
            type="range" min={0} max={12} step={0.5}
            value={sleep}
            onChange={(e) => setSleep(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />
        </div>
      </div>

      {/* Triggers */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Gatilhos recentes (selecione os que se aplicam)</p>
        <div className="flex flex-wrap gap-2">
          {TRIGGERS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTrigger(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-all ${triggers.includes(t) ? "bg-destructive/15 border-destructive/40 text-destructive" : "border-border/60 text-muted-foreground hover:border-border"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <Textarea
        placeholder="Relato opcional — descreva o que estiver sentindo... (confidencial)"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Critical warning */}
      {isCritical && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Indicadores críticos identificados. O envio desta avaliação notificará automaticamente o RH e o psicólogo corporativo.</span>
        </div>
      )}

      <Button className="w-full" onClick={submit} disabled={loading}>
        {loading ? "Enviando..." : "Enviar Autoavaliação"}
      </Button>
    </div>
  );
}