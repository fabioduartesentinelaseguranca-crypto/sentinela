import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, ChevronRight, Loader2 } from "lucide-react";
import BoletimOcorrenciaPanel from "@/components/admin/BoletimOcorrenciaPanel";

export default function BoletinsOcorrenciaList() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    (async () => {
      const list = await base44.entities.Alertas_Inteligencia_IA.filter({ status_alerta: "FINALIZADO" }, "-data_hora_brasilia", 30);
      setAlertas(list);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (alertas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
        <p className="text-sm text-muted-foreground">Nenhum alerta finalizado encontrado.</p>
        <p className="text-xs text-muted-foreground mt-1">Boletins são gerados automaticamente quando um alerta é finalizado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {alertas.map((a) => (
          <div key={a.id}>
            <button
              onClick={() => setSelectedId(selectedId === a.id ? null : a.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {a.tipo_gatilho?.replace(/_/g, " ") || "ALERTA"}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {a.data_hora_brasilia ? new Date(a.data_hora_brasilia).toLocaleString("pt-BR") : "—"}
                  </span>
                </div>
                <div className="text-sm mt-1 truncate">
                  {a.resumo_despacho_ia || "Sem resumo disponível"}
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${selectedId === a.id ? "rotate-90" : ""}`} />
            </button>
            {selectedId === a.id && (
              <div className="px-4 pb-4 border-t border-border/40 pt-3">
                <BoletimOcorrenciaPanel alertaId={a.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}