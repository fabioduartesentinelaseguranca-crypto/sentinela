import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, TrendingUp, Users, CheckCircle2, Clock } from "lucide-react";
import { jsPDF } from "jspdf";
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

const MONTHS = Array.from({ length: 6 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: ptBR }) };
});

export default function ProductivityReport() {
  const [agents, setAgents] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [ag, occs, fbs, sh] = await Promise.all([
        base44.entities.User.filter({ role: "agent" }),
        base44.entities.Occurrence.list("-created_date", 1000),
        base44.entities.CitizenFeedback.list("-created_date", 500),
        base44.entities.Shift.list("-created_date", 500),
      ]);
      setAgents(ag);
      setOccurrences(occs);
      setFeedbacks(fbs);
      setShifts(sh);
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

  const periodOccs = occurrences.filter(o => inPeriod(o.created_date));
  const periodFbs = feedbacks.filter(f => inPeriod(f.created_date));
  const periodShifts = shifts.filter(s => inPeriod(s.created_date));

  // Per-agent stats
  const agentStats = agents.map(a => {
    const resolved = periodOccs.filter(o => o.assigned_agent_id === a.id && o.status === "resolved").length;
    const total = periodOccs.filter(o => o.assigned_agent_id === a.id).length;
    const agentFbs = periodFbs.filter(f => f.agent_id === a.id);
    const avgRating = agentFbs.length ? (agentFbs.reduce((s, f) => s + (f.rating || 0), 0) / agentFbs.length).toFixed(1) : "—";
    const agentShifts = periodShifts.filter(s => s.agent_id === a.id).length;
    return { name: a.full_name?.split(" ")[0] || a.email, resolved, total, avgRating, shifts: agentShifts };
  }).sort((a, b) => b.resolved - a.resolved).slice(0, 10);

  // Daily trend
  const dailyMap = {};
  periodOccs.forEach(o => {
    const day = o.created_date?.split("T")[0];
    if (!day) return;
    if (!dailyMap[day]) dailyMap[day] = { day: day.slice(8), opened: 0, resolved: 0 };
    dailyMap[day].opened++;
    if (o.status === "resolved") dailyMap[day].resolved++;
  });
  const dailyData = Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day));

  // Summary
  const totalResolved = periodOccs.filter(o => o.status === "resolved").length;
  const totalOpen = periodOccs.filter(o => o.status === "open").length;
  const avgRatingAll = periodFbs.length
    ? (periodFbs.reduce((s, f) => s + (f.rating || 0), 0) / periodFbs.length).toFixed(1)
    : "—";

  const handleGeneratePDF = async () => {
    setGenerating(true);
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const M = 15;
    let y = 20;

    // Header
    doc.setFillColor(10, 25, 45);
    doc.rect(0, 0, W, 35, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Produtividade", M, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;
    doc.text(`Período: ${monthLabel}  ·  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, M, 26);
    y = 45;

    doc.setTextColor(0, 0, 0);

    // Summary cards
    const cards = [
      { label: "Ocorrências no período", value: periodOccs.length },
      { label: "Resolvidas", value: totalResolved },
      { label: "Em aberto", value: totalOpen },
      { label: "Avaliação média", value: avgRatingAll },
    ];
    const cardW = (W - M * 2 - 9) / 4;
    cards.forEach((c, i) => {
      const x = M + i * (cardW + 3);
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(x, y, cardW, 18, 2, 2, "F");
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 100, 200);
      doc.text(String(c.value), x + cardW / 2, y + 10, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(c.label, x + cardW / 2, y + 15, { align: "center" });
    });
    y += 26;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Ranking de Agentes", M, y);
    y += 6;

    // Table header
    doc.setFillColor(30, 100, 200);
    doc.rect(M, y, W - M * 2, 7, "F");
    doc.setTextColor(255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    const cols = [M + 2, M + 55, M + 90, M + 120, M + 150];
    const headers = ["Agente", "Resolvidas", "Total", "Avaliação", "Turnos"];
    headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
    y += 9;

    agentStats.forEach((a, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
      doc.rect(M, y - 2, W - M * 2, 7, "F");
      doc.setTextColor(50);
      doc.setFont("helvetica", "normal");
      doc.text(a.name, cols[0], y + 3);
      doc.text(String(a.resolved), cols[1], y + 3);
      doc.text(String(a.total), cols[2], y + 3);
      doc.text(String(a.avgRating), cols[3], y + 3);
      doc.text(String(a.shifts), cols[4], y + 3);
      y += 7;
    });

    y += 8;
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.text("Sentinela — Plataforma de Segurança Cidadã · Relatório gerado automaticamente", M, y);

    doc.save(`relatorio-produtividade-${selectedMonth}.pdf`);
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
            <TrendingUp className="w-5 h-5 text-primary" /> Relatório de Produtividade
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Análise mensal de ocorrências e desempenho de agentes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleGeneratePDF} disabled={generating} size="sm">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Download className="w-3.5 h-3.5 mr-1.5" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Ocorrências no período", value: periodOccs.length },
          { icon: CheckCircle2, label: "Resolvidas", value: totalResolved, color: "text-success" },
          { icon: Clock, label: "Em aberto", value: totalOpen, color: "text-warning" },
          { icon: TrendingUp, label: "Avaliação média", value: avgRatingAll, color: "text-primary" },
        ].map((c, i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.color || ""}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Daily Trend */}
      {dailyData.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Evolução Diária de Ocorrências</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="opened" stroke="hsl(var(--chart-3))" name="Abertas" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" stroke="hsl(var(--chart-4))" name="Resolvidas" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Agent ranking */}
      {agentStats.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Top Agentes — Ocorrências Resolvidas</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agentStats} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="resolved" fill="hsl(var(--chart-4))" name="Resolvidas" radius={[0, 4, 4, 0]} />
              <Bar dataKey="total" fill="hsl(var(--chart-1))" name="Total" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {agentStats.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-xl">
          Nenhum dado de agente para o período selecionado.
        </div>
      )}
    </div>
  );
}