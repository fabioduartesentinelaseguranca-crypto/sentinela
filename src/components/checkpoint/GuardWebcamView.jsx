import { Button } from "@/components/ui/button";
import { Loader2, Camera, CameraOff, Video, ScanFace, Radio, Cpu } from "lucide-react";

export default function GuardWebcamView({ videoRef, status, detection, facePresent, processing, localMatch, initProgress, onStart, onStop }) {
  const isLive = status === "ready";
  const localMatchLabel = localMatch?.label || (localMatch?.message ? null : null);

  return (
    <div className="rounded-2xl border border-border/60 bg-black overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border/60">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Checkpoint — Pipeline Local (MediaPipe + face-api)</span>
          {isLive && <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> AO VIVO</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-success font-medium"><span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Câmera Conectada</span>
          ) : status === "no_camera" ? (
            <span className="flex items-center gap-1.5 text-destructive font-medium"><CameraOff className="w-3.5 h-3.5" /> Permissão Negada</span>
          ) : status === "error" ? (
            <span className="text-destructive font-medium">Erro ao carregar IA</span>
          ) : status === "loading_models" ? (
            <span className="flex items-center gap-1.5 text-primary"><Cpu className="w-3.5 h-3.5 animate-pulse" /> Inicializando IA {initProgress || 0}%</span>
          ) : (
            <span className="text-muted-foreground">Câmera inativa</span>
          )}
        </div>
      </div>

      <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

        {isLive && (
          <>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-60 rounded-3xl border-4 border-primary/40 border-dashed" />
            </div>
            {detection && (
              <div className="absolute border-2 border-success/80 rounded-lg shadow-[0_0_12px_rgba(34,197,94,0.4)]"
                style={{ left: `${detection.x * 100}%`, top: `${detection.y * 100}%`, width: `${detection.w * 100}%`, height: `${detection.h * 100}%` }} />
            )}
            <div className="absolute top-3 left-3 bg-black/70 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <ScanFace className={`w-3.5 h-3.5 ${facePresent ? "text-success" : "text-muted-foreground"}`} />
              <span className={`text-xs font-medium ${facePresent ? "text-success" : "text-muted-foreground"}`}>
                {facePresent ? "Rosto detectado (MediaPipe)" : "Aguardando rosto..."}
              </span>
            </div>
            <div className="absolute top-3 right-3 bg-black/70 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-mono">20 FPS · LOCAL</span>
            </div>
            {localMatchLabel && (
              <div className="absolute bottom-3 left-3 bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold">
                Match local: {localMatchLabel} · {localMatch.sim}%
              </div>
            )}
            {processing && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> face-api extraindo descriptor...
              </div>
            )}
          </>
        )}

        {!isLive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            {status === "loading_models" ? (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <span className="text-sm font-medium">Inicializando IA local...</span>
                <div className="w-56 h-1.5 bg-border rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${initProgress || 0}%` }} />
                </div>
                <span className="text-[11px]">Carregando MediaPipe WASM + modelos face-api</span>
              </>
            ) : status === "no_camera" ? (
              <><CameraOff className="w-12 h-12 text-destructive" /><span className="text-sm text-destructive font-medium">Acesso à câmera negado</span><span className="text-xs">Permita a câmera nas permissões do navegador.</span></>
            ) : status === "error" ? (
              <><CameraOff className="w-12 h-12 text-destructive" /><span className="text-sm text-destructive">Falha ao carregar IA local</span></>
            ) : (
              <><Camera className="w-12 h-12 opacity-30" /><span className="text-sm">Câmera inativa</span><span className="text-xs">Inicie o monitoramento do checkpoint.</span></>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-card border-t border-border/60 flex gap-2">
        {isLive ? (
          <Button variant="outline" className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={onStop}>Parar Monitoramento</Button>
        ) : (
          <Button className="flex-1" onClick={onStart} disabled={status === "loading_models"}>
            <Camera className="w-4 h-4 mr-2" /> Iniciar Checkpoint
          </Button>
        )}
      </div>
    </div>
  );
}