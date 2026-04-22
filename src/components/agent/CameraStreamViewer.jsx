import { useState } from "react";
import { X, Video, VideoOff, Maximize2, Camera, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CameraStreamViewer({ camera, open, onOpenChange }) {
  const [loadError, setLoadError] = useState(false);

  if (!camera) return null;

  const typeLabel = { fixed: "Fixa", dome: "Dome", ptz: "PTZ" }[camera.type] || camera.type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full p-0 overflow-hidden bg-black border-border/60">
        <DialogHeader className="px-4 py-3 bg-card border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="w-4 h-4 text-primary" />
            {camera.name}
            <span className="text-xs font-normal text-muted-foreground ml-1">· {typeLabel}</span>
            {camera.active ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse inline-block" />
                AO VIVO
              </span>
            ) : (
              <span className="ml-auto text-xs text-muted-foreground">INATIVA</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {!camera.stream_url || loadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
              <VideoOff className="w-12 h-12 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {loadError ? "Falha ao carregar o stream" : "Stream não configurado"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {camera.stream_url
                    ? "Verifique se a URL do stream está acessível."
                    : "Configure a URL do stream HLS/WebRTC no cadastro da câmera."}
                </p>
              </div>
              {camera.stream_url && (
                <Button size="sm" variant="outline" onClick={() => setLoadError(false)}>
                  Tentar novamente
                </Button>
              )}
            </div>
          ) : (
            <iframe
              src={camera.stream_url}
              className="w-full h-full border-0"
              allow="camera; microphone; fullscreen; autoplay"
              title={`Stream: ${camera.name}`}
              onError={() => setLoadError(true)}
            />
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-card border-t border-border/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {camera.address && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {camera.address}
              </span>
            )}
            {camera.stream_url && (
              <span className="font-mono truncate max-w-[200px]" title={camera.stream_url}>
                {camera.stream_url}
              </span>
            )}
          </div>
          {camera.stream_url && !loadError && (
            <a
              href={camera.stream_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0"
            >
              <Maximize2 className="w-3 h-3" /> Abrir em nova aba
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}