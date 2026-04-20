import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Upload, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  none: { label: "Não cadastrada", color: "text-muted-foreground", bg: "bg-muted", icon: ShieldCheck },
  pending: { label: "Em análise", color: "text-warning", bg: "bg-warning/15", icon: Clock },
  active: { label: "Ativa", color: "text-success", bg: "bg-success/15", icon: CheckCircle2 },
  inactive: { label: "Inativa", color: "text-muted-foreground", bg: "bg-muted", icon: AlertCircle },
};

export default function ProtectiveMeasureCard({ user, onUpdated }) {
  const [uploading, setUploading] = useState(false);
  const status = user?.protective_measure_status || "none";
  const meta = STATUS[status];
  const Icon = meta.icon;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({
        protective_measure_doc_url: file_url,
        protective_measure_status: "pending",
      });
      toast.success("Documento enviado. Aguardando validação pelo Admin.");
      onUpdated?.();
    } catch (err) {
      toast.error("Erro no envio: " + err.message);
    }
    setUploading(false);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Medida Protetiva
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Envie o PDF ou foto do documento para ativar o botão de pânico.
          </p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.color}`}>
          <Icon className="w-3 h-3" />
          {meta.label}
        </div>
      </div>

      {status === "active" ? (
        <div className="text-sm text-success">
          Sua medida protetiva está validada. O botão de pânico está disponível.
        </div>
      ) : status === "pending" ? (
        <div className="text-sm text-muted-foreground">
          Seu documento está sendo analisado. Você será notificado após a validação.
        </div>
      ) : (
        <label className="block">
          <div className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Enviar PDF ou foto do documento</span>
              </>
            )}
          </div>
          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  );
}