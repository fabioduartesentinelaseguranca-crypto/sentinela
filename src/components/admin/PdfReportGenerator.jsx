import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TYPE_META } from "@/lib/occurrenceMeta";
import jsPDF from "jspdf";

function msToHHMM(ms) {
  const total = Math.round(ms / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function PdfReportGenerator({ occurrences = [], users = [] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    if (!from || !to) return;
    setLoading(true);

    const fromDate = new Date(from + "T00:00:00");
    const toDate = new Date(to + "T23:59:59");

    const resolved = occurrences.filter((o) => {
      if (o.status !== "resolved") return false;
      const d = new Date(o.created_date);
      return d >= fromDate && d <= toDate;
    });

    // Citizen ranking by awarded_points in logs
    const logs = await base44.entities.PointsLog.list("-created_date", 500);
    const rankedMap = {};
    logs.forEach((l) => {
      if (!l.user_id) return;
      if (!rankedMap[l.user_id]) rankedMap[l.user_id] = { name: l.user_name || l.user_id, points: 0, count: 0 };
      rankedMap[l.user_id].points += l.points || 0;
      rankedMap[l.user_id].count += 1;
    });
    const ranking = Object.values(rankedMap)
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    // Build PDF
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 210;
    let y = 18;

    const lineH = 7;
    const addLine = (text, size = 10, bold = false, color = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      doc.text(text, 14, y);
      y += lineH;
    };
    const hLine = () => {
      doc.setDrawColor(180, 180, 180);
      doc.line(14, y - 2, W - 14, y - 2);
    };
    const pageBreakIfNeeded = () => {
      if (y > 270) { doc.addPage(); y = 18; }
    };

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, W, 28, "F");
    doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
    doc.text("SENTINELA — Relatório de Ocorrências Resolvidas", 14, 12);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(
      `Período: ${format(fromDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(toDate, "dd/MM/yyyy", { locale: ptBR })}  |  Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      14, 22
    );
    y = 36;

    // Summary
    addLine("RESUMO", 12, true, [30, 80, 180]);
    hLine();
    addLine(`Total de ocorrências resolvidas: ${resolved.length}`, 10);
    const avgMs =
      resolved.reduce((s, o) => s + (new Date(o.updated_date) - new Date(o.created_date)), 0) /
      (resolved.length || 1);
    addLine(`Tempo médio de atendimento: ${msToHHMM(avgMs)}`, 10);
    y += 2;

    // Type breakdown
    addLine("POR TIPO", 12, true, [30, 80, 180]);
    hLine();
    Object.entries(TYPE_META).forEach(([t, m]) => {
      const n = resolved.filter((o) => o.type === t).length;
      if (n) addLine(`${m.label}: ${n}`, 10);
    });
    y += 2;

    // Occurrences list
    addLine("OCORRÊNCIAS RESOLVIDAS", 12, true, [30, 80, 180]);
    hLine();
    for (const o of resolved) {
      pageBreakIfNeeded();
      const tm = TYPE_META[o.type] || TYPE_META.crime;
      const elapsed = o.updated_date
        ? msToHHMM(new Date(o.updated_date) - new Date(o.created_date))
        : "—";
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(30, 30, 30);
      doc.text(`[${tm.label}] ${o.subtype || ""}`, 14, y);
      doc.setFont("helvetica", "normal"); doc.setTextColor(90, 90, 90);
      doc.text(`${format(new Date(o.created_date), "dd/MM/yyyy HH:mm")}  ·  Atendimento: ${elapsed}`, 100, y);
      y += 5;
      if (o.address) {
        doc.setFontSize(8); doc.setTextColor(110, 110, 110);
        doc.text(`📍 ${o.address}`, 16, y);
        y += 4;
      }
      if (o.description) {
        const lines = doc.splitTextToSize(o.description, W - 30);
        doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        doc.text(lines.slice(0, 2), 16, y);
        y += lines.slice(0, 2).length * 4;
      }
      if (o.media_urls?.length) {
        doc.setFontSize(7); doc.setTextColor(60, 120, 200);
        doc.text(`📎 ${o.media_urls.length} mídia(s) anexada(s)`, 16, y);
        y += 4;
      }
      if (o.resolution_notes) {
        doc.setFontSize(8); doc.setTextColor(60, 140, 60);
        const rlines = doc.splitTextToSize(`✔ ${o.resolution_notes}`, W - 30);
        doc.text(rlines.slice(0, 2), 16, y);
        y += rlines.slice(0, 2).length * 4;
      }
      y += 2;
      doc.setDrawColor(220, 220, 220);
      doc.line(14, y - 1, W - 14, y - 1);
      y += 2;
      pageBreakIfNeeded();
    }

    // Citizen ranking
    if (ranking.length) {
      pageBreakIfNeeded();
      y += 2;
      addLine("RANKING DE CIDADÃOS COLABORADORES", 12, true, [30, 80, 180]);
      hLine();
      ranking.forEach((r, i) => {
        pageBreakIfNeeded();
        addLine(`${i + 1}. ${r.name}  —  ${r.points} pts  (${r.count} colaborações)`, 10, i < 3);
      });
    }

    // Footer on each page
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(160, 160, 160);
      doc.text(`Sentinela - Segurança Cidadã  |  Página ${p} de ${totalPages}`, 14, 293);
    }

    doc.save(`sentinela-relatorio-${from}-${to}.pdf`);
    setLoading(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileDown className="w-4 h-4 text-primary" /> Relatório PDF — Ocorrências Resolvidas
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
        </div>
      </div>
      <Button onClick={generate} disabled={!from || !to || loading} className="w-full">
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
        Gerar PDF
      </Button>
    </div>
  );
}