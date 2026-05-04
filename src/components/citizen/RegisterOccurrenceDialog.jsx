import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TYPE_META, SUBTYPES, CIVIL_DEFENSE_GAMIFIED } from "@/lib/occurrenceMeta";
import { getCurrentLocation } from "@/lib/geo";
import { Upload, MapPin, Loader2, CheckCircle2, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export default function RegisterOccurrenceDialog({ open, onOpenChange, defaultType, onCreated }) {
  const { user } = useAuth();
  const [type, setType] = useState(defaultType || "crime");
  const [subtype, setSubtype] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const reset = () => {
    setSubtype(""); setDescription(""); setAddress(""); setFiles([]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        toast.info("Transcrevendo áudio...");
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: "Transcreva este áudio para português. Retorne apenas o texto transcrito, sem comentários.",
            file_urls: [file_url],
            response_json_schema: { type: "object", properties: { transcription: { type: "string" } } },
          });
          setDescription((prev) => (prev ? prev + " " : "") + (result.transcription || ""));
          toast.success("Áudio transcrito com sucesso!");
        } catch {
          toast.error("Erro na transcrição");
        }
        setTranscribing(false);
      };
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Permissão de microfone negada");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleFile = (e) => {
    setFiles(Array.from(e.target.files || []));
  };

  const handleSubmit = async () => {
    if (!subtype) return toast.error("Selecione um subtipo");
    setLoading(true);
    try {
      const location = await getCurrentLocation();

      const mediaUrls = [];
      for (const f of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        mediaUrls.push(file_url);
      }

      const isGamified = type === "civil_defense" && CIVIL_DEFENSE_GAMIFIED.includes(subtype);

      await base44.entities.Occurrence.create({
        type,
        subtype,
        description,
        address,
        lat: location.lat,
        lng: location.lng,
        media_urls: mediaUrls,
        reporter_id: user?.id,
        priority: type === "panic" ? "critical" : "medium",
        awarded_points: isGamified ? 10 : 0,
      });

      toast.success("Ocorrência registrada com sucesso", {
        icon: <CheckCircle2 className="w-4 h-4" />,
      });
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error("Erro ao registrar: " + err.message);
    }
    setLoading(false);
  };

  const TypeIcon = TYPE_META[type]?.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {TypeIcon && <TypeIcon className="w-5 h-5 text-primary" />}
            Registrar Ocorrência
          </DialogTitle>
          <DialogDescription>
            Sua localização será registrada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Categoria</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(TYPE_META).filter(([k]) => k !== "panic").map(([key, meta]) => {
                const Icon = meta.icon;
                const active = type === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setType(key); setSubtype(""); }}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      active ? `${meta.bg} ${meta.border} ${meta.color}` : "border-border hover:border-border/80 bg-card"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Subtipo *</Label>
            <Select value={subtype} onValueChange={setSubtype}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {(SUBTYPES[type] || []).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Endereço de referência</Label>
            <div className="relative mt-2">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Ex: Rua das Flores, 100" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <div className="relative mt-2">
              <Textarea rows={3} placeholder="Detalhes do ocorrido..." value={description} onChange={(e) => setDescription(e.target.value)} className="pr-10" />
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className={`absolute right-2 top-2 p-1.5 rounded-lg transition-colors ${recording ? "bg-destructive text-white animate-pulse" : "bg-muted hover:bg-muted/80 text-muted-foreground"}`}
                title={recording ? "Parar gravação" : "Gravar áudio e transcrever"}
              >
                {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
            {recording && <p className="text-[11px] text-destructive mt-1 animate-pulse">⏺ Gravando... clique no microfone para parar e transcrever</p>}
            {transcribing && <p className="text-[11px] text-primary mt-1">Transcrevendo áudio para texto...</p>}
          </div>

          <div>
            <Label>Mídia (foto, vídeo, PDF)</Label>
            <label className="mt-2 flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {files.length > 0 ? `${files.length} arquivo(s) selecionado(s)` : "Clicar para enviar"}
              </span>
              <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={handleFile} />
            </label>
          </div>

          <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Ocorrência"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}