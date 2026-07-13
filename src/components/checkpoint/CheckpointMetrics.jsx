import { Users, AlertTriangle, Loader2, ScanFace } from "lucide-react";

export default function CheckpointMetrics({ studentsInside, activeAlerts, processing }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        <Users className="w-5 h-5 mx-auto mb-1 text-success" />
        <div className="text-2xl font-black text-success">{studentsInside}</div>
        <div className="text-[10px] text-muted-foreground leading-tight">Alunos Dentro</div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
        <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-warning" />
        <div className="text-2xl font-black text-warning">{activeAlerts}</div>
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