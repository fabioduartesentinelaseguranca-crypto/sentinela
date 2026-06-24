import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, RotateCcw, CheckCircle2, Loader2,
  AlertTriangle, ScanFace, ShieldCheck, ZoomIn, Sun, User, X
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Fluxo de captura biométrica em 4 etapas:
 *   1. ESCOLHA  — câmera ao vivo ou upload
 *   2. CAPTURA  — câmera com guia oval + liveness detection
 *   3. QUALIDADE — análise de IA com métricas detalhadas e opção de refazer
 *   4. CONFIRMADO — biometria vinculada ao perfil do aluno (via onCapture + alunoId)
 */

const STEP = { ESCOLHA: 0, CAPTURA: 1, QUALIDADE: 2, CONFIRMADO: 3 };

const MIN_QUALITY = 55; // score mínimo para prosseguir sem aviso

function QualityBar({ label, value, icon: Icon, threshold = 50 }) {
  const ok = value >= threshold;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground"><Icon className="w-3 h-3" />{label}</span>
        <span className={ok ? "text-success font-semibold" : "text-warning font-semibold"}>{value}/100</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${ok ? "bg-success" : "bg-warning"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function BiometriaCapturaFace({ onCapture, onClear, alunoId }) {
  const [step, setStep] = useState(STEP.ESCOLHA);
  const [captured, setCaptured] = useState(null);   // { url, blob }
  const [qualidade, setQualidade] = useState(null); // resultado da IA
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [livenessChecks, setLivenessChecks] = useState(0);
  const livenessRef = useRef(0);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const livenessIntervalRef = useRef(null);

  // Limpeza ao desmontar
  useEffect(() => () => {
    stopCamera();
    clearInterval(livenessIntervalRef.current);
  }, []);

  // ── câmera ──────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      livenessRef.current = 0;
      setLivenessChecks(0);
      setStep(STEP.CAPTURA);
      startLiveness();
    } catch {
      toast.error("Câmera não disponível. Use o upload de foto.");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(livenessIntervalRef.current);
  };

  const startLiveness = () => {
    let prevFrame = null;
    livenessIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      const ctx = canvas.getContext("2d");
      canvas.width = 64; canvas.height = 48;
      ctx.drawImage(video, 0, 0, 64, 48);
      const frame = ctx.getImageData(0, 0, 64, 48).data;
      if (prevFrame) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prevFrame[i]);
        if (diff > 45000 && livenessRef.current < 3) {
          livenessRef.current++;
          setLivenessChecks(livenessRef.current);
        }
      }
      prevFrame = frame;
      if (livenessRef.current >= 3) clearInterval(livenessIntervalRef.current);
    }, 500);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = 640; canvas.height = 480;
    canvas.getContext("2d").drawImage(video, 0, 0, 640, 480);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      stopCamera();
      processImage(blob, url);
    }, "image/jpeg", 0.92);
  };

  // ── upload ──────────────────────────────────────────────
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem válida."); return; }
    const url = URL.createObjectURL(file);
    processImage(file, url);
  };

  // ── análise de qualidade via IA ──────────────────────────
  const processImage = async (blob, localUrl) => {
    setCaptured({ blob, url: localUrl });
    setProcessing(true);
    setStep(STEP.QUALIDADE);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema de verificação de qualidade de imagem biométrica facial para cadastro escolar.
Analise a foto recebida com critério técnico e retorne:

1. face_detected (boolean): há um rosto humano visível?
2. score_geral (0-100): qualidade geral da imagem para biometria
3. score_nitidez (0-100): foto está nítida/em foco? (≥60 é aceitável)
4. score_iluminacao (0-100): iluminação adequada, sem sombras severas? (≥60 é aceitável)
5. score_enquadramento (0-100): rosto centralizado e em tamanho adequado? (≥60 é aceitável)
6. score_expressao (0-100): expressão neutra, olhos abertos? (≥60 é aceitável)
7. embedding (array de 128 números entre -1 e 1): vetor de características faciais
8. problemas (array de strings): lista curta dos principais problemas encontrados (max 3)
9. aprovada (boolean): true se score_geral >= 55 e face_detected = true

Seja criterioso. Se não houver rosto humano claro, retorne face_detected: false e aprovada: false.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            score_geral: { type: "number" },
            score_nitidez: { type: "number" },
            score_iluminacao: { type: "number" },
            score_enquadramento: { type: "number" },
            score_expressao: { type: "number" },
            embedding: { type: "array", items: { type: "number" } },
            problemas: { type: "array", items: { type: "string" } },
            aprovada: { type: "boolean" }
          }
        }
      });

      setQualidade({ ...result, file_url });
    } catch {
      toast.error("Erro ao analisar imagem. Tente novamente.");
      reset();
    }
    setProcessing(false);
  };

  // ── confirmação e vinculação ao perfil no banco ──────────
  const confirmar = async () => {
    if (!qualidade?.file_url) return;
    setSaving(true);
    try {
      // Se temos o ID do aluno, atualiza diretamente no banco
      if (alunoId) {
        await base44.entities.Alunos_Biometria.update(alunoId, {
          foto_url: qualidade.file_url,
          face_embedding: qualidade.embedding || [],
        });
        toast.success("Biometria vinculada ao perfil do aluno!");
      }
      // Sempre notifica o componente pai
      onCapture({
        fotoUrl: qualidade.file_url,
        embedding: qualidade.embedding || [],
        qualidade: qualidade.score_geral,
      });
      setStep(STEP.CONFIRMADO);
    } catch {
      toast.error("Erro ao vincular biometria. Tente novamente.");
    }
    setSaving(false);
  };

  const reset = () => {
    stopCamera();
    setCaptured(null);
    setQualidade(null);
    setLivenessChecks(0);
    livenessRef.current = 0;
    setStep(STEP.ESCOLHA);
    onClear?.();
  };

  // ── indicador de progresso ───────────────────────────────
  const stepLabels = ["Método", "Captura", "Qualidade", "Confirmado"];
  const stepLine = (
    <div className="flex items-center gap-1 mb-4">
      {stepLabels.map((label, i) => (
        <div key={i} className="flex items-center gap-1 flex-1">
          <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-primary" : "bg-border"} ${i === 0 ? "hidden" : ""}`} />
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium whitespace-nowrap ${
            i === step ? "bg-primary text-primary-foreground" :
            i < step ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
          }`}>
            {i < step && <CheckCircle2 className="w-3 h-3" />}
            {label}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foto Biométrica *</div>
      <canvas ref={canvasRef} className="hidden" />

      {step > STEP.ESCOLHA && stepLine}

      {/* ── ETAPA 0: ESCOLHA ── */}
      {step === STEP.ESCOLHA && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startCamera}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group"
          >
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div>
              <div className="text-sm font-medium">Câmera ao Vivo</div>
              <div className="text-[10px] text-muted-foreground text-center mt-0.5">Com guia facial e detecção de vivacidade</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div>
              <div className="text-sm font-medium">Upload Foto</div>
              <div className="text-[10px] text-muted-foreground text-center mt-0.5">Foto 3x4 da galeria ou arquivos</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
          <div className="col-span-2 text-[10px] text-muted-foreground text-center">
            A foto será analisada por IA para verificar qualidade, centralização e iluminação antes de ser salva.
          </div>
        </div>
      )}

      {/* ── ETAPA 1: CAPTURA (câmera) ── */}
      {step === STEP.CAPTURA && (
        <div className="space-y-2">
          <div className="relative rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

            {/* Overlay escuro + oval aberto no centro */}
            <div className="absolute inset-0 pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <mask id="oval-mask">
                    <rect width="640" height="480" fill="white" />
                    <ellipse cx="320" cy="230" rx="140" ry="175" fill="black" />
                  </mask>
                </defs>
                <rect width="640" height="480" fill="rgba(0,0,0,0.55)" mask="url(#oval-mask)" />
                <ellipse cx="320" cy="230" rx="140" ry="175" fill="none"
                  stroke={livenessChecks >= 3 ? "#22c55e" : "#38bdf8"}
                  strokeWidth="3" />
              </svg>
            </div>

            {/* Instrução central */}
            <div className="absolute top-3 left-0 right-0 flex justify-center">
              <div className="bg-black/65 px-3 py-1.5 rounded-lg text-xs text-white flex items-center gap-2">
                {livenessChecks >= 3
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-success" /><span className="text-success">Vivacidade confirmada — pode capturar</span></>
                  : <><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><span>Mova levemente a cabeça ({livenessChecks}/3)...</span></>
                }
              </div>
            </div>

            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
              <Button size="sm" variant="outline" onClick={reset} className="bg-black/60 border-white/20 text-white hover:bg-black/80">
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={captureFromCamera} disabled={livenessChecks < 2} className="bg-primary">
                <ScanFace className="w-3.5 h-3.5 mr-1" /> Capturar
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Posicione o rosto no óvalo e aguarde confirmar vivacidade</p>
        </div>
      )}

      {/* ── ETAPA 2: QUALIDADE ── */}
      {step === STEP.QUALIDADE && (
        <div className="space-y-3">
          {/* Preview da foto */}
          {captured?.url && (
            <div className="flex gap-3 items-start">
              <img
                src={captured.url}
                alt="Foto capturada"
                className="w-24 h-30 object-cover rounded-xl border border-border flex-shrink-0"
                style={{ height: 120 }}
              />
              <div className="flex-1 space-y-2">
                {processing ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span>Analisando qualidade da imagem...</span>
                    <span className="text-[10px]">Verificando rosto, nitidez, iluminação e enquadramento</span>
                  </div>
                ) : qualidade ? (
                  <>
                    {/* Status geral */}
                    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium ${
                      qualidade.aprovada ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>
                      {qualidade.aprovada
                        ? <><ShieldCheck className="w-4 h-4" /> Imagem aprovada ({qualidade.score_geral}/100)</>
                        : <><AlertTriangle className="w-4 h-4" /> {qualidade.face_detected ? `Qualidade insuficiente (${qualidade.score_geral}/100)` : "Nenhum rosto detectado"}</>
                      }
                    </div>

                    {/* Métricas individuais */}
                    {qualidade.face_detected && (
                      <div className="space-y-1.5">
                        <QualityBar label="Nitidez" value={qualidade.score_nitidez ?? 0} icon={ZoomIn} threshold={60} />
                        <QualityBar label="Iluminação" value={qualidade.score_iluminacao ?? 0} icon={Sun} threshold={60} />
                        <QualityBar label="Enquadramento" value={qualidade.score_enquadramento ?? 0} icon={Camera} threshold={60} />
                        <QualityBar label="Expressão" value={qualidade.score_expressao ?? 0} icon={User} threshold={60} />
                      </div>
                    )}

                    {/* Problemas detectados */}
                    {qualidade.problemas?.length > 0 && (
                      <div className="space-y-1">
                        {qualidade.problemas.map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-warning">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />{p}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          )}

          {/* Ações */}
          {!processing && qualidade && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Refazer Foto
              </Button>
              {qualidade.face_detected ? (
                <Button size="sm" onClick={confirmar} disabled={saving} className="flex-1">
                  {saving
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  }
                  {qualidade.aprovada ? "Confirmar Biometria" : "Usar Mesmo Assim"}
                </Button>
              ) : (
                <Button size="sm" onClick={reset} className="flex-1 bg-destructive hover:bg-destructive/90">
                  <Camera className="w-3.5 h-3.5 mr-1.5" /> Tirar Novamente
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ETAPA 3: CONFIRMADO ── */}
      {step === STEP.CONFIRMADO && qualidade && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
          <img
            src={captured?.url}
            alt="Biometria"
            className="w-14 h-18 object-cover rounded-lg border border-success/30 flex-shrink-0"
            style={{ height: 72 }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" /> Biometria vinculada ao perfil
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Score de qualidade: <strong>{qualidade.score_geral}/100</strong> · Embedding de {(qualidade.embedding || []).length} dimensões
            </div>
            {alunoId && (
              <div className="text-[10px] text-success/80 mt-0.5">Salvo automaticamente no banco de dados</div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reset} title="Refazer biometria">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}