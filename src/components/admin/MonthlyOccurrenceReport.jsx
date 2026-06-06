import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2, BarChart2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TYPE_META } from "@/lib/occurrenceMeta";
import jsPDF from "jspdf";

const STATUS_LABELS = {
  open: "Aberta",
  in_progress: "Em Atendimento",
  resolved: "Resolvida",
};

// Generate last 12 months options
function getMonthOptions() {
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = subMonths(new Date(), i);
    opts.push({
      value: format(d, "yyyy-MM"),
      label: format(d, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return opts;
}

export default function MonthlyOccurrenceReport() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);
  const monthOptions = getMonthOptions();

  const generate = async () => {
    setLoading(true);

    const [year, mon] = month.split("-").map(Number);
    const refDate = new Date(year, mon - 1, 1);
    const fromDate = startOfMonth(refDate);
    const toDate = endOfMonth(refDate);

    // Fetch all occurrences for the month
    const allOccs = await base44.entities.Occurrence.filter({}, "-created_date", 1000);
    const occs = allOccs.filter((o) => {
      const d = new Date(o.created_date);
      return d >= fromDate && d <= toDate;
    });

    // Group by category
    const byCategory = {};
    Object.keys(TYPE_META).forEach((t) => { byCategory[t] = []; });
    byCategory["other"] = byCategory["other"] || [];
    occs.forEach((o) => {
      const key = TYPE_META[o.type] ? o.type : "other";
      byCategory[key].push(o);
    });

    // Group by status
    const byStatus = { open: 0, in_progress: 0, resolved: 0 };
    occs.forEach((o) => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });

    // Avg resolution time
    const resolved = occs.filter((o) => o.status === "resolved" && o.updated_date);
    const avgMs = resolved.length
      ? resolved.reduce((s, o) => s + (new Date(o.updated_date) - new Date(o.created_date)), 0) / resolved.length
      : 0;
    const avgMin = Math.round(avgMs / 60000);

    // Build PDF
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    let y = 0;
    const MARGIN = 14;

    // Header
    doc.setFillColor(10, 20, 50);
    doc.rect(0, 0, W, 32, "F");
    doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("SENTINELA — Relatório Mensal de Ocorrências", MARGIN, 13);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(180, 200, 255);
    doc.text(
      `Mês de referência: ${format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}  |  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      MARGIN, 24
    );
    y = 42;

    const section = (title, color = [30, 80, 180]) => {
      doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(...color);
      doc.text(title, MARGIN, y);
      y += 4;
      doc.setDrawColor(...color.map(c => c * 0.5));
      doc.line(MARGIN, y, W - MARGIN, y);
      y += 6;
    };

    const row = (label, value, bold = false, indent = 0) => {
      if (y > 272) { doc.addPage(); y = 18; }
      doc.setFontSize(10); doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setTextColor(30, 30, 30);
      doc.text(label, MARGIN + indent, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(50, 100, 200);
      doc.text(String(value), W - MARGIN, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      y += 6;
    };

    // Summary section
    section("RESUMO GERAL");
    row("Total de ocorrências no mês", occs.length, true);
    row("Ocorrências abertas", byStatus.open);
    row("Em atendimento", byStatus.in_progress);
    row("Resolvidas", byStatus.resolved);
    row("Tempo médio de resolução", resolved.length ? `${avgMin} min` : "—");
    row("Taxa de resolução", occs.length ? `${Math.round((resolved.length / occs.length) * 100)}%` : "0%", true);
    y += 4;

    // By category section
    section("OCORRÊNCIAS POR CATEGORIA");
    const catEntries = Object.entries(byCategory).filter(([, v]) => v.length > 0);
    if (catEntries.length === 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(150, 150, 150);
      doc.text("Nenhuma ocorrência registrada no período.", MARGIN, y);
      y += 8;
    } else {
      catEntries.sort((a, b) => b[1].length - a[1].length).forEach(([type, list]) => {
        const meta = TYPE_META[type] || { label: "Outros" };
        const resCount = list.filter((o) => o.status === "resolved").length;
        const pct = list.length ? Math.round((resCount / list.length) * 100) : 0;
        row(`${meta.label}`, `${list.length} total · ${resCount} resolvidas · ${pct}% resol.`);
      });
    }
    y += 4;

    // By status section
    section("DISTRIBUIÇÃO POR STATUS");
    Object.entries(byStatus).forEach(([status, count]) => {
      row(STATUS_LABELS[status] || status, count);
    });
    y += 4;

    // Top subtypes
    section("SUBTIPOS MAIS FREQUENTES");
    const subtypeMap = {};
    occs.forEach((o) => {
      const key = o.subtype || TYPE_META[o.type]?.label || "Outros";
      subtypeMap[key] = (subtypeMap[key] || 0) + 1;
    });
    const topSubtypes = Object.entries(subtypeMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (topSubtypes.length === 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "italic"); doc.setTextColor(150, 150, 150);
      doc.text("Sem dados.", MARGIN, y); y += 8;
    } else {
      topSubtypes.forEach(([name, count], i) => {
        row(`${i + 1}. ${name}`, count, i < 3);
      });
    }
    y += 4;

    // Day-by-day table
    section("OCORRÊNCIAS POR DIA");
    const byDay = {};
    occs.forEach((o) => {
      const d = format(new Date(o.created_date), "dd/MM");
      byDay[d] = (byDay[d] || 0) + 1;
    });
    const dayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
    dayEntries.forEach(([day, count]) => {
      if (y > 272) { doc.addPage(); y = 18; }
      // Simple bar visualization
      doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60);
      doc.text(day, MARGIN, y);
      const barW = Math.min(120, count * 4);
      doc.setFillColor(30, 120, 200);
      doc.rect(MARGIN + 16, y - 3.5, barW, 4, "F");
      doc.setTextColor(30, 30, 30); doc.setFont("helvetica", "bold");
      doc.text(String(count), MARGIN + 16 + barW + 2, y);
      y += 6;
    });

    // Footer
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(160, 160, 160);
      doc.text(`Sentinela — Relatório Mensal  |  Página ${p} de ${total}  |  Confidencial`, MARGIN, 293);
    }

    doc.save(`sentinela-mensal-${month}.pdf`);
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-primary" /> Relatório Mensal por Categoria e Status
      </h3>
      <p className="text-xs text-muted-foreground">
        Gera PDF consolidado com total de ocorrências, distribuição por tipo, status e dia do mês — ideal para supervisores.
      </p>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Mês de referência</label>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={generate} disabled={loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
        Gerar Relatório Mensal em PDF
      </Button>
    </div>
  );
}