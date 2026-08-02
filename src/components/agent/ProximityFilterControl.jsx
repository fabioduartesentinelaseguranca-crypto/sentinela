import { Radar, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProximityFilterControl({ enabled, radius, onToggle, onRadiusChange, count, activeAgentsCount }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        variant={enabled ? "default" : "outline"}
        size="sm"
        onClick={onToggle}
        className={enabled ? "border-primary bg-primary/15 text-primary hover:bg-primary/25" : ""}
      >
        <Radar className="w-4 h-4 mr-1.5" />
        {enabled ? "Proximidade ON" : "Por proximidade"}
      </Button>
      {enabled && (
        <>
          <Select value={String(radius)} onValueChange={(v) => onRadiusChange(Number(v))}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <Navigation className="w-3.5 h-3.5 mr-1 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 5, 10, 20, 50].map((r) => (
                <SelectItem key={r} value={String(r)}>{r} km</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {activeAgentsCount > 0
              ? `${activeAgentsCount} agente${activeAgentsCount > 1 ? "s" : ""} ativo${activeAgentsCount > 1 ? "s" : ""} c/ check-in · ${count} ocorrência${count !== 1 ? "s" : ""} próxima${count !== 1 ? "s" : ""}`
              : "Nenhum agente ativo com check-in e localização"}
          </span>
        </>
      )}
    </div>
  );
}