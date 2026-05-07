import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { BarChart2, Users, Target, Star, TrendingUp } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function PerformanceReports() {
  const [occurrences, setOccurrences] = useState([]);
  const [missions, setMissions] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [progress, setProgress] = useState([]);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    Promise.all([
      base44.entities.Occurrence.list("-created_date", 500),
      base44.entities.ShiftMission.list("-created_date", 500),
      base44.entities.CitizenFeedback.list("-created_date", 300),
      base44.entities.TrainingProgress.list("-updated_date", 300),
      base44.entities.User.filter({ role: "agent" }),
    ]).then(([occs, miss, fbs, prog, ags]) => {
      setOccurrences(occs);
      setMissions(miss);
      setFeedbacks(fbs);
      setProgress(prog);
      setAgents(ags);
    });
  }, []);

  // Ocorrências por dia (últimos 14 dias)
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(new Date(), 13 - i);
    const label = format(d, "dd/MM", { locale: ptBR });
    const start = startOfDay(d).getTime();
    const end = start + 86400000;
    const count = occurrences.filter(o => {
      const t = new Date(o.created_date).getTime();
      return t >= start && t < end;
    }).length;
    const resolved = occurrences.filter(o => {
      const t = new Date(o.created_date).getTime();
      return t >= start && t < end && o.status === "resolved";
    }).length;
    return { label, total: count, resolvidas: resolved };
  });

  // Desempenho por agente
  const agentPerf = agents.slice(0, 8).map(a => {
    const resolved = occurrences.filter(o => o.assigned_agent_id === a.id && o.status === "resolved").length;
    const rating = feedbacks.filter(f => f.agent_id === a.id);
    const avgRating = rating.length ? (rating.reduce((s, f) => s + (f.rating || 0), 0) / rating.length).toFixed(1) : 0;
    return {
      name: a.full_name?.split(" ")[0] || "Agente",
      resolvidas: resolved,
      avaliacao: +avgRating,
    };
  }).filter(a => a.resolvidas > 0 || a.avaliacao > 0);

  // Taxa de conclusão de missões
  const totalMissions = missions.length;
  const completedMissions = missions.filter(m => m.completed).length;
  const missionRate = totalMissions ? Math.round((completedMissions / totalMissions) * 100) : 0;

  // Tipos de ocorrência
  const typeCount = occurrences.reduce((acc, o) => {
    acc[o.type] = (acc[o.type] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(typeCount).map(([name, value]) => ({ name, value }));

  // Engajamento cidadão
  const citizenActivity = last14Days.map(d => ({
    label: d.label,
    ocorrencias: d.total,
    feedbacks: feedbacks.filter(f => {
      const t = new Date(f.created_date).getTime();
      const dayLabel = format(new Date(f.created_date), "dd/MM", { locale: ptBR });
      return dayLabel === d.label;
    }).length,
  }));

  // Training completion
  const trainingByModule = progress.reduce((acc, p) => {
    const key = p.module_title || "Módulo";
    if (!acc[key]) acc[key] = { name: key, aprovados: 0, reprovados: 0 };
    if (p.status === "passed") acc[key].aprovados++;
    else if (p.status === "failed") acc[key].reprovados++;
    return acc;
  }, {});
  const trainingData = Object.values(trainingByModule).slice(0, 6);

  const SummaryCard = ({ icon: SIcon, label, value, sub, accent }) => (
    <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent || "bg-primary/10"}`}>
        <SIcon className="w-5 h-5 text-primary" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Relatórios de Desempenho</h2>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Target} label="Taxa de Missões Concluídas" value={`${missionRate}%`} sub={`${completedMissions}/${totalMissions}`} />
        <SummaryCard icon={Users} label="Agentes Ativos" value={agentPerf.length} sub="com atividade registrada" />
        <SummaryCard icon={Star} label="Avaliação Média" value={
          feedbacks.length
            ? (feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length).toFixed(1)
            : "—"
        } sub="pelos cidadãos" />
        <SummaryCard icon={TrendingUp} label="Ocorrências (14 dias)" value={last14Days.reduce((s, d) => s + d.total, 0)} sub={`${last14Days.reduce((s, d) => s + d.resolvidas, 0)} resolvidas`} />
      </div>

      {/* Ocorrências por dia */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Ocorrências nos últimos 14 dias</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={last14Days}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" name="Total" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="resolvidas" stroke="hsl(var(--chart-4))" name="Resolvidas" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Desempenho por agente */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Desempenho por Agente</h3>
          {agentPerf.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">Nenhum dado de desempenho disponível.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentPerf} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="resolvidas" fill="hsl(var(--chart-1))" name="Resolvidas" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tipos de ocorrência */}
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Tipos de Ocorrência</h3>
          {pieData.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">Sem dados.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Engajamento cidadão */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Engajamento dos Cidadãos</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={citizenActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="ocorrencias" fill="hsl(var(--chart-1))" name="Ocorrências" radius={[4, 4, 0, 0]} />
            <Bar dataKey="feedbacks" fill="hsl(var(--chart-5))" name="Avaliações" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Treinamento */}
      {trainingData.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Conclusão de Capacitações por Módulo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trainingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="aprovados" fill="hsl(var(--chart-4))" name="Aprovados" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reprovados" fill="hsl(var(--chart-2))" name="Reprovados" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}