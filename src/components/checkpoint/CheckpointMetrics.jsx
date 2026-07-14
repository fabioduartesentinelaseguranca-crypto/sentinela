import { Users, AlertTriangle, Loader2, ScanFace, ShieldAlert } from "lucide-react";

export default function CheckpointMetrics({ module, primaryCount, activeAlerts, processing }) {
  const isProcurados = module === "procurados";
  const primaryLabel = isProcurados ? "Procurados" : "Alunos";
  const PrimaryIcon = isProcurados ? ShieldAlert : Users;
  const primaryColor = isProcurados ? "text-red-500" : "text-success";

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        <PrimaryIcon className={`w-5 h-5 mx-auto mb-1 ${primaryColor}`} />
        <div className={`text-2xl font-black ${primaryColor}`}>{primaryCount ?? 0}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">{primaryLabel} na Base</div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
        <div className="text-2xl font-black text-warning">{activeAlerts ?? 0}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">Alertas Ativos</div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        {processing ? <Loader2 className="w-5 h-5 mx-auto mb-1 text-primary animate-spin" /> : <ScanFace className="w-5 h-5 mx-auto mb-1 text-primary" />}
        <div className="text-2xl font-black text-primary">{processing ? "..." : "OK"}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">Status IA</div>
      </div>
    </div>
  );
}