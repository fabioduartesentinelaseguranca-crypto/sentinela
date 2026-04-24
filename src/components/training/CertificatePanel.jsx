import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Award, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format, isAfter, parseISO, differenceInDays } from "date-fns";

export default function CertificatePanel({ agentId }) {
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    if (!agentId) return;
    base44.entities.CertificateRecord.filter({ agent_id: agentId }, "-issued_at", 50).then(setCerts);
  }, [agentId]);

  const getStatus = (cert) => {
    if (!cert.expires_at) return "valid";
    const expiry = parseISO(cert.expires_at);
    if (!isAfter(expiry, new Date())) return "expired";
    const daysLeft = differenceInDays(expiry, new Date());
    if (daysLeft <= 30) return "expiring";
    return "valid";
  };

  const statusCfg = {
    valid: { label: "Válido", cls: "bg-success/15 text-success", icon: CheckCircle2 },
    expiring: { label: "Vence em breve", cls: "bg-warning/20 text-warning", icon: Clock },
    expired: { label: "Vencido", cls: "bg-destructive/20 text-destructive", icon: AlertTriangle },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-semibold">Meus Certificados</h3>
      </div>
      {certs.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum certificado emitido ainda.</p>
      ) : (
        <div className="space-y-2">
          {certs.map((c) => {
            const st = getStatus(c);
            const cfg = statusCfg[st];
            const Icon = cfg.icon;
            const daysLeft = c.expires_at ? differenceInDays(parseISO(c.expires_at), new Date()) : null;
            return (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
                <div>
                  <div className="text-sm font-medium">{c.module_title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Emitido: {format(parseISO(c.issued_at), "dd/MM/yyyy")}
                    {c.expires_at && ` · Validade: ${format(parseISO(c.expires_at), "dd/MM/yyyy")}`}
                    {c.score != null && ` · Nota: ${c.score}%`}
                  </div>
                  {st === "expiring" && daysLeft != null && (
                    <div className="text-[10px] text-warning mt-0.5">⚠ Vence em {daysLeft} dia{daysLeft !== 1 ? "s" : ""}</div>
                  )}
                  {st === "expired" && (
                    <div className="text-[10px] text-destructive mt-0.5">🔒 Acesso a equipamentos táticos bloqueado até renovar</div>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex items-center gap-1 ${cfg.cls}`}>
                  <Icon className="w-3 h-3" /> {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}