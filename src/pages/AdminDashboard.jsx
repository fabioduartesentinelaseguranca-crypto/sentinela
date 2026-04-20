import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/shared/StatCard";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Users, FileText, ShieldCheck, Trophy, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminDashboard() {
  const [occurrences, setOccurrences] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);

  const load = async () => {
    const [occs, allUsers] = await Promise.all([
      base44.entities.Occurrence.list("-created_date", 200),
      base44.entities.User.list("-created_date", 100),
    ]);
    setOccurrences(occs);
    setUsers(allUsers);
    setPendingDocs(allUsers.filter((u) => u.protective_measure_status === "pending"));
  };

  useEffect(() => { load(); }, []);

  const approveDoc = async (u) => {
    await base44.entities.User.update(u.id, { protective_measure_status: "active" });
    toast.success(`Medida protetiva de ${u.full_name} aprovada`);
    load();
  };

  const rejectDoc = async (u) => {
    await base44.entities.User.update(u.id, { protective_measure_status: "none" });
    toast.info(`Medida protetiva de ${u.full_name} rejeitada`);
    load();
  };

  const setRole = async (u, role) => {
    await base44.entities.User.update(u.id, { role });
    toast.success(`${u.full_name} → ${role}`);
    load();
  };

  const openCount = occurrences.filter((o) => o.status === "open").length;
  const resolvedCount = occurrences.filter((o) => o.status === "resolved").length;
  const citizenCount = users.filter((u) => u.role === "citizen" || !u.role).length;
  const agentCount = users.filter((u) => u.role === "agent").length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma Sentinela.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Ocorrências abertas" value={openCount} icon={AlertTriangle} accent="warning" />
        <StatCard label="Resolvidas" value={resolvedCount} icon={CheckCircle2} accent="success" />
        <StatCard label="Cidadãos" value={citizenCount} icon={Users} />
        <StatCard label="Agentes" value={agentCount} icon={ShieldCheck} accent="primary" />
      </div>

      {/* Pending protective measures */}
      {pendingDocs.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4 text-warning">
            <Clock className="w-4 h-4" /> Medidas Protetivas Pendentes ({pendingDocs.length})
          </h2>
          <div className="space-y-2">
            {pendingDocs.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/60">
                <div>
                  <div className="text-sm font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                  {u.protective_measure_doc_url && (
                    <a href={u.protective_measure_doc_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline">Ver documento →</a>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveDoc(u)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => rejectDoc(u)}>
                    Rejeitar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User management */}
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-primary" /> Gestão de Usuários
        </h2>
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Cadastro</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                    {format(new Date(u.created_date), "dd/MM/yy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {["citizen", "agent", "admin"].map((r) => (
                        <button
                          key={r}
                          onClick={() => setRole(u, r)}
                          className={`text-[10px] uppercase px-2 py-1 rounded font-medium transition-colors ${
                            (u.role || "citizen") === r
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{u.points || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent occurrences */}
      <div>
        <h2 className="font-semibold flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-primary" /> Ocorrências Recentes
        </h2>
        <div className="space-y-2">
          {occurrences.slice(0, 10).map((o) => {
            const tm = TYPE_META[o.type] || TYPE_META.crime;
            const sm = STATUS_META[o.status || "open"];
            const Icon = tm.icon;
            return (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
                <div className={`w-8 h-8 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{o.subtype || tm.label}</span>
                  {o.address && <span className="text-xs text-muted-foreground ml-2">{o.address}</span>}
                </div>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>{sm.label}</span>
                <span className="text-[11px] text-muted-foreground font-mono hidden md:block">{format(new Date(o.created_date), "dd/MM HH:mm")}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}