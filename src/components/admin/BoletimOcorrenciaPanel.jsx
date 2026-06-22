import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Edit3, CheckCircle2, X, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function BoletimOcorrenciaPanel({ alertaId }) {
  const [bo, setBo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!alertaId) return;
    (async () => {
      const list = await base44.entities.Boletins_Ocorrencia_Gerados.filter({ id_alerta: alertaId }, "-data_emissao", 1);
      setBo(list?.[0] || null);
      if (list?.[0]) setEditedText(list[0].texto_revisado_bo || list[0].texto_juridico_bo || "");
      setLoading(false);
    })();
  }, [alertaId]);

  const gerarBo = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("gerarBoletimOcorrencia", { alerta_id: alertaId });
      if (res.data?.success) {
        toast.success("Boletim de Ocorrência gerado com sucesso!");
        const novo = await base44.entities.Boletins_Ocorrencia_Gerados.get(res.data.bo_id);
        setBo(novo);
        setEditedText(novo.texto_juridico_bo || "");
      }
    } catch (e) {
      toast.error("Erro ao gerar BO. Tente novamente.");
    }
    setGenerating(false);
  };

  const aprovarAssinar = async () => {
    if (!bo) return;
    setSigning(true);
    try {
      const me = await base44.auth.me();
      await base44.entities.Boletins_Ocorrencia_Gerados.update(bo.id, {
        status_assinatura: "assinado",
        assinatura_agente_responsavel: me.full_name,
        assinatura_agente_id: me.id,
        texto_revisado_bo: editedText,
      });
      setBo((b) => ({ ...b, status_assinatura: "assinado", assinatura_agente_responsavel: me.full_name, texto_revisado_bo: editedText }));
      setEditing(false);
      toast.success("BO aprovado e assinado eletronicamente!");
    } catch {
      toast.error("Erro ao assinar. Tente novamente.");
    }
    setSigning(false);
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  if (!bo && !generating) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
        <div>
          <p className="text-sm font-medium">Nenhum Boletim de Ocorrência gerado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Gere automaticamente um BO jurídico com base nos dados compilados deste alerta.
          </p>
        </div>
        <Button onClick={gerarBo} disabled={generating} size="sm">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
          {generating ? "Gerando via IA..." : "Gerar BO com IA"}
        </Button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-medium">Gerando Boletim de Ocorrência...</p>
        <p className="text-xs text-muted-foreground">O Superagent Claude Sonnet está analisando os dados e redigindo o documento jurídico.</p>
      </div>
    );
  }

  const statusBadge = bo.status_assinatura === "assinado"
    ? { color: "text-success bg-success/10", icon: CheckCircle2, label: "Assinado" }
    : { color: "text-warning bg-warning/10", icon: Clock, label: "Rascunho" };

  const StatusIcon = statusBadge.icon;
  const displayText = editedText || bo.texto_juridico_bo || "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Boletim de Ocorrência</span>
          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded flex items-center gap-1 font-medium ${statusBadge.color}`}>
            <StatusIcon className="w-3 h-3" /> {statusBadge.label}
          </span>
        </div>
        <div className="flex gap-2">
          {bo.status_assinatura !== "assinado" && (
            <>
              <Button size="sm" variant="outline" onClick={() => { setEditing(!editing); setEditedText(displayText); }}>
                <Edit3 className="w-3 h-3 mr-1" /> {editing ? "Cancelar Edição" : "Editar"}
              </Button>
              <Button size="sm" onClick={aprovarAssinar} disabled={signing}>
                {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Aprovar e Assinar
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="w-full min-h-[400px] p-4 rounded-xl border border-border bg-background text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Edite o texto do Boletim de Ocorrência..."
        />
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-5 max-h-[500px] overflow-y-auto">
          <pre className="text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed">{displayText}</pre>
        </div>
      )}

      {bo.assinatura_agente_responsavel && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
          <CheckCircle2 className="w-3 h-3 text-success" />
          Assinado por: <span className="font-medium text-foreground">{bo.assinatura_agente_responsavel}</span>
          {bo.data_emissao && <span>· {new Date(bo.data_emissao).toLocaleString("pt-BR")}</span>}
        </div>
      )}
    </div>
  );
}