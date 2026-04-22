import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Pen, CheckCircle2, Loader2, AlertTriangle, MessageSquare, Map, Clock } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TYPE_META } from "@/lib/occurrenceMeta";
import jsPDF from "jspdf";

export default function ShiftReport({ shift, agentName, open, onOpenChange }) {
  const [generating, setGenerating] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signature, setSignature] = useState("");
  const [reportData, setReportData] = useState(null);
  const [signMode, setSignMode] = useState(false);

  const loadData = async () => {
    if (!shift?.id) return;
    setGenerating(true);

    const startTime = new Date(shift.start_time || shift.created_date);
    const endTime = shift.end_time ? new Date(shift.end_time) : new Date();

    const [occs, logs, msgs] = await Promise.all([
      base44.entities.Occurrence.filter({ assigned_agent_id: shift.agent_id }, "-created_date", 200),
      base44.entities.SystemLog.filter({ actor_id: shift.agent_id }, "-created_date", 100),
      base44.entities.DirectMessage.filter({ sender_id: shift.agent_id }, "-created_date", 100),
    ]);

    const shiftOccs = occs.filter((o) => {
      const d = new Date(o.updated_date || o.created_date);
      return d >= startTime && d <= endTime;
    });

    const shiftLogs = logs.filter((l) => {
      const d = new Date(l.created_date);
      return d >= startTime && d <= endTime;
    });

    const shiftMsgs = msgs.filter((m) => {
      const d = new Date(m.created_date);
      return d >= startTime && d <= endTime;
    });

    const zoneAlerts = shiftLogs.filter((l) => l.event === "patrol_boundary_alert");
    const durationMin = differenceInMinutes(endTime, startTime);

    setReportData({
      startTime,
      endTime,
      durationMin,
      shiftOccs,
      zoneAlerts,
      shiftMsgs,
      resolvedCount: shiftOccs.filter((o) => o.status === "resolved").length,
    });
    setGenerating(false);
  };

  const handleOpen = (v) => {
    if (v) loadData();
    else { setReportData(null); setSigned(false); setSignMode(false); setSignature(""); }
    onOpenChange(v);
  };

  const generatePDF = () => {
    if (!reportData) return;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFillColor(10, 20, 40);
    doc.rect(0, 0, pageW, 30, "F");
    doc.setTextColor(56, 189, 248);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("SENTINELA — RELATÓRIO DE TURNO", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 200, 220);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 21);
    doc.text(`Agente: ${agentName || "—"} | Viatura: ${shift?.vehicle_prefix || "—"} (${shift?.vehicle_plate || "—"})`, 14, 27);
    y = 40;

    // Period
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Período do Turno", 14, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Início: ${format(reportData.startTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y); y += 5;
    doc.text(`Término: ${format(reportData.endTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y); y += 5;
    doc.text(`Duração: ${Math.floor(reportData.durationMin / 60)}h ${reportData.durationMin % 60}min`, 14, y); y += 10;

    // Stats summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Resumo de Atividades", 14, y); y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`• Ocorrências atendidas: ${reportData.shiftOccs.length}`, 18, y); y += 5;
    doc.text(`• Ocorrências resolvidas: ${reportData.resolvedCount}`, 18, y); y += 5;
    doc.text(`• Alertas de zona: ${reportData.zoneAlerts.length}`, 18, y); y += 5;
    doc.text(`• Mensagens trocadas: ${reportData.shiftMsgs.length}`, 18, y); y += 10;

    // Occurrences table
    if (reportData.shiftOccs.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Ocorrências", 14, y); y += 7;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      reportData.shiftOccs.forEach((o) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const meta = TYPE_META[o.type];
        const statusLabel = { open: "Aberta", in_progress: "Em andamento", resolved: "Resolvida", canceled: "Cancelada" }[o.status] || o.status;
        doc.text(`[${meta?.label || o.type}] ${o.subtype || "—"} · ${statusLabel} · ${o.address || "Sem endereço"}`, 18, y);
        y += 4;
        if (o.description) {
          const lines = doc.splitTextToSize(o.description, pageW - 36);
          doc.setTextColor(100, 100, 100);
          doc.text(lines, 22, y);
          y += lines.length * 4;
          doc.setTextColor(30, 30, 30);
        }
        y += 2;
      });
      y += 4;
    }

    // Zone alerts
    if (reportData.zoneAlerts.length > 0) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Alertas de Zona", 14, y); y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      reportData.zoneAlerts.forEach((l) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(`• ${format(new Date(l.created_date), "HH:mm", { locale: ptBR })} — ${l.details || "Saiu da zona de patrulha"}`, 18, y);
        y += 5;
      });
      y += 4;
    }

    // Signature
    if (signed && signature) {
      if (y > 250) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Assinatura Digital do Agente", 14, y); y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Assinado por: ${signature}`, 14, y); y += 5;
      doc.text(`Em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, y); y += 5;
      doc.line(14, y + 5, 100, y + 5);
      doc.text(signature, 14, y + 12);
    }

    doc.save(`relatorio_turno_${format(reportData.startTime, "yyyyMMdd_HHmm")}.pdf`);
  };

  const durationLabel = reportData
    ? `${Math.floor(reportData.durationMin / 60)}h ${reportData.durationMin % 60}min`
    : "—";

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Relatório de Turno
          </DialogTitle>
        </DialogHeader>

        {generating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-sm">Coletando dados do turno...</span>
          </div>
        ) : !reportData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground text-sm">
            <AlertTriangle className="w-6 h-6" />
            Nenhum turno disponível para gerar o relatório.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Period */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1.5 text-sm">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Clock className="w-4 h-4 text-primary" /> Período do Turno
              </div>
              <div className="text-muted-foreground">
                {format(reportData.startTime, "dd/MM/yyyy HH:mm", { locale: ptBR })} →{" "}
                {format(reportData.endTime, "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              <div className="text-xs text-muted-foreground">Duração: <span className="font-mono font-medium text-foreground">{durationLabel}</span></div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border border-border/40 bg-card text-center">
                <div className="text-2xl font-bold text-primary">{reportData.shiftOccs.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><AlertTriangle className="w-3 h-3" /> Ocorrências</div>
              </div>
              <div className="p-3 rounded-xl border border-border/40 bg-card text-center">
                <div className="text-2xl font-bold text-success">{reportData.resolvedCount}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><CheckCircle2 className="w-3 h-3" /> Resolvidas</div>
              </div>
              <div className="p-3 rounded-xl border border-border/40 bg-card text-center">
                <div className="text-2xl font-bold text-warning">{reportData.zoneAlerts.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><Map className="w-3 h-3" /> Alertas de Zona</div>
              </div>
              <div className="p-3 rounded-xl border border-border/40 bg-card text-center">
                <div className="text-2xl font-bold text-foreground">{reportData.shiftMsgs.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><MessageSquare className="w-3 h-3" /> Mensagens</div>
              </div>
            </div>

            {/* Signature */}
            {!signed ? (
              <div className="space-y-2">
                {signMode ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Digite seu nome completo para assinar"
                      value={signature}
                      onChange={(e) => setSignature(e.target.value)}
                    />
                    <Button
                      size="sm"
                      disabled={!signature.trim()}
                      onClick={() => { setSigned(true); setSignMode(false); }}
                    >
                      Confirmar
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" onClick={() => setSignMode(true)}>
                    <Pen className="w-4 h-4 mr-2" /> Assinar Digitalmente
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30 text-sm text-success">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Assinado por <span className="font-semibold ml-1">{signature}</span>
              </div>
            )}

            {/* Export */}
            <Button className="w-full" onClick={generatePDF}>
              <Download className="w-4 h-4 mr-2" /> Exportar PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}