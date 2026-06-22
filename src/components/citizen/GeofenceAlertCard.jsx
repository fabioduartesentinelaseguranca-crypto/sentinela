import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { AlertTriangle, MapPin, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const URGENCIA = {
  extremo: { bg: "bg-emergency/15", border: "border-emergency/50", text: "text-emergency", label: "EXTREMO" },
  alto: { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", label: "ALTO" },
  medio: { bg: "bg-warning/10", border: "border-warning/40", text: "text-warning", label: "MÉDIO" },
  baixo: { bg: "bg-muted/30", border: "border-border", text: "text-muted-foreground", label: "BAIXO" },
};

export default function GeofenceAlertCard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const list = await base44.entities.Notificacoes_Geofence.filter(
        { user_id: user.id },
        "-data_disparo",
        10
      );
      setAlerts(list);
    })();
  }, [user?.id]);

  const unread = alerts.filter((a) => a.status_envio !== "lido").length;

  if (alerts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm">Alertas da Defesa Civil</h3>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} alerta${unread > 1 ? "s" : ""} novo${unread > 1 ? "s" : ""}` : `${alerts.length} alerta${alerts.length > 1 ? "s" : ""} recebido${alerts.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {alerts.map((a) => {
            const urg = URGENCIA[a.nivel_urgencia] || URGENCIA.medio;
            return (
              <div key={a.id} className={`p-3 rounded-xl border ${urg.border} ${urg.bg}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${urg.bg} ${urg.text}`}>
                        {urg.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{a.tipo_risco}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{a.mensagem}</p>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {a.data_disparo ? format(new Date(a.data_disparo), "dd/MM 'às' HH:mm", { locale: ptBR }) : ""}
                    </div>
                  </div>
                  {a.cerca_nome && (
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                      <MapPin className="w-3 h-3" />
                      {a.cerca_nome}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}