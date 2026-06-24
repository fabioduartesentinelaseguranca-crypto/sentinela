import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Search, CheckCircle2, AlertTriangle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

const OFFLINE_KEY = "sentinela_registros_acesso_offline";

function loadOffline() {
  try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]"); } catch { return []; }
}
function saveOffline(list) { localStorage.setItem(OFFLINE_KEY, JSON.stringify(list)); }

function checkDentroHorario(aluno, tipo) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const tol = aluno.tolerancia_minutos || 15;

  const toMin = (s) => { const [h, m] = (s || "00:00").split(":").map(Number); return h * 60 + m; };
  const nowMin = toMin(hhmm);

  if (tipo === "entrada") {
    const entMin = toMin(aluno.horario_entrada);
    return nowMin >= entMin - tol && nowMin <= entMin + tol;
  } else {
    const saiMin = toMin(aluno.horario_saida);
    return nowMin >= saiMin - tol && nowMin <= saiMin + tol;
  }
}

function getMotivoAlerta(aluno, tipo) {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const toMin = (s) => { const [h, m] = (s || "00:00").split(":").map(Number); return h * 60 + m; };
  const nowMin = toMin(hhmm);

  if (tipo === "saida") {
    const saiMin = toMin(aluno.horario_saida);
    if (nowMin < saiMin - (aluno.tolerancia_minutos || 15)) return `Saída antecipada não autorizada (${aluno.horario_saida} previsto)`;
    if (nowMin > saiMin + (aluno.tolerancia_minutos || 15)) return `Atraso crítico na saída (${aluno.horario_saida} previsto)`;
  }
  if (tipo === "entrada") {
    const entMin = toMin(aluno.horario_entrada);
    if (nowMin > entMin + (aluno.tolerancia_minutos || 15)) return `Entrada atrasada (${aluno.horario_entrada} previsto)`;
  }
  return null;
}

export default function RegistroAcessoManual({ escolaId, escolaNome }) {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [registrando, setRegistrando] = useState(null);
  const [ultimosRegistros, setUltimosRegistros] = useState([]);
  const [offlineCount, setOfflineCount] = useState(loadOffline().length);

  useEffect(() => {
    if (escolaId) {
      base44.entities.Alunos_Biometria.filter({ id_escola_cerca: escolaId, ativo: true }).then(setAlunos);
      base44.entities.Registros_Acesso_Escolar.filter({ id_escola_cerca: escolaId }, "-data_hora", 10).then(setUltimosRegistros);
    }

    // Sync offline ao reconectar
    const syncOffline = async () => {
      const pending = loadOffline();
      if (!pending.length || !navigator.onLine) return;
      const failed = [];
      for (const r of pending) {
        try { await base44.entities.Registros_Acesso_Escolar.create({ ...r, pendente_sync: false }); }
        catch { failed.push(r); }
      }
      saveOffline(failed);
      setOfflineCount(failed.length);
      if (pending.length - failed.length > 0) toast.success(`${pending.length - failed.length} registro(s) offline sincronizado(s)!`);
    };
    window.addEventListener("online", syncOffline);
    syncOffline();
    return () => window.removeEventListener("online", syncOffline);
  }, [escolaId]);

  const alunosFiltrados = alunos.filter(a =>
    a.nome?.toLowerCase().includes(busca.toLowerCase()) ||
    a.matricula?.includes(busca)
  );

  const registrar = async (aluno, tipo) => {
    setRegistrando(`${aluno.id}-${tipo}`);
    const dentroHorario = checkDentroHorario(aluno, tipo);
    const motivo = getMotivoAlerta(aluno, tipo);
    const alerta = !!motivo;

    const registro = {
      id_aluno: aluno.id,
      nome_aluno: aluno.nome,
      matricula: aluno.matricula,
      id_escola_cerca: escolaId,
      nome_escola: escolaNome,
      tipo_evento: tipo,
      data_hora: new Date().toISOString(),
      confianca_score: 100, // registro manual = 100%
      metodo: "manual",
      dentro_horario: dentroHorario,
      alerta_disparado: alerta,
      motivo_alerta: motivo || "",
      registrado_por_id: user?.id,
    };

    if (alerta) {
      toast.warning(`⚠️ ALERTA: ${motivo}`, { duration: 6000 });
    }

    if (!navigator.onLine) {
      const pending = loadOffline();
      pending.push({ ...registro, pendente_sync: true });
      saveOffline(pending);
      setOfflineCount(pending.length);
      toast.warning("Sem conexão — registro salvo offline.");
    } else {
      try {
        await base44.entities.Registros_Acesso_Escolar.create(registro);
        toast.success(`${tipo === "entrada" ? "Entrada" : "Saída"} de ${aluno.nome} registrada!`);
        const novos = await base44.entities.Registros_Acesso_Escolar.filter({ id_escola_cerca: escolaId }, "-data_hora", 10);
        setUltimosRegistros(novos);
      } catch {
        toast.error("Erro ao registrar. Salvando offline...");
        const pending = loadOffline();
        pending.push({ ...registro, pendente_sync: true });
        saveOffline(pending);
        setOfflineCount(pending.length);
      }
    }
    setRegistrando(null);
  };

  return (
    <div className="space-y-4">
      {offlineCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warning/10 border border-warning/30 text-xs text-warning">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {offlineCount} registro(s) aguardando sincronização. Verifique a conexão.
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou matrícula..."
          className="w-full pl-9 pr-3 h-9 rounded-lg border border-input bg-transparent text-sm"
        />
      </div>

      {/* Lista de alunos */}
      <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
        {alunosFiltrados.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {busca ? "Nenhum aluno encontrado." : "Nenhum aluno cadastrado nesta escola."}
          </div>
        )}
        {alunosFiltrados.map(a => {
          const keyEnt = `${a.id}-entrada`;
          const keySai = `${a.id}-saida`;
          return (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
              {a.foto_url ? (
                <img src={a.foto_url} alt={a.nome} className="w-10 h-12 object-cover rounded-lg border border-border flex-shrink-0" />
              ) : (
                <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg font-bold text-muted-foreground">
                  {a.nome?.[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{a.nome}</div>
                <div className="text-xs text-muted-foreground">Mat: {a.matricula} · {a.horario_entrada}–{a.horario_saida}</div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-success border-success/30 hover:bg-success/10"
                  disabled={registrando === keyEnt}
                  onClick={() => registrar(a, "entrada")}
                >
                  {registrando === keyEnt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2.5 text-warning border-warning/30 hover:bg-warning/10"
                  disabled={registrando === keySai}
                  onClick={() => registrar(a, "saida")}
                >
                  {registrando === keySai ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Últimos registros */}
      {ultimosRegistros.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Últimos Registros</div>
          <div className="space-y-1.5">
            {ultimosRegistros.map(r => (
              <div key={r.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs border ${r.alerta_disparado ? "border-warning/40 bg-warning/5" : "border-border/40 bg-muted/20"}`}>
                {r.tipo_evento === "entrada"
                  ? <LogIn className="w-3.5 h-3.5 text-success flex-shrink-0" />
                  : <LogOut className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                }
                <span className="font-medium">{r.nome_aluno}</span>
                <span className="text-muted-foreground">{r.tipo_evento}</span>
                <span className="text-muted-foreground ml-auto">{new Date(r.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {r.alerta_disparado && <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" title={r.motivo_alerta} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}