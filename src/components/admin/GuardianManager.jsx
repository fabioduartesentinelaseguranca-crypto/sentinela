import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ShieldCheck, ShieldX, Star, MapPin, Phone, Search, X, CheckCircle2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function GuardianManager() {
  const [guardians, setGuardians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pendente");
  const [search, setSearch] = useState("");

  const load = async () => {
    const list = await base44.entities.Anjos_Guarda.list("-created_date", 200);
    setGuardians(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (g) => {
    const me = await base44.auth.me();
    await base44.entities.Anjos_Guarda.update(g.id, {
      status: "aprovado",
      aprovado_por_id: me.id,
      aprovado_por_nome: me.full_name,
    });
    toast.success(`${g.user_name} aprovado como Anjo da Guarda`);
    load();
  };

  const suspend = async (g) => {
    await base44.entities.Anjos_Guarda.update(g.id, { status: "suspenso" });
    toast.info(`${g.user_name} suspenso`);
    load();
  };

  const reactivate = async (g) => {
    await base44.entities.Anjos_Guarda.update(g.id, { status: "aprovado" });
    toast.success(`${g.user_name} reativado`);
    load();
  };

  const filtered = guardians.filter((g) => {
    if (filter !== "todos" && g.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!g.user_name?.toLowerCase().includes(q) && !g.bairro?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statusColor = {
    pendente: "text-warning bg-warning/10",
    aprovado: "text-success bg-success/10",
    suspenso: "text-destructive bg-destructive/10",
    inativo: "text-muted-foreground bg-muted",
  };

  const countByStatus = (s) => guardians.filter((g) => g.status === s).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-success" /> Anjos da Guarda
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou bairro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm w-48"
            />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos ({guardians.length})</SelectItem>
              <SelectItem value="pendente">Pendentes ({countByStatus("pendente")})</SelectItem>
              <SelectItem value="aprovado">Aprovados ({countByStatus("aprovado")})</SelectItem>
              <SelectItem value="suspenso">Suspensos ({countByStatus("suspenso")})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-xl">
          <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum Anjo da Guarda encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((g) => (
            <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-success" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{g.user_name}</div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {g.telefone && <span className="flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" /> {g.telefone}</span>}
                    {g.bairro && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {g.bairro}</span>}
                    <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 text-warning" /> {g.avaliacao_media?.toFixed(1)}</span>
                    <span>· {g.total_atendimentos || 0} atend.</span>
                  </div>
                  {g.certificacoes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {g.certificacoes.map((c, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-medium ${statusColor[g.status] || ""}`}>
                  {g.status}
                </span>
                {g.status === "pendente" && (
                  <Button size="sm" onClick={() => approve(g)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                  </Button>
                )}
                {g.status === "aprovado" && (
                  <Button size="sm" variant="destructive" onClick={() => suspend(g)}>
                    <ShieldX className="w-3 h-3 mr-1" /> Suspender
                  </Button>
                )}
                {g.status === "suspenso" && (
                  <Button size="sm" variant="outline" onClick={() => reactivate(g)}>
                    <ShieldCheck className="w-3 h-3 mr-1" /> Reativar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}