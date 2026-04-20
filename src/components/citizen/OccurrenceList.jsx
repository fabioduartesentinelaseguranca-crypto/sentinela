import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MapPin, MessageSquare } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OccurrenceList({ items, onOpenChat }) {
  if (!items?.length) {
    return <EmptyState icon={FileText} title="Nenhuma ocorrência" description="Suas ocorrências aparecerão aqui." />;
  }
  return (
    <div className="space-y-2">
      {items.map((o) => {
        const tm = TYPE_META[o.type] || TYPE_META.crime;
        const sm = STATUS_META[o.status || "open"];
        const Icon = tm.icon;
        return (
          <div key={o.id} className="p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{o.subtype || tm.label}</span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>
                      {sm.label}
                    </span>
                  </div>
                  {o.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{o.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                    {o.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.address}</span>}
                    <span className="font-mono">{format(new Date(o.created_date), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {o.awarded_points > 0 && o.status === "resolved" && (
                  <div className="text-[11px] text-success font-bold">+{o.awarded_points} pts</div>
                )}
                {onOpenChat && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenChat(o)}>
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}