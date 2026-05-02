import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { format, differenceInMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, Map as MapIcon, Clock, Route, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PatrolHistoryViewer({ agentId, agentName, shifts = [] }) {
  const [selectedShift, setSelectedShift] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadBreadcrumb = async (shift) => {
    setSelectedShift(shift);
    setLoading(true);
    setBreadcrumb(null);
    const results = await base44.entities.ShiftBreadcrumb.filter({ shift_id: shift.id }, "-created_date", 1);
    setBreadcrumb(results[0] || null);
    setLoading(false);
  };

  const exportPDF = async () => {
    if (!selectedShift) return;
    setExporting(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const pts = breadcrumb?.points || [];
      const durationMin = selectedShift.end_time
        ? differenceInMinutes(new Date(selectedShift.end_time), new Date(selectedShift.start_time))
        : null;

      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("SENTINELA", 14, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Resumo Diário de Patrulha", 14, 28);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 35);

      // Separator
      doc.setDrawColor(56, 189, 248);
      doc.setLineWidth(1);
      doc.line(0, 40, 210, 40);

      // Agent info
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Informações do Turno", 14, 54);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const info = [
        ["Agente:", agentName || "—"],
        ["Viatura:", selectedShift.vehicle_prefix || "—"],
        ["Início:", format(new Date(selectedShift.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })],
        ["Término:", selectedShift.end_time ? format(new Date(selectedShift.end_time), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Turno ativo"],
        ["Duração:", durationMin ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min` : "—"],
        ["Pontos GPS:", pts.length.toString()],
      ];

      let y = 64;
      info.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.text(label, 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(value, 55, y);
        y += 8;
      });

      // Breadcrumb coordinates table
      if (pts.length > 0) {
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("Trilha GPS (primeiros 20 pontos)", 14, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setFillColor(240, 240, 240);
        doc.rect(14, y - 5, 182, 7, "F");
        doc.text("Horário", 16, y);
        doc.text("Latitude", 75, y);
        doc.text("Longitude", 130, y);
        y += 4;

        doc.setFont("helvetica", "normal");
        pts.slice(0, 20).forEach((pt, i) => {
          if (y > 270) { doc.addPage(); y = 20; }
          if (i % 2 === 0) {
            doc.setFillColor(250, 250, 250);
            doc.rect(14, y - 4, 182, 7, "F");
          }
          doc.text(pt.ts ? format(new Date(pt.ts), "HH:mm:ss") : "—", 16, y);
          doc.text(pt.lat?.toFixed(6)?.toString() || "—", 75, y);
          doc.text(pt.lng?.toFixed(6)?.toString() || "—", 130, y);
          y += 7;
        });

        if (pts.length > 20) {
          doc.setTextColor(100, 100, 100);
          doc.text(`... e mais ${pts.length - 20} pontos registrados.`, 14, y + 4);
        }
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Sentinela — Relatório Confidencial — Página ${i} de ${pageCount}`, 14, 290);
      }

      doc.save(`patrulha_${agentName?.replace(/ /g, "_")}_${format(new Date(selectedShift.start_time), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
    setExporting(false);
  };

  const pts = breadcrumb?.points || [];
  const polyline = pts.filter((p) => p.lat && p.lng).map((p) => [p.lat, p.lng]);
  const center = polyline.length > 0 ? polyline[Math.floor(polyline.length / 2)] : [-15.793, -47.882];
  const durationMin = selectedShift?.end_time
    ? differenceInMinutes(new Date(selectedShift.end_time), new Date(selectedShift.start_time))
    : null;

  const endedShifts = shifts.filter((s) => s.status === "ended" || s.end_time);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      {/* Shift list */}
      <div className="space-y-2">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider px-1">Turnos Anteriores</h3>
        {endedShifts.length === 0 && (
          <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">
            Nenhum turno finalizado encontrado.
          </div>
        )}
        {endedShifts.map((shift) => (
          <button
            key={shift.id}
            onClick={() => loadBreadcrumb(shift)}
            className={`w-full text-left p-4 rounded-xl border transition-all hover:border-primary/40 ${selectedShift?.id === shift.id ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{shift.vehicle_prefix || "Sem viatura"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(shift.start_time), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>

      {/* Map + detail */}
      <div className="lg:col-span-2 space-y-4">
        {!selectedShift && (
          <div className="flex items-center justify-center h-64 border border-dashed rounded-2xl text-muted-foreground text-sm">
            <div className="text-center">
              <Route className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Selecione um turno para visualizar o trajeto
            </div>
          </div>
        )}

        {selectedShift && (
          <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
                <div className="font-mono font-bold text-primary text-lg">
                  {durationMin ? `${Math.floor(durationMin / 60)}h${durationMin % 60}m` : "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">Duração</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                <MapIcon className="w-4 h-4 text-success mx-auto mb-1" />
                <div className="font-mono font-bold text-success text-lg">{pts.length}</div>
                <div className="text-[10px] text-muted-foreground">Pontos GPS</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
                <Route className="w-4 h-4 text-warning mx-auto mb-1" />
                <div className="font-mono font-bold text-warning text-lg">{selectedShift.vehicle_prefix || "—"}</div>
                <div className="text-[10px] text-muted-foreground">Viatura</div>
              </div>
            </div>

            {/* Map */}
            {loading ? (
              <div className="flex items-center justify-center h-72 border border-border/60 rounded-2xl">
                <div className="w-6 h-6 border-3 border-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden border border-border/60" style={{ height: 340 }}>
                <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    attribution='&copy; CartoDB'
                  />
                  {polyline.length > 1 && (
                    <Polyline positions={polyline} color="#38bdf8" weight={3} opacity={0.85} />
                  )}
                  {polyline.length > 0 && (
                    <>
                      <CircleMarker center={polyline[0]} radius={8} fillColor="#22c55e" color="#fff" weight={2} fillOpacity={1}>
                        <Popup>Início do turno</Popup>
                      </CircleMarker>
                      <CircleMarker center={polyline[polyline.length - 1]} radius={8} fillColor="#ef4444" color="#fff" weight={2} fillOpacity={1}>
                        <Popup>Fim do turno</Popup>
                      </CircleMarker>
                    </>
                  )}
                  {polyline.length === 0 && (
                    <CircleMarker center={center} radius={6} fillColor="#6b7280" fillOpacity={0.5} color="transparent">
                      <Popup>Sem dados GPS para este turno</Popup>
                    </CircleMarker>
                  )}
                </MapContainer>
              </div>
            )}

            {polyline.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground text-center">
                Nenhum ponto de GPS registrado neste turno.
              </div>
            )}

            <Button onClick={exportPDF} disabled={exporting} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              {exporting ? "Gerando PDF..." : "Exportar Resumo em PDF"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}