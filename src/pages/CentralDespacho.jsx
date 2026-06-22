import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Siren, Clock, MapPin, Phone, Shield, Crosshair, PhoneCall, Flag, ChevronRight, AlertTriangle, Radio, Zap, Navigation, Volume2, FileText, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Constantes ──────────────────────────────────────────────
const PRIORITY_ORDER = { "CRÍTICO_RISCO_MORTE": 0, "ALTO": 1, "MÉDIO": 2, "BAIXO": 3 };
const PRIORITY_COLORS = {
  "CRÍTICO_RISCO_MORTE": { bg: "bg-red-950/60", border: "border-red-500", text: "text-red-400", badge: "bg-red-600 text-white", pulse: true },
  "ALTO": { bg: "bg-orange-950/40", border: "border-orange-500", text: "text-orange-400", badge: "bg-orange-600 text-white", pulse: false },
  "MÉDIO": { bg: "bg-yellow-950/30", border: "border-yellow-600", text: "text-yellow-400", badge: "bg-yellow-600 text-black", pulse: false },
  "BAIXO": { bg: "bg-blue-950/20", border: "border-blue-700", text: "text-blue-400", badge: "bg-blue-600 text-white", pulse: false },
};

const STATUS_LABELS = {
  "TRIAGEM_IA": "Triagem IA",
  "DESPACHADO_POLICIA": "Despachado",
  "EM_ANDAMENTO": "Em Andamento",
  "FINALIZADO": "Finalizado",
  "SUSPEITA_TROTE": "Suspeita de Trote",
};

const GATILHO_LABELS = {
  "CALCULADORA_PANICO": "Calculadora de Pânico",
  "SENHA_COERCAO": "Senha de Coerção",
  "DESVIO_ROTA": "Desvio de Rota",
};

// ─── Sub-componentes ─────────────────────────────────────────

// Cronômetro de tempo decorrido
function ElapsedTimer({ timestamp }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => {
      if (!timestamp) return;
      setElapsed(Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="font-mono text-xs tabular-nums">
      {m > 0 ? `Há ${m}min ${s}s` : `Há ${s} segundos`}
    </span>
  );
}

// Cartão de alerta na fila
function AlertCard({ alerta, isSelected, onClick }) {
  const colors = PRIORITY_COLORS[alerta.grau_prioridade_ia] || PRIORITY_COLORS["BAIXO"];
  return (
    <button
      onClick={() => onClick(alerta)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200
        ${colors.bg} ${isSelected ? `${colors.border} ring-2 ring-offset-1 ring-offset-[#121212] ${colors.border}` : "border-transparent hover:border-white/10"}
        ${colors.pulse && !isSelected ? "animate-pulse" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Siren className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
          <span className={`text-xs font-bold uppercase ${colors.text}`}>{alerta.grau_prioridade_ia?.replace(/_/g, " ")}</span>
        </div>
        {alerta.data_hora_brasilia && (
          <span className="text-[11px] text-gray-500 flex items-center gap-1 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <ElapsedTimer timestamp={alerta.data_hora_brasilia} />
          </span>
        )}
      </div>
      <div className="text-white font-semibold text-sm mb-1 truncate">
        {GATILHO_LABELS[alerta.tipo_gatilho] || alerta.tipo_gatilho}
      </div>
      <div className="flex items-center gap-3 text-[11px] text-gray-400">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors.badge}`}>
          {STATUS_LABELS[alerta.status_alerta] || alerta.status_alerta}
        </span>
        {alerta.analise_acustica_tags?.length > 0 && (
          <span className="truncate">{alerta.analise_acustica_tags.slice(0, 2).join(", ")}</span>
        )}
      </div>
    </button>
  );
}

// Mapa tático
function MapMarker({ alerta, map }) {
  useEffect(() => {
    if (alerta?.geolocalizacao_latitude && alerta?.geolocalizacao_latitude && map) {
      map.flyTo([alerta.geolocalizacao_latitude, alerta.geolocalizacao_longitude], 17, { duration: 0.8 });
    }
  }, [alerta, map]);

  if (!alerta?.geolocalizacao_latitude) return null;

  const icon = L.divIcon({
    className: "",
    html: `<div style="width:28px;height:28px;background:#ef4444;border:3px solid #fff;border-radius:50%;box-shadow:0 0 20px rgba(239,68,68,0.8);animation:pulse-marker 1.2s infinite;"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

  return (
    <Marker position={[alerta.geolocalizacao_latitude, alerta.geolocalizacao_longitude]} icon={icon}>
      <Popup>
        <div className="text-xs space-y-1">
          <div className="font-bold text-red-600">{GATILHO_LABELS[alerta.tipo_gatilho]}</div>
          <div>{alerta.grau_prioridade_ia}</div>
          {alerta.analise_acustica_tags?.length > 0 && (
            <div className="text-gray-500">{alerta.analise_acustica_tags.join(", ")}</div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

function MapUpdater({ alerta }) {
  const map = useMap();
  return <MapMarker alerta={alerta} map={map} />;
}

// ─── Página Principal ────────────────────────────────────────
export default function CentralDespacho() {
  const { user } = useAuth();
  const [alertas, setAlertas] = useState([]);
  const [selected, setSelected] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  // ─── Carga inicial + subscription em tempo real ────────────
  const loadAlertas = useCallback(async () => {
    try {
      const data = await base44.entities.Alertas_Inteligencia_IA.list("-created_date", 200);
      setAlertas(data);
    } catch (e) {
      /* silencioso */
    }
  }, []);

  useEffect(() => {
    loadAlertas();
    const unsub = base44.entities.Alertas_Inteligencia_IA.subscribe((event) => {
      setAlertas((prev) => {
        if (event.type === "create") return [event.data, ...prev];
        if (event.type === "update") return prev.map((a) => (a.id === event.data.id ? event.data : a));
        if (event.type === "delete") return prev.filter((a) => a.id !== event.data.id);
        return prev;
      });
      // Atualiza o selecionado se for o mesmo
      setSelected((s) => {
        if (s && event.type === "update" && event.data.id === s.id) return event.data;
        if (s && event.type === "delete" && event.data.id === s.id) return null;
        return s;
      });
    });
    return () => unsub();
  }, []);

  // ─── Ordenação por prioridade ──────────────────────────────
  const sortedAlertas = [...alertas].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.grau_prioridade_ia] ?? 99;
    const pb = PRIORITY_ORDER[b.grau_prioridade_ia] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.data_hora_brasilia || 0) - new Date(a.data_hora_brasilia || 0);
  });

  // ─── Ações rápidas ─────────────────────────────────────────
  const updateStatus = async (alerta, newStatus) => {
    try {
      await base44.entities.Alertas_Inteligencia_IA.update(alerta.id, { status_alerta: newStatus });
      toast.success(`Status alterado para "${STATUS_LABELS[newStatus]}"`);
      setSelected((s) => (s?.id === alerta.id ? { ...s, status_alerta: newStatus } : s));
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  };

  const carregarAudio = async (alerta) => {
    if (!alerta.url_audio_video_criptografado) {
      toast.error("Nenhuma mídia anexada a este alerta");
      return;
    }
    setLoadingAudio(true);
    try {
      const res = await base44.functions.invoke("obterMidiaCriptografada", {
        file_uri: alerta.url_audio_video_criptografado,
      });
      setAudioUrl(res.data.signed_url);
    } catch (e) {
      toast.error("Erro ao carregar mídia criptografada");
    } finally {
      setLoadingAudio(false);
    }
  };

  // ─── Highlight de tags acústicas na transcrição ────────────
  const highlightedTranscription = (texto, tags) => {
    if (!texto) return null;
    if (!tags || tags.length === 0) return <p className="text-sm text-gray-300 whitespace-pre-wrap">{texto}</p>;

    const regex = new RegExp(`(${tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = texto.split(regex);
    return (
      <p className="text-sm text-gray-300 whitespace-pre-wrap">
        {parts.map((part, i) => {
          const isTag = tags.some((t) => t.toLowerCase() === part.toLowerCase());
          return isTag ? (
            <mark key={i} className="bg-red-900/70 text-red-200 px-0.5 rounded">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          );
        })}
      </p>
    );
  };

  // ─── JSX ───────────────────────────────────────────────────
  const colors = selected ? PRIORITY_COLORS[selected.grau_prioridade_ia] || PRIORITY_COLORS["BAIXO"] : null;

  return (
    <div className="h-screen flex flex-col bg-[#121212] text-gray-100 overflow-hidden">
      {/* Cabeçalho */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-widest uppercase">Central de Despacho</h1>
            <p className="text-[10px] text-gray-500">Sentinela — Inteligência em Tempo Real</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Sistema Online
          </span>
          <span className="flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5" />
            {sortedAlertas.length} alertas
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-gray-400">{user?.full_name}</span>
        </div>
      </header>

      {/* Corpo: 3 colunas */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Coluna Esquerda: Fila de Alertas ── */}
        <aside className="w-[340px] flex-shrink-0 border-r border-white/5 bg-[#161616] flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-red-500" />
              Fila de Ocorrências
            </h2>
            <span className="text-[10px] text-gray-600 font-mono">{sortedAlertas.length} itens</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
            {sortedAlertas.length === 0 ? (
              <div className="text-center text-gray-600 py-12">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Nenhum alerta ativo</p>
              </div>
            ) : (
              sortedAlertas.map((a) => (
                <AlertCard key={a.id} alerta={a} isSelected={selected?.id === a.id} onClick={setSelected} />
              ))
            )}
          </div>
        </aside>

        {/* ── Coluna Central: Painel Detalhado ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-600">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                  <ChevronRight className="w-8 h-8 opacity-30" />
                </div>
                <p className="text-sm">Selecione um alerta na fila para visualizar os detalhes</p>
                <p className="text-[10px] text-gray-700">Central de Despacho Sentinela v2.0</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Resumo da IA */}
              <div className={`rounded-2xl p-5 border-2 ${selected.grau_prioridade_ia === "CRÍTICO_RISCO_MORTE" ? "bg-red-950/30 border-red-600/50" : "bg-yellow-950/20 border-yellow-600/30"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className={`w-5 h-5 ${selected.grau_prioridade_ia === "CRÍTICO_RISCO_MORTE" ? "text-red-400" : "text-yellow-400"}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">Resumo da Inteligência Artificial</span>
                </div>
                <p className="text-lg font-semibold leading-relaxed text-white">
                  {selected.resumo_despacho_ia || "Resumo não disponível. Aguardando processamento da IA..."}
                </p>
                {selected.data_hora_brasilia && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <ElapsedTimer timestamp={selected.data_hora_brasilia} />
                    <span>· {new Date(selected.data_hora_brasilia).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  </div>
                )}
              </div>

              {/* Metadados do alerta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Gatilho", value: GATILHO_LABELS[selected.tipo_gatilho] || selected.tipo_gatilho, icon: Zap },
                  { label: "Prioridade", value: selected.grau_prioridade_ia?.replace(/_/g, " "), icon: Siren },
                  { label: "Status", value: STATUS_LABELS[selected.status_alerta], icon: Flag },
                  { label: "Tags IA", value: selected.analise_acustica_tags?.join(", ") || "—", icon: FileText },
                ].map((item, i) => (
                  <div key={i} className="bg-[#1E1E1E] rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1">
                      <item.icon className="w-3 h-3" />
                      {item.label}
                    </div>
                    <div className="text-sm font-medium text-white truncate">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Player de Áudio */}
              <div className="bg-[#1E1E1E] rounded-xl border border-white/5 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-3">
                  <Volume2 className="w-3.5 h-3.5 text-red-400" />
                  Áudio Capturado em Segundo Plano
                </h3>
                {audioUrl ? (
                  <audio controls className="w-full h-10" key={audioUrl}>
                    <source src={audioUrl} type="audio/mp4" />
                    <source src={audioUrl} type="audio/webm" />
                    <source src={audioUrl} type="audio/mpeg" />
                    Seu navegador não suporta o player de áudio.
                  </audio>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => carregarAudio(selected)}
                    disabled={loadingAudio || !selected.url_audio_video_criptografado}
                    className="w-full border-red-800/50 text-red-400 hover:bg-red-950/30"
                  >
                    {loadingAudio ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                        Descriptografando...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4" />
                        {selected.url_audio_video_criptografado ? "Carregar Áudio Criptografado" : "Sem mídia disponível"}
                      </span>
                    )}
                  </Button>
                )}
              </div>

              {/* Transcrição com highlights */}
              {selected.transcricao_audio_ia && (
                <div className="bg-[#1E1E1E] rounded-xl border border-white/5 p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-3">
                    <FileText className="w-3.5 h-3.5" />
                    Transcrição de Áudio
                  </h3>
                  {highlightedTranscription(selected.transcricao_audio_ia, selected.analise_acustica_tags)}
                </div>
              )}

              {/* Ações rápidas */}
              <div className="bg-[#1E1E1E] rounded-xl border border-white/5 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2 mb-4">
                  <Navigation className="w-3.5 h-3.5 text-green-400" />
                  Ações Rápidas de Despacho
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => updateStatus(selected, "DESPACHADO_POLICIA")}
                    disabled={selected.status_alerta === "DESPACHADO_POLICIA" || selected.status_alerta === "FINALIZADO"}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold border border-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Shield className="w-5 h-5" />
                    <span className="text-xs text-center leading-tight">Despachar Viatura Mais Próxima</span>
                  </button>
                  <button
                    onClick={() => updateStatus(selected, "EM_ANDAMENTO")}
                    disabled={selected.status_alerta === "FINALIZADO"}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-yellow-600/50 text-yellow-400 hover:bg-yellow-950/30 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PhoneCall className="w-5 h-5" />
                    <span className="text-xs text-center leading-tight">Apoio Defesa Civil / SAMU</span>
                  </button>
                  <button
                    onClick={() => updateStatus(selected, "SUSPEITA_TROTE")}
                    disabled={selected.status_alerta === "FINALIZADO" || selected.status_alerta === "SUSPEITA_TROTE"}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Flag className="w-5 h-5" />
                    <span className="text-xs text-center leading-tight">Encerrar / Trote</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Coluna Direita: Mapa Tático ── */}
        <aside className="w-[380px] flex-shrink-0 border-l border-white/5 flex flex-col">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              Mapa Tático
            </h2>
            {selected?.geolocalizacao_latitude && (
              <span className="text-[10px] text-gray-500 font-mono">
                {selected.geolocalizacao_latitude.toFixed(5)}, {selected.geolocalizacao_longitude.toFixed(5)}
              </span>
            )}
          </div>
          <div className="flex-1 relative">
            <MapContainer
              center={selected?.geolocalizacao_latitude ? [selected.geolocalizacao_latitude, selected.geolocalizacao_longitude] : [-23.5505, -46.6333]}
              zoom={15}
              className="h-full w-full"
              zoomControl={false}
            >
              <TileLayer
                attribution=""
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              {selected && <MapUpdater alerta={selected} />}
            </MapContainer>
            {/* Gradiente sobre o mapa para legibilidade */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#121212] to-transparent pointer-events-none" />
          </div>
          {selected?.geolocalizacao_latitude && (
            <div className="p-3 border-t border-white/5 bg-[#161616]">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.geolocalizacao_latitude},${selected.geolocalizacao_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Google Maps
                </a>
                <a
                  href={`https://waze.com/ul?ll=${selected.geolocalizacao_latitude},${selected.geolocalizacao_longitude}&navigate=yes`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-colors"
                >
                  <Car className="w-3.5 h-3.5" />
                  Waze
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Animação CSS para o marcador pulsante */}
      <style>{`
        @keyframes pulse-marker {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); }
          50% { box-shadow: 0 0 0 18px rgba(239,68,68,0); }
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
}