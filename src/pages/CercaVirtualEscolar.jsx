import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { School, Plus, Trash2, Shield, AlertTriangle, MapPin, Edit3, CheckCircle, XCircle, Bell, Car, Eye, Save, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

// ── Tipos de alerta ──────────────────────────────────────────
const ALERT_TYPES = [
  { id: "entrada_veiculo", label: "Entrada de Veículo Suspeito", icon: Car, color: "text-orange-400" },
  { id: "saida_nao_autorizada", label: "Saída Não Autorizada (Pedestre)", icon: AlertTriangle, color: "text-red-400" },
  { id: "presenca_suspeita", label: "Presença Suspeita no Perímetro", icon: Eye, color: "text-yellow-400" },
  { id: "entrada_horario_indevido", label: "Entrada Fora do Horário Escolar", icon: Bell, color: "text-purple-400" },
];

const TIPO_ESCOLA = [
  { v: "escola_municipal", l: "Escola Municipal" },
  { v: "escola_estadual", l: "Escola Estadual" },
  { v: "creche", l: "Creche / EMEI" },
  { v: "escola_particular", l: "Escola Particular" },
  { v: "outro", l: "Outro" },
];

// ── Componente de desenho de polígono no mapa ────────────────
function PolygonDrawer({ drawing, polygon, setPolygon, onFinish }) {
  useMapEvents({
    click(e) {
      if (!drawing) return;
      setPolygon(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
    dblclick(e) {
      if (!drawing || polygon.length < 3) return;
      e.originalEvent.preventDefault();
      onFinish();
    },
  });

  return polygon.length >= 2 ? (
    <Polygon
      positions={polygon}
      pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.2, weight: 2, dashArray: "6 4" }}
    />
  ) : null;
}

// Marcadores dos vértices durante o desenho
function DrawingMarkers({ polygon }) {
  return polygon.map((pt, i) => (
    <Marker
      key={i}
      position={pt}
      icon={L.divIcon({
        className: "",
        html: `<div style="width:10px;height:10px;background:#3b82f6;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(59,130,246,0.8);"></div>`,
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      })}
    />
  ));
}

// Polígonos das cercas salvas
function SavedFences({ fences, selected, onSelect }) {
  return fences.map(f => {
    if (!f.poligono || f.poligono.length < 3) return null;
    const isSelected = selected?.id === f.id;
    return (
      <Polygon
        key={f.id}
        positions={f.poligono}
        pathOptions={{
          color: f.ativo ? (isSelected ? "#22c55e" : "#3b82f6") : "#6b7280",
          fillColor: f.ativo ? (isSelected ? "#22c55e" : "#3b82f6") : "#6b7280",
          fillOpacity: isSelected ? 0.3 : 0.15,
          weight: isSelected ? 3 : 2,
        }}
        eventHandlers={{ click: () => onSelect(f) }}
      >
        <Popup>
          <div className="text-xs space-y-1">
            <div className="font-bold">{f.nome_escola}</div>
            <div className="text-gray-500">{f.tipo_escola?.replace(/_/g, " ")}</div>
            <div className={f.ativo ? "text-green-600" : "text-gray-400"}>{f.ativo ? "✓ Ativa" : "Inativa"}</div>
          </div>
        </Popup>
      </Polygon>
    );
  });
}

// ── Painel lateral de detalhes ───────────────────────────────
function FenceDetail({ fence, onClose, onToggle, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  if (!fence) return null;
  return (
    <div className="absolute top-4 right-4 z-[1000] w-72 bg-card border border-border/80 rounded-2xl shadow-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{fence.nome_escola}</div>
          <div className="text-xs text-muted-foreground capitalize">{fence.tipo_escola?.replace(/_/g, " ")}</div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
          <XCircle className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Cerca Ativa</span>
        <Switch checked={fence.ativo} onCheckedChange={() => onToggle(fence)} />
      </div>

      {fence.endereco && (
        <div className="text-xs text-muted-foreground flex items-start gap-1.5">
          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
          {fence.endereco}
        </div>
      )}

      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Alertas configurados ({(fence.tipos_alerta || []).length})
        </button>
        {expanded && (
          <div className="mt-2 space-y-1">
            {ALERT_TYPES.map(at => {
              const active = (fence.tipos_alerta || []).includes(at.id);
              const Icon = at.icon;
              return (
                <div key={at.id} className={`flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg ${active ? "bg-primary/10" : "opacity-40"}`}>
                  <Icon className={`w-3 h-3 ${at.color}`} />
                  <span>{at.label}</span>
                  {active && <CheckCircle className="w-3 h-3 text-success ml-auto" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t border-border/60 pt-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-0.5">Horário</div>
          <div>{fence.horario_inicio || "—"} – {fence.horario_fim || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-0.5">Vértices</div>
          <div>{(fence.poligono || []).length} pontos</div>
        </div>
      </div>

      <button
        onClick={() => onDelete(fence)}
        className="w-full text-xs text-destructive hover:bg-destructive/10 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" /> Remover Cerca
      </button>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────
export default function CercaVirtualEscolar() {
  const { user } = useAuth();
  const [fences, setFences] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_escola: "",
    tipo_escola: "escola_municipal",
    endereco: "",
    horario_inicio: "07:00",
    horario_fim: "17:00",
    tipos_alerta: ["entrada_veiculo", "saida_nao_autorizada"],
    ativo: true,
  });

  const load = async () => {
    const list = await base44.entities.Cercas_Virtuais_Escolares.list("-created_date", 100);
    setFences(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startDrawing = () => {
    setPolygon([]);
    setDrawing(true);
    setSelected(null);
    toast.info("Clique no mapa para adicionar vértices. Duplo clique para finalizar.", { duration: 5000 });
  };

  const finishDrawing = () => {
    setDrawing(false);
    if (polygon.length >= 3) {
      setShowForm(true);
    } else {
      toast.error("Desenhe pelo menos 3 pontos para criar uma cerca.");
      setPolygon([]);
    }
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setPolygon([]);
  };

  const toggleAlertType = (id) => {
    setForm(f => ({
      ...f,
      tipos_alerta: f.tipos_alerta.includes(id)
        ? f.tipos_alerta.filter(x => x !== id)
        : [...f.tipos_alerta, id],
    }));
  };

  const save = async () => {
    if (!form.nome_escola) { toast.error("Informe o nome da escola."); return; }
    if (polygon.length < 3) { toast.error("Polígono inválido."); return; }
    setSaving(true);
    await base44.entities.Cercas_Virtuais_Escolares.create({
      ...form,
      poligono: polygon,
      criado_por_id: user?.id,
      criado_por_nome: user?.full_name,
    });
    toast.success("Cerca virtual criada com sucesso!");
    setShowForm(false);
    setPolygon([]);
    setForm({ nome_escola: "", tipo_escola: "escola_municipal", endereco: "", horario_inicio: "07:00", horario_fim: "17:00", tipos_alerta: ["entrada_veiculo", "saida_nao_autorizada"], ativo: true });
    await load();
    setSaving(false);
  };

  const toggleAtivo = async (f) => {
    await base44.entities.Cercas_Virtuais_Escolares.update(f.id, { ativo: !f.ativo });
    setSelected(s => s?.id === f.id ? { ...s, ativo: !s.ativo } : s);
    load();
  };

  const remove = async (f) => {
    await base44.entities.Cercas_Virtuais_Escolares.delete(f.id);
    toast.info("Cerca removida.");
    setSelected(null);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <School className="w-6 h-6 text-primary" /> Cercas Virtuais Escolares
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Desenhe perímetros ao redor de escolas e configure alertas automáticos de veículos suspeitos e saídas não autorizadas.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {drawing ? (
            <>
              <Button variant="outline" size="sm" onClick={cancelDrawing}>
                <XCircle className="w-4 h-4 mr-1.5" /> Cancelar
              </Button>
              <Button size="sm" onClick={finishDrawing} disabled={polygon.length < 3}>
                <CheckCircle className="w-4 h-4 mr-1.5" /> Finalizar ({polygon.length} pts)
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={startDrawing}>
              <Edit3 className="w-4 h-4 mr-1.5" /> Desenhar Nova Cerca
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold">{fences.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Cercas Cadastradas</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-success">{fences.filter(f => f.ativo).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Cercas Ativas</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-warning">{fences.filter(f => !f.ativo).length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Inativas</div>
        </div>
      </div>

      {/* Instrução de desenho */}
      {drawing && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
          <p className="text-sm text-primary font-medium">
            Modo de desenho ativo — clique no mapa para adicionar vértices. Duplo clique ou botão "Finalizar" para concluir.
            {polygon.length > 0 && <span className="ml-2 text-muted-foreground">({polygon.length} pontos)</span>}
          </p>
        </div>
      )}

      {/* Mapa */}
      <div className="relative rounded-2xl overflow-hidden border border-border/60" style={{ height: 500 }}>
        <MapContainer
          center={[-23.5505, -46.6333]}
          zoom={13}
          className="h-full w-full"
          style={{ cursor: drawing ? "crosshair" : "grab" }}
        >
          <TileLayer
            attribution=""
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <PolygonDrawer
            drawing={drawing}
            polygon={polygon}
            setPolygon={setPolygon}
            onFinish={finishDrawing}
          />
          <DrawingMarkers polygon={polygon} />
          <SavedFences fences={fences} selected={selected} onSelect={setSelected} />
        </MapContainer>

        {/* Painel de detalhe sobreposto */}
        <FenceDetail
          fence={selected}
          onClose={() => setSelected(null)}
          onToggle={toggleAtivo}
          onDelete={remove}
        />
      </div>

      {/* Formulário de criação (após desenho) */}
      {showForm && (
        <div className="rounded-2xl border border-primary/40 bg-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Configurar Cerca Virtual
            </h3>
            <button onClick={() => { setShowForm(false); setPolygon([]); }}>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome da Escola *</label>
              <Input value={form.nome_escola} onChange={e => setForm(f => ({ ...f, nome_escola: e.target.value }))} placeholder="Ex: EMEF João Silva" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <select
                value={form.tipo_escola}
                onChange={e => setForm(f => ({ ...f, tipo_escola: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {TIPO_ESCOLA.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Endereço</label>
              <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} placeholder="Rua, número, bairro" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Horário de Início</label>
              <Input type="time" value={form.horario_inicio} onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Horário de Fim</label>
              <Input type="time" value={form.horario_fim} onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block font-medium">Tipos de Alerta Automático</label>
            <div className="grid md:grid-cols-2 gap-2">
              {ALERT_TYPES.map(at => {
                const active = form.tipos_alerta.includes(at.id);
                const Icon = at.icon;
                return (
                  <button
                    key={at.id}
                    onClick={() => toggleAlertType(at.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      active ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/30"
                    }`}
                  >
                    <Icon className={`w-4 h-4 flex-shrink-0 ${at.color}`} />
                    <span className="text-sm">{at.label}</span>
                    {active && <CheckCircle className="w-4 h-4 text-success ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.ativo} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
            <span className="text-sm text-muted-foreground">Ativar cerca imediatamente após salvar</span>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => { setShowForm(false); setPolygon([]); }}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Salvar Cerca Virtual
            </Button>
          </div>
        </div>
      )}

      {/* Lista de cercas */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm">Cercas Cadastradas ({fences.length})</h2>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : fences.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
            <School className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma cerca cadastrada. Use o botão "Desenhar Nova Cerca" acima.</p>
          </div>
        ) : (
          fences.map(f => (
            <div
              key={f.id}
              onClick={() => setSelected(selected?.id === f.id ? null : f)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selected?.id === f.id ? "border-primary bg-primary/5" : "border-border/60 bg-card hover:border-primary/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.ativo ? "bg-success/15" : "bg-muted"}`}>
                <School className={`w-4 h-4 ${f.ativo ? "text-success" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{f.nome_escola}</div>
                <div className="text-xs text-muted-foreground">
                  {f.tipo_escola?.replace(/_/g, " ")} · {(f.poligono || []).length} vértices · {(f.tipos_alerta || []).length} alertas
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${f.ativo ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {f.ativo ? "Ativa" : "Inativa"}
                </span>
                <Switch
                  checked={f.ativo}
                  onCheckedChange={(e) => { e.stopPropagation?.(); toggleAtivo(f); }}
                  onClick={e => e.stopPropagation()}
                />
                <button
                  onClick={e => { e.stopPropagation(); remove(f); }}
                  className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}