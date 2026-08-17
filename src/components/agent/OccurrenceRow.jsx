import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, Play, MapPin, Camera, Volume2, Info } from "lucide-react";
import { format } from "date-fns";
import { urgencyLabel } from "@/lib/urgencyScore";
import { occurrenceTime } from "@/lib/deviceTime";

export default function OccurrenceRow({ occurrence, onOpenChat, onAssign, onResolve, onSelect, onOpenDetail, currentAgentId }) {
  const tm = TYPE_META[occurrence.type] || TYPE_META.crime;
  const sm = STATUS_META[occurrence.status || "open"];
  const Icon = tm.icon;
  const isMine = occurrence.assigned_agent_id === currentAgentId;
  const score = occurrence._urgencyScore ?? 0;
  const urg = urgencyLabel(score);

  const isCritical =
    occurrence.type === "panic" ||
    occurrence.priority === "critical" ||
    score >= 160;

  const isHigh = !isCritical && (occurrence.priority === "high" || score >= 100);

  const borderClass = isCritical
    ? "border-emergency/80 shadow-[0_0_12px_2px_hsl(var(--emergency)/0.25)]"
    : isHigh
    ? "border-warning/60"
    : "border-border/60";

  const bgClass = isCritical
    ? "bg-emergency/5"
    : isHigh
    ? "bg-warning/5"
    : "bg-card";

  return (
    <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${borderClass} ${bgClass}`}>
      <div className={`w-9 h-9 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center flex-shrink-0 relative`}>
        <Icon className="w-4 h-4" />
        {isCritical && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emergency animate-pulse border-2 border-card" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors"
            onClick={() => onOpenDetail?.(occurrence)}
          >
            {occurrence.subtype || tm.label}
          </span>
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>{sm.label}</span>
          {isCritical && (
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-emergency text-white font-bold flex items-center gap-1 animate-pulse">
              <Volume2 className="w-2.5 h-2.5" /> CRÍTICO
            </span>
          )}
          {isHigh && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-warning/20 text-warning font-bold">ALTA PRIORIDADE</span>
          )}
          {score > 0 && !isCritical && !isHigh && (
            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-bold ${urg.cls}`}>
              {urg.label}
            </span>
          )}
        </div>
        {occurrence.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{occurrence.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {occurrence.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{occurrence.address}</span>}
          <span className="font-mono">{format(occurrenceTime(occurrence), "dd/MM HH:mm")}</span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {occurrence.status === "open" && (
            <Button size="sm" variant="outline" onClick={() => onAssign(occurrence)}>
              <Play className="w-3 h-3 mr-1" /> Assumir
            </Button>
          )}
          {isMine && occurrence.status === "in_progress" && (
            <Button size="sm" variant="outline" onClick={() => onResolve(occurrence)}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Resolver
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onOpenChat(occurrence)}>
            <MessageSquare className="w-3 h-3 mr-1" /> Chat
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onOpenDetail?.(occurrence)}>
            <Info className="w-3 h-3 mr-1" /> Detalhes
          </Button>
          {occurrence.lat && onSelect && (
            <Button size="sm" variant="ghost" onClick={() => onSelect(occurrence)}>
              <Camera className="w-3 h-3 mr-1" /> Câmeras
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}