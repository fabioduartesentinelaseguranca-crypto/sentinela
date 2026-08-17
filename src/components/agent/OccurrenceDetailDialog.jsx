import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import {
  Phone, MessageSquare, Navigation, MapPin, User, Mail, ShieldAlert, Calendar, Loader2, Info,
} from "lucide-react";
import { format } from "date-fns";
import { occurrenceTime } from "@/lib/deviceTime";

export default function OccurrenceDetailDialog({ occurrence, open, onClose, onOpenChat }) {
  const [reporter, setReporter] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !occurrence) return;
    setReporter(null);
    if (occurrence.reporter_id) {
      setLoading(true);
      base44.entities.User.get(occurrence.reporter_id)
        .then(setReporter)
        .catch(() => setReporter(null))
        .finally(() => setLoading(false));
    }
  }, [open, occurrence]);

  if (!occurrence) return null;

  const tm = TYPE_META[occurrence.type] || TYPE_META.crime;
  const sm = STATUS_META[occurrence.status || "open"];
  const Icon = tm.icon;
  const wazeUrl = occurrence.lat && occurrence.lng
    ? `https://www.waze.com/ul?ll=${occurrence.lat},${occurrence.lng}&navigate=yes`
    : null;
  const mapsUrl = occurrence.lat && occurrence.lng
    ? `https://www.google.com/maps?q=${occurrence.lat},${occurrence.lng}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose?.(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center`}>
              <Icon className="w-4 h-4" />
            </span>
            {occurrence.subtype || tm.label}
          </DialogTitle>
          <DialogDescription>Detalhes completos da ocorrência</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase px-2 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>{sm.label}</span>
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-primary/15 text-primary font-medium">
              Prioridade: {occurrence.priority || "medium"}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {format(occurrenceTime(occurrence), "dd/MM/yyyy HH:mm")}
            </span>
          </div>

          {occurrence.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm bg-muted/30 rounded-lg p-3 whitespace-pre-wrap">{occurrence.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Localização</p>
            {occurrence.address && (
              <p className="text-sm flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-primary" /> {occurrence.address}
              </p>
            )}
            {wazeUrl ? (
              <div className="flex gap-2 flex-wrap">
                <Button asChild size="sm" className="bg-primary">
                  <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
                    <Navigation className="w-3.5 h-3.5 mr-1" /> Abrir no Waze
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                    <MapPin className="w-3.5 h-3.5 mr-1" /> Google Maps
                  </a>
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem coordenadas geográficas.</p>
            )}
          </div>

          {occurrence.media_urls?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Mídias anexadas</p>
              <div className="grid grid-cols-3 gap-2">
                {occurrence.media_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block">
                    <img
                      src={url}
                      alt={`mídia ${i + 1}`}
                      className="w-full h-20 object-cover rounded-lg border border-border/40"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border/40 pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Dados do Cidadão
            </p>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando dados do cidadão...
              </div>
            ) : reporter ? (
              <div className="space-y-1.5 text-sm">
                <p className="font-medium">{reporter.full_name || "Cidadão"}</p>
                {reporter.email && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" /> {reporter.email}
                  </p>
                )}
                {reporter.phone && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {reporter.phone}
                  </p>
                )}
                {reporter.protective_measure_status === "active" && (
                  <p className="flex items-center gap-1.5 text-warning text-xs">
                    <ShieldAlert className="w-3.5 h-3.5" /> Possui medida protetiva ativa
                  </p>
                )}
                {reporter.phone && (
                  <Button asChild size="sm" className="mt-2 bg-success hover:bg-success/90">
                    <a href={`tel:${reporter.phone}`}>
                      <Phone className="w-3.5 h-3.5 mr-1" /> Ligar para o cidadão
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Cidadão não identificado.</p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-border/40">
            <Button
              size="sm"
              variant="outline"
              onClick={() => { onClose?.(); onOpenChat?.(occurrence); }}
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1" /> Abrir chat da ocorrência
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}