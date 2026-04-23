import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { CheckCircle2, Paperclip, X, Loader2, Image, Video } from "lucide-react";
import { toast } from "sonner";
import { TYPE_META } from "@/lib/occurrenceMeta";

export default function ResolveOccurrenceDialog({ occurrence, open, onOpenChange, onResolved }) {
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  if (!occurrence) return null;
  const meta = TYPE_META[occurrence.type] || TYPE_META.crime;

  const handleFiles = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of selected) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({ name: file.name, url: file_url, type: file.type });
    }
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!notes.trim()) { toast.error("O relatório não pode estar vazio."); return; }
    setSaving(true);
    const mediaUrls = [...(occurrence.media_urls || []), ...files.map((f) => f.url)];
    await base44.entities.Occurrence.update(occurrence.id, {
      status: "resolved",
      resolution_notes: notes,
      media_urls: mediaUrls,
    });
    toast.success("Ocorrência resolvida com relatório registrado.");
    setSaving(false);
    onOpenChange(false);
    setNotes("");
    setFiles([]);
    onResolved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Relatório de Resolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Occurrence summary */}
          <div className="p-3 rounded-xl border border-border/60 bg-muted/30 text-sm">
            <div className="font-medium">{occurrence.subtype || meta.label}</div>
            {occurrence.address && <div className="text-xs text-muted-foreground mt-0.5">{occurrence.address}</div>}
            {occurrence.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{occurrence.description}</div>}
          </div>

          {/* Report textarea */}
          <div className="space-y-1">
            <label className="text-sm font-medium">Relatório *</label>
            <Textarea
              placeholder="Descreva as ações tomadas, o estado do local, desfecho da ocorrência..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>

          {/* File attachments */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Evidências (fotos/vídeos)</label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border/60 text-xs max-w-[180px]">
                  {f.type.startsWith("video") ? <Video className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <Image className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                {uploading ? "Enviando..." : "Anexar arquivo"}
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFiles}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || uploading} onClick={handleSubmit} className="bg-success hover:bg-success/90 text-white">
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Confirmar Resolução
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}