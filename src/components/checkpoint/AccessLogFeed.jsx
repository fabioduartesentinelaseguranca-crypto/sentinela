import { ScrollText, Clock } from "lucide-react";

const CLASS_CONFIG = {
  "Allowed Student": { color: "border-success/40 bg-success/5 text-success", label: "Aluno Autorizado", dot: "bg-success" },
  "Student Evasion Attempt": { color: "border-orange-500/40 bg-orange-500/5 text-orange-500", label: "Tentativa de Evasão", dot: "bg-orange-500" },
  "Unauthorized Intruder": { color: "border-yellow-500/40 bg-yellow-500/5 text-yellow-500", label: "Intruso", dot: "bg-yellow-500" },
  "Wanted Suspect": { color: "border-red-500/60 bg-red-500/5 text-red-500", label: "Procurado", dot: "bg-red-500" },
};

export default function AccessLogFeed({ logs }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60">
        <ScrollText className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm">Últimos Acessos</span>
        <span className="ml-auto text-xs text-muted-foreground">{logs.length} registros</span>
      </div>
      <div className="divide-y divide-border/40 max-h-[360px] overflow-y-auto scrollbar-thin">
        {logs.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro ainda.</div>
        )}
        {logs.map((log) => {
          const cfg = CLASS_CONFIG[log.classification] || CLASS_CONFIG["Unauthorized Intruder"];
          const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString("pt-BR") : "";
          return (
            <div key={log.id} className={`flex items-center gap-3 p-2.5 border-l-4 ${cfg.color}`}>
              {log.snapshot_url ? (
                <img src={log.snapshot_url} alt="snapshot" className="w-11 h-11 object-cover rounded-lg flex-shrink-0 border border-border" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><ScrollText className="w-4 h-4 text-muted-foreground" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className={`text-xs font-bold ${cfg.color.split(" ").find(c => c.startsWith("text-"))}`}>{cfg.label}</span>
                </div>
                {log.person_name && <div className="text-sm font-medium truncate">{log.person_name}</div>}
                {log.similarity != null && <div className="text-[10px] text-muted-foreground">Similaridade: {log.similarity}%</div>}
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                <Clock className="w-3 h-3" />{time}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}