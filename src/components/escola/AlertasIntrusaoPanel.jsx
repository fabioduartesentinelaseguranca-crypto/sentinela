import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  ShieldAlert, Clock, CheckCircle2, AlertTriangle, Lock, Unlock,
  Eye, Loader2, Radio, XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const TIPO_LABEL = {
  blacklist_match: { label: "Match Blacklist", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  suspeito_permanencia: { label: "Suspeito na Entrada", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  acesso_fora_horario: { label: "Acesso Fora do Horário", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  anti_spoofing: { label: "Tentativa de Falsificação", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" },
  visitante_sem_os: { label: "Visitante sem OS Ativa", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  panico_operador: { label: "Pânico — Operador", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

const STATUS_STYLE = {
  ativo: "text-red-400 bg-red-500/10",
  em_atendimento: "text-yellow-400 bg-yellow-500/10",
  resolvido: "text-success bg-success/10",
  falso_positivo: "text-muted-foreground bg-muted",
};

function ElapsedTime({ dateStr }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
      if (diff < 60) setElapsed(`${diff}s atrás`);
      else if (diff < 3600) setElapsed(`${Math.floor(diff / 60)}min atrás`);
      else setElapsed(`${Math.floor(diff / 3600)}h atrás`);
    };
    calc();
    const id = setInterval(calc, 10000);
    return () => clearInterval(id);
  }, [dateStr]);
  return <span className="text-[10px] text-muted-foreground">{elapsed}</span>;
}

export default function AlertasIntrusaoPanel() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("ativo");
  const [bloqueioAtivo, setBloqueioAtivo] = useState(false);

  const load = async () => {
    const q = filtro === "todos" ? {} : { status: filtro };
    const data = await base44.entities.Alertas_Intrusao_Escolar.filter(q, "-created_date", 50);
    setAlertas(data);
    setLoading(false);
    setBloqueioAtivo(data.some(a => a.bloqueio_ativo && a.status === "ativo"));
  };

  useEffect(() => { load(); }, [filtro]);

  // Subscrição em tempo real
  useEffect(() => {
    const unsub = base44.entities.Alertas_Intrusao_Escolar.subscribe(() => load());
    return unsub;
  }, [filtro]);

  const atender = async (alerta) => {
    await base44.entities.Alertas_Intrusao_Escolar.update(alerta.id, {
      status: "em_atendimento",
      atendido_por_id: user?.id,
      atendido_por_nome: user?.full_name,
    });
    load();
  };

  const resolver = async (alerta, status = "resolvido") => {
    await base44.entities.Alertas_Intrusao_Escolar.update(alerta.id, {
      status,
      bloqueio_ativo: false,
    });
    load();
    toast.success(status === "resolvido" ? "Alerta resolvido." : "Marcado como falso positivo.");
  };

  // Simulação de disparo de pânico pelo operador
  const panico = async () => {
    await base44.entities.Alertas_Intrusao_Escolar.create({
      tipo_alerta: "panico_operador",
      nivel: "vermelho",
      descricao: `Pânico acionado manualmente por ${user?.full_name}`,
      horario_tentativa: new Date().toISOString(),
      status: "ativo",
      bloqueio_ativo: true,
    });
    setBloqueioAtivo(true);
    toast.error("🔴 ALERTA DE PÂNICO DISPARADO — Sinal de bloqueio enviado!", { duration: 8000 });
    load();
  };

  const liberarBloqueio = async () => {
    // Desativa todos os bloqueios ativos
    await Promise.all(
      alertas.filter(a => a.bloqueio_ativo).map(a =>
        base44.entities.Alertas_Intrusao_Escolar.update(a.id, { bloqueio_ativo: false })
      )
    );
    setBloqueioAtivo(false);
    toast.success("Sinal de bloqueio liberado.");
    load();
  };

  const ativos = alertas.filter(a => a.status === "ativo").length;

  return (
    <div className="space-y-4">
      {/* Header + botão pânico */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" />
            Central de Alertas de Intrusão
            {ativos > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                {ativos} ATIVO{ativos > 1 ? "S" : ""}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">Alertas de segurança em tempo real das cercas escolares.</p>
        </div>
        <div className="flex gap-2">
          {bloqueioAtivo ? (
            <Button size="sm" variant="outline" onClick={liberarBloqueio} className="border-success/40 text-success hover:bg-success/10">
              <Unlock className="w-3.5 h-3.5 mr-1.5" /> Liberar Acesso
            </Button>
          ) : (
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={panico}>
              <Lock className="w-3.5 h-3.5 mr-1.5" /> 🔴 Pânico — Bloquear Tudo
            </Button>
          )}
        </div>
      </div>

      {/* Indicador de bloqueio ativo */}
      {bloqueioAtivo && (
        <div className="rounded-xl border border-red-500 bg-red-500/10 p-3 flex items-center gap-3 animate-pulse">
          <Lock className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <div className="font-semibold text-red-400 text-sm">⚠ SINAL DE BLOQUEIO FÍSICO ATIVO</div>
            <div className="text-xs text-muted-foreground">Catracas, portões e portas magnéticas estão bloqueados. Aguardando autorização para liberar.</div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {["ativo", "em_atendimento", "resolvido", "todos"].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filtro === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            {f === "todos" ? "Todos" : f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : alertas.length === 0 ? (
        <div className="py-10 text-center border border-dashed border-border rounded-xl text-muted-foreground">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum alerta {filtro !== "todos" ? `com status "${filtro}"` : ""}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map(alerta => {
            const tipo = TIPO_LABEL[alerta.tipo_alerta] || { label: alerta.tipo_alerta, color: "text-muted-foreground", bg: "bg-muted" };
            return (
              <div key={alerta.id} className={`rounded-xl border p-3 space-y-2 ${tipo.bg}`}>
                <div className="flex items-start gap-3">
                  {alerta.foto_captura_url && (
                    <img src={alerta.foto_captura_url} alt="" className="w-10 h-12 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold ${tipo.color}`}>{tipo.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[alerta.status]}`}>
                        {alerta.status.replace(/_/g, " ")}
                      </span>
                      {alerta.bloqueio_ativo && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alerta.descricao}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {alerta.nome_escola && <span className="text-[10px] text-muted-foreground">{alerta.nome_escola}</span>}
                      {alerta.similaridade_blacklist && (
                        <span className="text-[10px] text-red-400 font-semibold">
                          Similaridade: {alerta.similaridade_blacklist}%
                        </span>
                      )}
                      {alerta.tempo_permanencia_seg && (
                        <span className="text-[10px] text-orange-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {alerta.tempo_permanencia_seg}s no frame
                        </span>
                      )}
                      {alerta.horario_tentativa && <ElapsedTime dateStr={alerta.horario_tentativa} />}
                    </div>
                  </div>
                </div>

                {/* Ações */}
                {alerta.status === "ativo" && (
                  <div className="flex gap-2 pt-1 border-t border-white/10">
                    <Button size="sm" variant="outline" onClick={() => atender(alerta)} className="flex-1 h-7 text-xs">
                      <Eye className="w-3 h-3 mr-1" /> Atender
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => resolver(alerta)} className="flex-1 h-7 text-xs border-success/40 text-success hover:bg-success/10">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Resolver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolver(alerta, "falso_positivo")} className="h-7 text-xs text-muted-foreground">
                      <XCircle className="w-3 h-3 mr-1" /> Falso Positivo
                    </Button>
                  </div>
                )}
                {alerta.status === "em_atendimento" && (
                  <div className="flex gap-2 pt-1 border-t border-white/10">
                    <Button size="sm" onClick={() => resolver(alerta)} className="flex-1 h-7 text-xs bg-success hover:bg-success/90">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Marcar Resolvido
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => resolver(alerta, "falso_positivo")} className="h-7 text-xs">
                      <XCircle className="w-3 h-3 mr-1" /> Falso Positivo
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}