import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Brain, AlertTriangle, CheckCircle2, Clock, User, FileText, TrendingUp, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { toast } from "sonner";

const MOOD_LABEL = { great: "Ótimo", good: "Bom", neutral: "Neutro", bad: "Ruim", critical: "Crítico" };
const MOOD_COLOR = { great: "text-success", good: "text-primary", neutral: "text-muted-foreground", bad: "text-warning", critical: "text-destructive" };

export default function PsychologistDashboard() {
  const { user } = useAuth();
  const [evals, setEvals] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [ev, ag] = await Promise.all([
      base44.entities.PsychEvaluation.list("-created_date", 200),
      base44.entities.User.filter({ role: "agent" }),
    ]);
    setEvals(ev);
    setAgents(ag);
  };

  useEffect(() => { load(); }, []);

  const criticals = evals.filter((e) => e.is_critical && !e.reviewed_by);
  const reviewed = evals.filter((e) => e.reviewed_by);
  const pending = evals.filter((e) => !e.reviewed_by);

  const markReviewed = async (ev) => {
    setLoading(true);
    await base44.entities.PsychEvaluation.update(ev.id, {
      reviewed_by: user?.id,
      notes: notes || ev.notes,
    });
    toast.success("Avaliação marcada como revisada");
    setSelected(null);
    setNotes("");
    setLoading(false);
    load();
  };

  // Chart: stress trend per agent (last 10)
  const stressTrend = evals.slice(0, 10).reverse().map((e, i) => ({
    i: i + 1,
    stress: e.stress_level,
    fatigue: e.fatigue_level,
    name: e.agent_name?.split(" ")[0] || "—",
  }));

  // Mood distribution
  const moodDist = Object.entries(
    evals.reduce((acc, e) => { acc[e.mood] = (acc[e.mood] || 0) + 1; return acc; }, {})
  ).map(([mood, count]) => ({ mood: MOOD_LABEL[mood] || mood, count }));

  const display = activeTab === "critical" ? criticals : activeTab === "reviewed" ? reviewed : pending;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" /> Painel do Psicólogo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Monitoramento de saúde mental e bem-estar dos agentes.</p>
        </div>
        <div className="flex gap-2 items-center">
          {criticals.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-destructive bg-destructive/10 border border-destructive/30 px-3 py-1.5 rounded-xl font-medium">
              <AlertTriangle className="w-4 h-4" /> {criticals.length} caso{criticals.length > 1 ? "s" : ""} crítico{criticals.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avaliações totais", value: evals.length, icon: FileText, color: "text-primary" },
          { label: "Casos críticos", value: criticals.length, icon: AlertTriangle, color: "text-destructive" },
          { label: "Pendentes revisão", value: pending.length, icon: Clock, color: "text-warning" },
          { label: "Revisados", value: reviewed.length, icon: CheckCircle2, color: "text-success" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Tendência de Stress/Fadiga</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={stressTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="i" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="stress" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} name="Stress" />
              <Line type="monotone" dataKey="fatigue" stroke="hsl(var(--warning))" strokeWidth={2} dot={false} name="Fadiga" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Distribuição de Humor</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={moodDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mood" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Avaliações" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tab list */}
      <div className="flex gap-1 border-b border-border/60 pb-1">
        {[
          { id: "pending", label: `Pendentes (${pending.length})` },
          { id: "critical", label: `Críticos (${criticals.length})` },
          { id: "reviewed", label: `Revisados (${reviewed.length})` },
        ].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${activeTab === t.id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Eval list */}
      <div className="space-y-3">
        {display.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-2xl">
            Nenhuma avaliação neste filtro.
          </div>
        )}
        {display.map((ev) => (
          <div key={ev.id} className={`rounded-2xl border p-4 bg-card cursor-pointer hover:border-primary/40 transition-colors ${ev.is_critical ? "border-destructive/40" : "border-border/60"}`}
            onClick={() => { setSelected(ev); setNotes(ev.notes || ""); }}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="font-medium text-sm">{ev.agent_name || "Agente"}</div>
                  <div className="text-xs text-muted-foreground">{ev.created_date ? format(new Date(ev.created_date), "dd/MM/yyyy HH:mm") : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium ${MOOD_COLOR[ev.mood]}`}>{MOOD_LABEL[ev.mood]}</span>
                <span className="text-xs text-muted-foreground">Stress: <strong className="text-foreground">{ev.stress_level}/10</strong></span>
                <span className="text-xs text-muted-foreground">Fadiga: <strong className="text-foreground">{ev.fatigue_level}/10</strong></span>
                {ev.is_critical && <span className="text-[10px] bg-destructive text-white px-2 py-0.5 rounded-full font-semibold">CRÍTICO</span>}
                {ev.reviewed_by && <span className="text-[10px] bg-success/20 text-success px-2 py-0.5 rounded-full font-semibold">Revisado</span>}
              </div>
            </div>
            {ev.panic_triggers?.length > 0 && (
              <div className="mt-2 flex gap-1 flex-wrap">
                {ev.panic_triggers.map((t) => (
                  <span key={t} className="text-[10px] bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{selected.agent_name}</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Stress</span><div className="text-2xl font-bold text-destructive">{selected.stress_level}/10</div></div>
              <div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Fadiga</span><div className="text-2xl font-bold text-warning">{selected.fatigue_level}/10</div></div>
              <div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Humor</span><div className={`font-bold ${MOOD_COLOR[selected.mood]}`}>{MOOD_LABEL[selected.mood]}</div></div>
              <div className="rounded-xl bg-muted/40 p-3"><span className="text-muted-foreground">Sono</span><div className="font-bold">{selected.sleep_hours ?? "—"}h</div></div>
            </div>
            {selected.notes && <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-3">{selected.notes}</p>}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Notas do psicólogo</label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anotações clínicas..." />
            </div>
            {!selected.reviewed_by && (
              <Button className="w-full" onClick={() => markReviewed(selected)} disabled={loading}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Revisado
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}