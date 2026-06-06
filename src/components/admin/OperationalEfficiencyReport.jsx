import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, Activity, CheckCircle2, Clock, TrendingUp, Shield } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
});

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function OperationalEfficiencyReport() {
  const [occurrences, setOccurrences] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [occs, sh, ag] = await Promise.all([
        base44.entities.Occurrence.list("-created_date", 2000),
        base44.entities.Shift.list("-created_date", 1000),
        base44.entities.User.filter({ role: "agent" }),
      ]);
      setOccurrences(occs);
      setShifts(sh);
      setAgents(ag);
      setLoading(false);
    })();
  }, []);

  const [year, month] = selectedMonth.split("-").map(Number);
  const periodStart = startOfMonth(new Date(year, month - 1));
  const periodEnd = endOfMonth(new Date(year, month - 1));

  const inPeriod = (dateStr) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: periodStart, end: periodEnd }); } catch { return false; }
  };

  const periodOccs = occurrences.filter((o) => inPeriod(o.created_date));
  const periodShifts = shifts.filter((s) => inPeriod(s.created_date));

  // Calcular horas de patrulha por agente
  const patrolHoursByAgent = {};
  periodShifts.forEach((s) => {
    if (!s.agent_id || !s.start_time || !s.end_time) return;
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (hours > 0 && hours <= 24) {
      patrolHoursByAgent[s.agent_id] = (patrolHoursByAgent[s.agent_id] || 0) + hours;
    }
  });

  // Total horas de patrulha
  const totalPatrolHours = Object.values(patrolHoursByAgent).reduce((s, h) => s + h, 0);

  // Ocorrências resolvidas e abertas
  const resolved = periodOccs.filter((o) => o.status === "resolved");
  const open = periodOccs.filter((o) => o.status === "open");

  // Taxa de resolução
  const resolutionRate = periodOccs.length > 0 ? ((resolved.length / periodOccs.length) * 100).toFixed(1) : "0";

  // Eficiência: ocorrências resolvidas por hora de patrulha
  const efficiency = totalPatrolHours > 0 ? (resolved.length / totalPatrolHours).toFixed(2) : "—";

  // Tempo médio de resposta (created → in_progress)
  const responseTimes = periodOccs
    .filter((o) => o.accepted_at && o.created_date)
    .map((o) => {
      try { return differenceInMinutes(parseISO(o.accepted_at), parseISO(o.created_date)); } catch { return null; }
    })
    .filter((t) => t !== null && t >= 0 && t <= 1440);
  const avgResponseMin = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
    : null;

  // Por agente: ocorrências resolvidas × horas patrulha
  const agentEfficiency = agents.map((a) => {
    const agentResolved = resolved.filter((o) => o.assigned_agent_id === a.id).length;
    const hours = patrolHoursByAgent[a.id] || 0;
    const eff = hours > 0 ? (agentResolved / hours).toFixed(2) : 0;
    return {
      name: a.full_name?.split(" ")[0] || a.email,
      resolved: agentResolved,
      hours: Math.round(hours),
      efficiency: parseFloat(eff),
    };
  }).filter((a) => a.resolved > 0 || a.hours > 0)
    .sort((a, b) => b.efficiency - a.efficiency)
    .slice(0, 10);

  // Diário: ocorrências + horas de patrulha
  const dailyMap = {};
  periodOccs.forEach((o) => {
    const day = o.created_date?.split("T")[0];
    if (!day) return;
    if (!dailyMap[day]) dailyMap[day] = { day: day.slice(8), ocorrencias: 0, resolvidas: 0 };
    dailyMap[day].ocorrencias++;
    if (o.status === "resolved") dailyMap[day].resolvidas++;
  });
  const dailyData = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day));

  // Distribuição por tipo
  const byType = {};
  periodOccs.forEach((o) => {
    byType[o.type] = (byType[o.type] || 0) + 1;
  });
  const typeData = Object.entries(byType).map(([type, count]) => ({ name: type, value: count }));

  const handleExportPDF = async () => {
    setGenerating(true);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 15;
    let y = 20;

    // Header
    doc.setFillColor(10, 25, 45);
    doc.rect(0, 0, W, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Eficiência Operacional", M, 16);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const monthLabel = MONTHS.find((m) => m.value === selectedMonth)?.label || selectedMonth;
    doc.text(`Período: ${monthLabel}  ·  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, M, 26);
    doc.text("Sentinela — Plataforma de Segurança Cidadã", M, 33);
    y = 48;

    doc.setTextColor(0, 0, 0);

    // KPIs
    const kpis = [
      { label: "Total ocorrências", value: periodOccs.length },
      { label: "Resolvidas", value: resolved.length },
      { label: "Taxa de resolução", value: `${resolutionRate}%` },
      { label: "Horas de patrulha", value: `${Math.round(totalPatrolHours)}h` },
      { label: "Eficiência (res/h)", value: efficiency },
      { label: "Tempo médio resposta", value: avgResponseMin ? `${avgResponseMin}min` : "—" },
    ];
    const cardW = (W - M * 2 - 10) / 3;
    kpis.forEach((k, i) => {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const x = M + col * (cardW + 5);
      const ky = y + row * 22;
      doc.setFillColor(245, 247, 252);
      doc.roundedRect(x, ky, cardW, 18, 2, 2, "F");
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 100, 200);
      doc.text(String(k.value), x + cardW / 2, ky + 9, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(k.label, x + cardW / 2, ky + 15, { align: "center" });
    });
    y += 48;

    // Agent table
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Eficiência por Agente", M, y);
    y += 6;

    doc.setFillColor(30, 100, 200);
    doc.rect(M, y, W - M * 2, 7, "F");
    doc.setTextColor(255);
    doc.setFontSize(8);
    const cols = [M + 2, M + 60, M + 100, M + 135];
    ["Agente", "Resolvidas", "Horas Patrulha", "Eficiência (res/h)"].forEach((h, i) => doc.text(h, cols[i], y + 5));
    y += 9;

    agentEfficiency.forEach((a, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
      doc.rect(M, y - 2, W - M * 2, 7, "F");
      doc.setTextColor(50);
      doc.setFont("helvetica", "normal");
      doc.text(a.name, cols[0], y + 3);
      doc.text(String(a.resolved), cols[1], y + 3);
      doc.text(`${a.hours}h`, cols[2], y + 3);
      doc.text(String(a.efficiency), cols[3], y + 3);
      y += 7;
    });

    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.setFont("helvetica", "italic");
    doc.text("Eficiência = ocorrências resolvidas ÷ horas de patrulha registradas no período.", M, y);

    doc.save(`eficiencia-operacional-${selectedMonth}.pdf`);
    setGenerating(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Eficiência Operacional Mensal
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cruzamento entre ocorrências finalizadas e horas de patrulha registradas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleExportPDF} disabled={generating}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Shield, label: "Ocorrências", value: periodOccs.length },
          { icon: CheckCircle2, label: "Resolvidas", value: resolved.length, color: "text-success" },
          { icon: TrendingUp, label: "Taxa resolução", value: `${resolutionRate}%`, color: "text-primary" },
          { icon: Clock, label: "Horas patrulha", value: `${Math.round(totalPatrolHours)}h` },
          { icon: Activity, label: "Eficiência", value: efficiency, color: "text-primary", hint: "res/h" },
          { icon: Clock, label: "Tempo médio", value: avgResponseMin ? `${avgResponseMin}min` : "—", color: "text-warning" },
        ].map((k, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <p className={`text-xl font-bold ${k.color || ""}`}>{k.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1">{k.label}</p>
            {k.hint && <p className="text-[10px] text-muted-foreground">{k.hint}</p>}
          </div>
        ))}
      </div>

      {/* Daily chart */}
      {dailyData.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Ocorrências diárias — abertas vs resolvidas</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="ocorrencias" fill="hsl(var(--chart-3))" name="Abertas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="resolvidas" fill="hsl(var(--chart-4))" name="Resolvidas" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Efficiency per agent */}
        {agentEfficiency.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Eficiência por Agente (resolvidas/hora)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentEfficiency} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip formatter={(v, n) => [v, n === "efficiency" ? "Efic. (res/h)" : n]} />
                <Bar dataKey="efficiency" fill="hsl(var(--chart-1))" name="Eficiência" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Type distribution */}
        {typeData.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Distribuição por Tipo</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {typeData.map((_, idx) => (
                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Agent detail table */}
      {agentEfficiency.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="p-4 border-b border-border/60">
            <h3 className="font-semibold text-sm">Detalhamento por Agente</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Agente</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Resolvidas</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Horas patrulha</th>
                <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Eficiência</th>
              </tr>
            </thead>
            <tbody>
              {agentEfficiency.map((a, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2.5 font-medium">{a.name}</td>
                  <td className="px-4 py-2.5 text-center text-success font-mono">{a.resolved}</td>
                  <td className="px-4 py-2.5 text-center font-mono">{a.hours}h</td>
                  <td className="px-4 py-2.5 text-center font-mono text-primary font-semibold">{a.efficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {periodOccs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          Nenhum dado para o período selecionado.
        </div>
      )}
    </div>
  );
}