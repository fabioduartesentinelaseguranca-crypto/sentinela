import { useState, useEffect } from "react";
import { Siren, X, Navigation, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPE_META } from "@/lib/occurrenceMeta";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Floating critical alert banner — appears when a panic/critical occurrence arrives.
 * Lets the agent accept immediately and triggers route drawing.
 */
export default function CriticalAlert({ occurrence, agentId, onAccept, onDismiss }) {
  const [accepting, setAccepting] = useState(false);

  if (!occurrence) return null;
  const meta = TYPE_META[occurrence.type] || TYPE_META.crime;
  const isPanic = occurrence.type === "panic";

  const handleAccept = async () => {
    setAccepting(true);
    await base44.entities.Occurrence.update(occurrence.id, {
      assigned_agent_id: agentId,
      status: "in_progress",
    });
    toast.success("Ocorrência aceita — rota traçada no mapa");
    onAccept?.(occurrence);
    setAccepting(false);
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 w-80 rounded-2xl border shadow-2xl p-4 space-y-3 animate-fade-in ${
        isPanic
          ? "border-emergency/60 bg-emergency/10 backdrop-blur-md"
          : "border-warning/60 bg-warning/10 backdrop-blur-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Siren className={`w-5 h-5 flex-shrink-0 ${isPanic ? "text-emergency animate-pulse" : "text-warning"}`} />
          <div>
            <div className={`text-sm font-bold ${isPanic ? "text-emergency" : "text-warning"}`}>
              {isPanic ? "PÂNICO ATIVO" : "OCORRÊNCIA CRÍTICA"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {occurrence.subtype || meta.label}
              {occurrence.address && <> · {occurrence.address}</>}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {occurrence.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{occurrence.description}</p>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className={`flex-1 ${isPanic ? "bg-emergency hover:bg-emergency/90" : ""}`}
          disabled={accepting}
          onClick={handleAccept}
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          {accepting ? "Aceitando..." : "Aceitar"}
        </Button>
        {occurrence.lat && occurrence.lng && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${occurrence.lat},${occurrence.lng}&travelmode=driving`,
                "_blank"
              )
            }
          >
            <Navigation className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}