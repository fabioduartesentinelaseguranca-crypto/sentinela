import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RotateCcw, Loader2, ScanFace, ShieldCheck, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BiometriaCapturaFace({ onCapture, onClear, label = "Foto Biométrica", initialValue = null }) {
  const [fotoUrl, setFotoUrl] = useState(initialValue?.fotoUrl || null);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Inicia a câmera quando showCamera vira true
  useEffect(() => {
    if (!showCamera) return;
    setCameraReady(false);

    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        // videoRef já está montado porque showCamera=true renderizou o <video>
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        if (!stopped) toast.error("Câmera não disponível. Verifique as permissões.");
        setShowCamera(false);
      });

    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      toast.error("Câmera ainda não está pronta.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) { toast.error("Falha ao capturar imagem."); return; }
      setShowCamera(false);
      await uploadBlob(blob);
    }, "image/jpeg", 0.92);
  };

  const uploadBlob = async (blob) => {
    setUploading(true);
    const localUrl = URL.createObjectURL(blob);
    setFotoUrl(localUrl);
    try {
      const result = await base44.integrations.Core.UploadFile({ file: blob });
      const url = result?.file_url;
      if (!url) throw new Error("Sem URL");
      setFotoUrl(url);
      onCapture({ fotoUrl: url, embedding: [], qualidade: 75 });
      toast.success("Foto salva!");
    } catch (err) {
      toast.error("Erro no upload: " + (err?.message || "tente novamente"));
      setFotoUrl(null);
      onClear?.();
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadBlob(file);
    e.target.value = "";
  };

  const reset = () => {
    setFotoUrl(null);
    setUploading(false);
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>

      {/* Modal inline da câmera — dentro da árvore React, sem portal */}
      {showCamera && (
        <div className="rounded-xl border border-primary/40 bg-black overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ScanFace className="w-4 h-4 text-primary" /> Webcam
            </div>
            <button type="button" onClick={() => setShowCamera(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
              autoPlay
              onCanPlay={() => setCameraReady(true)}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white/60 text-sm">Iniciando câmera...</span>
              </div>
            )}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-44 h-52 rounded-full border-4 border-green-400 opacity-50" />
              </div>
            )}
          </div>

          <div className="flex gap-2 p-3 bg-card border-t border-border/40">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => setShowCamera(false)}>
              Cancelar
            </Button>
            <Button
              type="button" size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={capture}
              disabled={!cameraReady}
            >
              <ScanFace className="w-3.5 h-3.5 mr-1" />
              {cameraReady ? "Capturar" : "Aguardando..."}
            </Button>
          </div>
        </div>
      )}

      {/* Upload em andamento */}
      {uploading && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card">
          {fotoUrl && <img src={fotoUrl} alt="" className="w-14 h-16 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Enviando foto...
          </div>
        </div>
      )}

      {/* Foto salva */}
      {fotoUrl && !uploading && !showCamera && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
            <img src={fotoUrl} alt="Biometria" className="w-14 h-16 object-cover rounded-lg border border-success/30 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" /> Foto capturada
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">Pronto para salvar</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setShowCamera(true)}
              className="flex items-center justify-center gap-2 py-2 rounded-lg border border-border/60 hover:border-primary/60 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors">
              <Camera className="w-3.5 h-3.5" /> Nova captura
            </button>
            <label className="flex items-center justify-center gap-2 py-2 rounded-lg border border-border/60 hover:border-primary/60 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Trocar foto
              <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
            </label>
          </div>
        </div>
      )}

      {/* Sem foto — opções iniciais */}
      {!fotoUrl && !uploading && !showCamera && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setShowCamera(true)}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group">
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Câmera ao Vivo</div>
              <div className="text-[10px] text-muted-foreground">Captura pela webcam</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Upload Foto</div>
              <div className="text-[10px] text-muted-foreground">Foto da galeria</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
          </label>
        </div>
      )}
    </div>
  );
}