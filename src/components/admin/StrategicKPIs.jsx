import { useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, Clock, CheckCircle2, Users, Download, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, parseISO, differenceInMinutes } from "date-fns";
import jsPDF from "jspdf";
import { toast } from "sonner";

const SECTOR_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function StrategicKPIs({ occurrences = [] }) {
  const [period, setPeriod] = useState("30");

  const cutoff = subDays(new Date(), parseInt(period));
  const inPeriod = occurrences.filter((o) => {
    try { return parseISO(o.created_date) >= cutoff; } catch { return false; }
  });

  // Avg response time (open → in_progress)
  const avgResponseMin = useMemo(() => {
    const timed = inPeriod.filter((o) => o.status !== "open" && o.updated_date && o.created_date);
    if (!timed.length) return 0;
    const total = timed.reduce((acc, o) => {
      try { return acc + Math.abs(differenceInMinutes(parseISO(o.updated_date), parseISO(o.created_date))); } catch { return acc; }
    }, 0);
    return (total / timed.length).toFixed(1);
  }, [inPeriod]);

  // Resolution rate
  const resolvedInPeriod = inPeriod.filter((o) => o.status === "resolved").length;
  const resolutionRate = inPeriod.length ? ((resolvedInPeriod / inPeriod.length) * 100).toFixed(1) : 0;

  // Daily trend (last N days)
  const dailyTrend = useMemo(() => {
    const days = parseInt(period) > 30 ? 30 : parseInt(period);
    return Array.from({ length: days }, (_, i) => {
      const d = subDays(new Date(), days - 1 - i);
      const dateStr = format(d, "dd/MM");
      const dayOccs = occurrences.filter((o) => {
        try { return format(parseISO(o.created_date), "dd/MM") === dateStr; } catch { return false; }
      });
      return {
        date: dateStr,
        abertas: dayOccs.filter((o) => o.status === "open").length,
        resolvidas: dayOccs.filter((o) => o.status === "resolved").length,
        total: dayOccs.length,
      };
    });
  }, [occurrences, period]);

  // Resolution by sector/type
  const bySector = useMemo(() => {
    const map = {};
    inPeriod.forEach((o) => {
      const key = o.subtype || o.type || "Outros";
      if (!map[key]) map[key] = { sector: key, total: 0, resolved: 0 };
      map[key].total++;
      if (o.status === "resolved") map[key].resolved++;
    });
    return Object.values(map)
      .map((s) => ({ ...s, taxa: s.total ? +((s.resolved / s.total) * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [inPeriod]);

  // Productivity: resolutions per agent
  const productivity = useMemo(() => {
    const map = {};
    inPeriod.filter((o) => o.status === "resolved" && o.assigned_agent_id).forEach((o) => {
      const key = o.assigned_agent_name || o.assigned_agent_id;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name: name.split(" ")[0], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [inPeriod]);

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    const today = format(new Date(), "MM/yyyy");
    doc.setFontSize(18);
    doc.text("Relatório KPIs Estratégicos", 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: últimos ${period} dias — Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);
    doc.setFontSize(13);
    doc.text("Indicadores Gerais", 14, 45);
    doc.setFontSize(11);
    doc.text(`Tempo médio de resposta: ${avgResponseMin} min`, 14, 55);
    doc.text(`Taxa de resolução: ${resolutionRate}%`, 14, 63);
    doc.text(`Ocorrências no período: ${inPeriod.length}`, 14, 71);
    doc.text(`Resolvidas: ${resolvedInPeriod}`, 14, 79);
    doc.setFontSize(13);
    doc.text("Taxa de Resolução por Setor", 14, 95);
    doc.setFontSize(10);
    bySector.forEach((s, i) => {
      doc.text(`${s.sector}: ${s.taxa}% (${s.resolved}/${s.total})`, 14, 105 + i * 8);
    });
    doc.setFontSize(13);
    doc.text("Produtividade da Equipe (resoluções)", 14, 185);
    doc.setFontSize(10);
    productivity.forEach((p, i) => {
      doc.text(`${p.name}: ${p.count} ocorrências resolvidas`, 14, 195 + i * 8);
    });
    doc.save(`kpis-sentinela-${today}.pdf`);
    toast.success("Relatório PDF exportado!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold text-xl flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> KPIs Estratégicos</h2>
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportPDF}>
            <Download className="w-4 h-4 mr-2" /> Exportar PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Tempo médio de resposta", value: `${avgResponseMin} min`, icon: Clock, color: "text-warning", sub: "open → atendimento" },
          { label: "Taxa de resolução", value: `${resolutionRate}%`, icon: CheckCircle2, color: "text-success", sub: `${resolvedInPeriod} de ${inPeriod.length}` },
          { label: "Ocorrências no período", value: inPeriod.length, icon: TrendingUp, color: "text-primary", sub: `últimos ${period} dias` },
          { label: "Setores monitorados", value: bySector.length, icon: Users, color: "text-chart-5", sub: "tipos ativos" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border/60 bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <k.icon className={`w-4 h-4 ${k.color}`} />
              {k.label}
            </div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Tendência Diária</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="resolvidas" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} name="Resolvidas" />
              <Line type="monotone" dataKey="abertas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name="Abertas" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Taxa de Resolução por Setor (%)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bySector} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <YAxis dataKey="sector" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="taxa" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} name="Taxa %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Productivity */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Produtividade da Equipe (resoluções no período)</h3>
        {productivity.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma resolução com agente atribuído no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={productivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Ocorrências resolvidas">
                {productivity.map((_, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}