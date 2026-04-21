import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, Play, MapPin, Camera } from "lucide-react";
import { format } from "date-fns";

export default function OccurrenceRow({ occurrence, onOpenChat, onAssign, onResolve, onSelect, currentAgentId }) {
  const tm = TYPE_META[occurrence.type] || TYPE_META.crime;
  const sm = STATUS_META[occurrence.status || "open"];
  const Icon = tm.icon;
  const isMine = occurrence.assigned_agent_id === currentAgentId;

  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{occurrence.subtype || tm.label}</span>
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>{sm.label}</span>
          {occurrence.priority === "critical" && (
            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emergency text-white font-bold">CRÍTICO</span>
          )}
        </div>
        {occurrence.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{occurrence.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {occurrence.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{occurrence.address}</span>}
          <span className="font-mono">{format(new Date(occurrence.created_date), "dd/MM HH:mm")}</span>
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