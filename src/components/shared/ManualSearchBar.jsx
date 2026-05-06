import { useState, useRef, useEffect } from "react";
import { Search, X, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

// All manual topics indexed for quick search
const MANUAL_TOPICS = [
  // Citizen
  { profile: "citizen", profileLabel: "Cidadão", title: "Reportar Ocorrências" },
  { profile: "citizen", profileLabel: "Cidadão", title: "Botão de Pânico" },
  { profile: "citizen", profileLabel: "Cidadão", title: "Medida Protetiva" },
  { profile: "citizen", profileLabel: "Cidadão", title: "Denúncia Anônima" },
  { profile: "citizen", profileLabel: "Cidadão", title: "Gamificação & Ranking" },
  { profile: "citizen", profileLabel: "Cidadão", title: "Guia de Primeiros Socorros" },
  // Agent
  { profile: "agent", profileLabel: "Agente", title: "Início de Turno" },
  { profile: "agent", profileLabel: "Agente", title: "Notificações Push de Alta Prioridade" },
  { profile: "agent", profileLabel: "Agente", title: "Gestão de Ocorrências" },
  { profile: "agent", profileLabel: "Agente", title: "Mapa em Tempo Real" },
  { profile: "agent", profileLabel: "Agente", title: "Checklist de Equipamentos" },
  { profile: "agent", profileLabel: "Agente", title: "Missões do Turno" },
  { profile: "agent", profileLabel: "Agente", title: "Rádio Offline & Patrulha Virtual" },
  { profile: "agent", profileLabel: "Agente", title: "Autoavaliação Psicológica" },
  { profile: "agent", profileLabel: "Agente", title: "Capacitação & Certificados" },
  // Psychologist
  { profile: "psychologist", profileLabel: "Psicólogo", title: "Painel do Psicólogo" },
  { profile: "psychologist", profileLabel: "Psicólogo", title: "Avaliações de Bem-estar" },
  { profile: "psychologist", profileLabel: "Psicólogo", title: "Gestão de Consultas" },
  // Admin
  { profile: "admin", profileLabel: "Administrador", title: "Visão Geral & KPIs" },
  { profile: "admin", profileLabel: "Administrador", title: "Gestão de Usuários" },
  { profile: "admin", profileLabel: "Administrador", title: "Painel de Risco de Fadiga" },
  { profile: "admin", profileLabel: "Administrador", title: "Inteligência & Mapas" },
  { profile: "admin", profileLabel: "Administrador", title: "Agentes & Escalas" },
  { profile: "admin", profileLabel: "Administrador", title: "Frota & Equipamentos" },
  { profile: "admin", profileLabel: "Administrador", title: "Vigilância" },
  { profile: "admin", profileLabel: "Administrador", title: "Saúde & RH" },
];

const PROFILE_COLORS = {
  citizen: "text-blue-400",
  agent: "text-cyan-400",
  psychologist: "text-purple-400",
  admin: "text-orange-400",
};

export default function ManualSearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  const filtered = query.trim().length > 1
    ? MANUAL_TOPICS.filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.profileLabel.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (topic) => {
    setQuery("");
    setOpen(false);
    navigate(`/manual?profile=${topic.profile}&section=${encodeURIComponent(topic.title)}`);
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 bg-muted/60 border border-border/60 rounded-lg px-3 h-9 w-48 md:w-64 focus-within:ring-1 focus-within:ring-ring transition-all">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
          placeholder="Buscar no Manual..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }}>
            <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute top-full mt-2 left-0 w-72 bg-card border border-border/60 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground font-medium flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" /> Manual do Sentinela
          </div>
          {filtered.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleSelect(topic)}
              className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{topic.title}</div>
                <div className={`text-xs ${PROFILE_COLORS[topic.profile]}`}>{topic.profileLabel}</div>
              </div>
            </button>
          ))}
          <button
            onClick={() => { setOpen(false); navigate(`/manual?q=${encodeURIComponent(query)}`); }}
            className="w-full text-left px-3 py-2.5 border-t border-border/40 text-xs text-primary hover:bg-muted/40 transition-colors"
          >
            Ver todos os resultados para "{query}" →
          </button>
        </div>
      )}
    </div>
  );
}