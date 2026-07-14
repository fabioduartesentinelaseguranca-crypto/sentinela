import { useEffect } from "react";
import { X, ShieldAlert } from "lucide-react";

const ALERT_CONFIG = {
  "Wanted Suspect": {
    border: "border-red-500",
    text: "text-red-500",
    bg: "bg-red-500/10",
    title: (a) => "CRITICAL WARNING: WANTED INDIVIDUAL DETECTED",
    sub: (a) => `${a.person_name} · Ameaça ${a.threat_level || "alta"} · ${a.similarity}%`,
    flash: true, auto: 0,
  },
  "Student Evasion Attempt": {
    border: "border-orange-500", text: "text-orange-500", bg: "bg-orange-500/10",
    title: (a) => `EVASION ATTEMPT DETECTED: ${a.person_name}`,
    sub: (a) => `Fora do horário permitido (${a.allowed_checkin_time}-${a.allowed_checkout_time}) · ${a.similarity}%`,
    flash: true, auto: 6000,
  },
  "Unauthorized Intruder": {
    border: "border-yellow-500", text: "text-yellow-500", bg: "bg-yellow-500/10",
    title: () => "UNAUTHORIZED INTRUDER DETECTED",
    sub: (a) => `Indivíduo não identificado · melhor similaridade ${a.similarity}%`,
    flash: true, auto: 6000,
  },
  "Allowed Student": {
    border: "border-green-500", text: "text-green-500", bg: "bg-green-500/10",
    title: (a) => `${a.access_event === "saida" ? "Saída Registrada" : "Entrada Registrada"}: ${a.person_name}`,
    sub: (a) => a.alerta_disparado
      ? `⚠️ ${a.motivo_alerta} · Matrícula ${a.matricula} · ${a.similarity}%`
      : `Matrícula ${a.matricula} · dentro do horário · ${a.similarity}%`,
    flash: false, auto: 4000,
  },
};

export default function CheckpointAlertOverlay({ alert, onDismiss }) {
  useEffect(() => {
    if (!alert) return;
    const cfg = ALERT_CONFIG[alert.classification];
    if (!cfg || !cfg.auto) return;
    const t = setTimeout(onDismiss, cfg.auto);
    return () => clearTimeout(t);
  }, [alert, onDismiss]);

  if (!alert) return null;
  const cfg = ALERT_CONFIG[alert.classification];
  if (!cfg) return null;

  return (
    <>
      {/* Borda piscante na tela */}
      <div className={`fixed inset-0 z-40 pointer-events-none border-[6px] ${cfg.border} ${cfg.flash ? "animate-pulse" : ""}`} />
      {/* Banner central */}
      <div className="fixed inset-x-0 top-1/4 z-50 flex justify-center px-4 pointer-events-none">
        <div className={`pointer-events-auto rounded-2xl border-2 ${cfg.border} ${cfg.bg} backdrop-blur-sm shadow-2xl px-8 py-6 max-w-2xl w-full flex items-center gap-4 ${cfg.flash ? "animate-pulse" : ""}`}>
          <ShieldAlert className={`w-12 h-12 flex-shrink-0 ${cfg.text}`} />
          <div className="flex-1">
            <h2 className={`text-2xl md:text-3xl font-black tracking-tight ${cfg.text}`}>{cfg.title(alert)}</h2>
            <p className="text-sm text-muted-foreground mt-1">{cfg.sub(alert)}</p>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
    </>
  );
}