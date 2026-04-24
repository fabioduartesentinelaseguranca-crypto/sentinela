import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ShieldAlert, CheckCircle2, XCircle, Eye, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";

const CATEGORY_LABELS = {
  drug_traffic: { label: "Tráfico", color: "#ef4444" },
  suspicious_activity: { label: "Atividade Suspeita", color: "#f97316" },
  vandalism: { label: "Vandalismo", color: "#a855f7" },
  abandoned_vehicle: { label: "Veículo Abandonado", color: "#3b82f6" },
  risk_area: { label: "Área de Risco", color: "#dc2626" },
  other: { label: "Outro", color: "#6b7280" },
};

const STATUS_CFG = {
  pending: { label: "Pendente", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive" },
};

export default function TipModerationPanel() {
  const [tips, setTips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [tab, setTab] = useState("list");

  const load = () => base44.entities.AnonymousTip.list("-created_date", 200).then(setTips);
  useEffect(() => { load(); }, []);

  const openDetail = (tip) => {
    setSelected(tip);
    setNotes(tip.manager_notes || "");
    setDetailOpen(true);
  };

  const moderate = async (status) => {
    await base44.entities.AnonymousTip.update(selected.id, { status, manager_notes: notes });
    toast.success(`Denúncia ${STATUS_CFG[status].label.toLowerCase()}`);
    setDetailOpen(false);
    load();
  };

  const pendingTips = tips.filter((t) => t.status === "pending");
  const approvedTips = tips.filter((t) => t.status === "approved" && t.lat && t.lng);
  const mapCenter = approvedTips.length > 0
    ? [approvedTips[0].lat, approvedTips[0].lng]
    : [-15.7801, -47.9292];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Denúncias Anônimas & Mapa de Calor</h3>
        {pendingTips.length > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">
            {pendingTips.length} pendente{pendingTips.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 border-b border-border/60 pb-1">
        {[{ id: "list", label: "Fila de Moderação" }, { id: "map", label: "Mapa de Calor" }].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm rounded-t-lg transition-colors ${tab === t.id ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === "list" && (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          {tips.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma denúncia recebida.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Denúncia</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">Data</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {tips.map((t) => {
                  const cat = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.other;
                  const sc = STATUS_CFG[t.status] || STATUS_CFG.pending;
                  return (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm line-clamp-1 max-w-[200px]">{t.description}</div>
                        {t.address && <div className="text-[10px] text-muted-foreground">{t.address}</div>}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color + "25", color: cat.color }}>{cat.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-[10px] text-muted-foreground font-mono hidden md:table-cell">
                        {format(new Date(t.created_date), "dd/MM HH:mm")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="ghost" onClick={() => openDetail(t)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "map" && (
        <div className="rounded-2xl overflow-hidden border border-border/60" style={{ height: 420 }}>
          {approvedTips.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Nenhuma denúncia aprovada com coordenadas.
            </div>
          ) : (
            <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution="&copy; CartoDB"
              />
              {approvedTips.map((t) => {
                const cat = CATEGORY_LABELS[t.category] || CATEGORY_LABELS.other;
                return (
                  <CircleMarker key={t.id} center={[t.lat, t.lng]} radius={14} pathOptions={{ color: cat.color, fillColor: cat.color, fillOpacity: 0.45, weight: 2 }}>
                    <Tooltip permanent={false}>
                      <div className="text-xs font-medium">{cat.label}</div>
                      <div className="text-[10px] max-w-[160px]">{t.description}</div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}
        </div>
      )}

      {/* Detail / moderation dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Denúncia Anônima
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-sm">{selected.description}</div>
              {selected.address && <div className="text-xs text-muted-foreground">📍 {selected.address}</div>}
              {selected.media_urls?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selected.media_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-border/60" />
                    </a>
                  ))}
                </div>
              )}
              <div>
                <label className="text-xs font-medium">Notas do gestor</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Comentários internos..." className="mt-1 resize-none min-h-[70px]" />
              </div>
              {selected.status === "pending" && (
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => moderate("approved")}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => moderate("rejected")}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                  </Button>
                </div>
              )}
              {selected.status !== "pending" && (
                <p className="text-xs text-center text-muted-foreground">Denúncia já moderada: {STATUS_CFG[selected.status]?.label}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}