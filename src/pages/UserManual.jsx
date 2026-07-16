import { useState, useEffect } from "react";
import { useAppRole } from "@/lib/useCurrentUser";
import {
  Shield, Users, UserCheck, Brain, ChevronDown, ChevronRight,
  AlertTriangle, MapPin, Radio, BookOpen, Star, Camera,
  Truck, Package, Calendar, FileText, Phone, Eye, Lock,
  Download, Loader2, CheckCircle2, Search, X, Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";

// ─── Profile data ─────────────────────────────────────────────────────────────
const PROFILES = [
  {
    id: "citizen",
    label: "Cidadão",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/30",
    accent: "bg-blue-400",
    description: "Usuário comum que reporta ocorrências e acessa recursos de segurança pessoal.",
    sections: [
      {
        title: "Reportar Ocorrências",
        icon: AlertTriangle,
        items: [
          "Acesse o painel e clique em 'Nova Ocorrência'.",
          "Escolha a categoria: Crime, Acidente, Emergência Médica, Incêndio, etc.",
          "Adicione descrição, fotos ou vídeos. A localização é capturada automaticamente.",
          "Você pode usar o microfone para transcrição por voz.",
          "Sem internet? O formulário funciona offline — o envio é feito automaticamente quando a conexão voltar.",
          "Acompanhe o status da sua ocorrência em 'Minhas Ocorrências'.",
        ],
      },
      {
        title: "Botão de Pânico",
        icon: Phone,
        items: [
          "Em situação de emergência, pressione e segure o botão vermelho de pânico.",
          "Um alerta urgente é disparado automaticamente para todos os agentes ativos.",
          "Sua localização em tempo real é compartilhada com as autoridades.",
          "Disponível na tela principal do painel cidadão.",
        ],
      },
      {
        title: "Medida Protetiva",
        icon: Shield,
        items: [
          "Acesse 'Medida Protetiva' no seu perfil.",
          "Faça upload do documento judicial de medida protetiva.",
          "Um administrador irá revisar e aprovar seu cadastro.",
          "Após aprovação, alertas especiais são ativados para sua proteção.",
        ],
      },
      {
        title: "Denúncia Anônima",
        icon: Eye,
        items: [
          "Use 'Denúncia Anônima' para reportar atividades suspeitas sem se identificar.",
          "Categorias: Tráfico, Atividade Suspeita, Vandalismo, Veículo Abandonado, Área de Risco.",
          "Você pode anexar fotos/vídeos como evidência.",
          "A denúncia é revisada por um administrador antes de ser aprovada.",
        ],
      },
      {
        title: "Gamificação & Ranking",
        icon: Star,
        items: [
          "Você ganha pontos a cada ocorrência reportada.",
          "Ocorrências urgentes valem mais pontos.",
          "Acesse o Ranking para ver sua posição entre os cidadãos mais ativos.",
          "Badges especiais são concedidos por milestones (ex: 10 ocorrências resolvidas).",
        ],
      },
      {
        title: "Guia de Primeiros Socorros",
        icon: BookOpen,
        items: [
          "Acesse 'Primeiros Socorros' para guias de emergência offline.",
          "Inclui PCR, controle de hemorragia, queimaduras, afogamento e mais.",
          "Disponível mesmo sem conexão com a internet.",
        ],
      },
    ],
  },
  {
    id: "agent",
    label: "Agente",
    icon: Shield,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/30",
    accent: "bg-cyan-400",
    description: "Policial ou agente de segurança em campo, com acesso a ferramentas operacionais.",
    sections: [
      {
        title: "Início de Turno",
        icon: Calendar,
        items: [
          "Acesse 'Meu Turno' e clique em 'Iniciar Turno'.",
          "Informe a placa da viatura e o setor de patrulha.",
          "Antes de confirmar, preencha o Checklist de Viatura obrigatório.",
          "O checklist verifica: combustível, pneus, sinalizadores, extintor, rádio e kit de primeiros socorros.",
          "Viaturas com falhas críticas ficam bloqueadas até resolução.",
        ],
      },
      {
        title: "Notificações Push de Alta Prioridade",
        icon: AlertTriangle,
        items: [
          "Permita notificações do navegador para receber alertas instantâneos.",
          "Você será notificado mesmo com o aplicativo minimizado ou em segundo plano.",
          "Ocorrências de pânico e prioridade crítica disparam alerta imediato com vibração.",
          "Clique na notificação para abrir diretamente a ocorrência.",
        ],
      },
      {
        title: "Gestão de Ocorrências",
        icon: AlertTriangle,
        items: [
          "Ocorrências aparecem em tempo real no seu painel.",
          "Clique em 'Assumir' para se responsabilizar por uma ocorrência.",
          "Use o chat interno para comunicar-se com a central ou outros agentes.",
          "Ao resolver, clique em 'Resolver' e descreva as providências tomadas.",
          "Ocorrências urgentes piscam em vermelho e emitem notificação sonora.",
        ],
      },
      {
        title: "Mapa em Tempo Real",
        icon: MapPin,
        items: [
          "O mapa exibe ocorrências ativas, agentes em campo e câmeras próximas.",
          "Seu histórico de localização (breadcrumbs) é registrado automaticamente durante o turno.",
          "Alertas de proximidade avisam quando você se aproxima de uma ocorrência ativa.",
          "Câmeras próximas são sinalizadas e você pode abrir o feed ao clicar.",
        ],
      },
      {
        title: "Checklist de Equipamentos",
        icon: Package,
        items: [
          "Preencha diariamente o checklist de equipamentos pessoais.",
          "Itens verificados: rádio, arma, kit médico, colete, algemas, lanterna, cassetete.",
          "Itens marcados como inoperantes geram ticket automático de manutenção.",
          "O checklist garante sua pontuação de missão diária.",
        ],
      },
      {
        title: "Missões do Turno",
        icon: Star,
        items: [
          "Missões diárias aparecem no painel (ex: 'Resolver 3 ocorrências', 'Preencher checklist').",
          "Cada missão concluída concede pontos e pode desbloquear badges.",
          "O progresso é exibido em tempo real.",
          "Missões expiram ao fim do turno.",
        ],
      },
      {
        title: "Rádio Offline & Patrulha Virtual",
        icon: Radio,
        items: [
          "Use o Rádio Offline para comunicação em zonas sem cobertura de internet.",
          "Mensagens são salvas localmente e sincronizadas ao reconectar.",
          "O Modo Patrulha Virtual simula rotas para treinamento.",
          "Em campo, o monitoramento de fadiga alerta sobre longas jornadas sem pausa.",
        ],
      },
      {
        title: "Autoavaliação Psicológica",
        icon: Brain,
        items: [
          "Acesse 'Saúde Mental' no menu do agente.",
          "Preencha periodicamente: nível de estresse, fadiga, horas de sono e humor.",
          "Respostas críticas geram alerta automático para o psicólogo da equipe.",
          "O processo é confidencial — dados não são visíveis para outros agentes.",
        ],
      },
      {
        title: "Capacitação & Certificados",
        icon: BookOpen,
        items: [
          "Acesse 'Treinamento' para módulos de capacitação online.",
          "Cada módulo tem conteúdo e um quiz de avaliação.",
          "Nota mínima de 70% para aprovação e emissão de certificado.",
          "Certificados têm validade configurável e renovação automática por alerta.",
        ],
      },
    ],
  },
  {
    id: "psychologist",
    label: "Psicólogo",
    icon: Brain,
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/30",
    accent: "bg-purple-400",
    description: "Profissional de saúde mental responsável pelo acompanhamento da equipe policial.",
    sections: [
      {
        title: "Painel do Psicólogo",
        icon: Brain,
        items: [
          "Acesse em /psych após login com perfil 'psychologist'.",
          "Veja um resumo das autoavaliações recentes de todos os agentes.",
          "Alertas vermelhos indicam agentes em estado crítico (estresse ou fadiga extrema).",
          "Filtre por data, agente ou nível de risco.",
        ],
      },
      {
        title: "Avaliações de Bem-estar",
        icon: UserCheck,
        items: [
          "Cada autoavaliação preenchida pelo agente fica disponível para revisão.",
          "Você pode marcar avaliações como 'revisadas' e adicionar observações internas.",
          "Gatilhos de PTSD e humor crítico geram alertas prioritários.",
          "Histórico completo por agente disponível para acompanhamento longitudinal.",
        ],
      },
      {
        title: "Gestão de Consultas",
        icon: Calendar,
        items: [
          "Agende sessões individuais diretamente no sistema.",
          "Defina modalidade: presencial ou online.",
          "Marque consultas urgentes — um e-mail de alerta é enviado ao gestor.",
          "Registre notas confidenciais por sessão (visíveis apenas para você).",
          "Acompanhe status: agendado, confirmado, concluído, cancelado ou falta.",
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Administrador",
    icon: Lock,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/30",
    accent: "bg-orange-400",
    description: "Gestor com acesso completo à plataforma — configurações, dados e ferramentas estratégicas.",
    sections: [
      {
        title: "Visão Geral & KPIs",
        icon: FileText,
        items: [
          "O Dashboard principal exibe ocorrências abertas, resolvidas, cidadãos e agentes.",
          "A aba 'KPIs Estratégicos' mostra métricas avançadas de desempenho.",
          "O 'Dashboard Gestor' exibe status da frota, equipe e operações do dia.",
          "Relatórios em PDF podem ser gerados com filtros de data e categoria.",
        ],
      },
      {
        title: "Gestão de Usuários",
        icon: Users,
        items: [
          "Na aba 'Dashboard', veja a lista completa de usuários cadastrados.",
          "Altere o perfil de qualquer usuário: cidadão, agente, psicólogo ou admin.",
          "Revise e aprove medidas protetivas de cidadãos com upload de documento.",
          "Convide novos usuários pelo sistema de convites (e-mail).",
        ],
      },
      {
        title: "Painel de Risco de Fadiga",
        icon: Brain,
        items: [
          "Acesse em Saúde & RH → 'Risco de Fadiga'.",
          "O painel cruza automaticamente o tempo de turno de cada agente com sua última avaliação psicológica.",
          "Agentes críticos: tempo de turno ≥ 14h ou fadiga/estresse ≥ 8/10 — pausa obrigatória recomendada.",
          "Agentes em atenção: fatores intermediários — monitorar de perto.",
          "O painel se atualiza automaticamente a cada 5 minutos.",
        ],
      },
      {
        title: "Inteligência & Mapas",
        icon: MapPin,
        items: [
          "Mapa Operacional: acompanhe ocorrências e agentes em tempo real.",
          "Mapa Preditivo: identifique áreas de alto risco com base em dados históricos.",
          "Inteligência Forense: análise avançada de padrões criminais com IA.",
          "Denúncias Anônimas: revise, aprove ou rejeite denúncias de cidadãos.",
          "Mural de Procurados: cadastre e gerencie mandados e criminosos foragidos.",
        ],
      },
      {
        title: "Agentes & Escalas",
        icon: Calendar,
        items: [
          "Calendário de Escalas: distribua turnos manualmente por semana.",
          "Escala Inteligente: use IA para sugerir alocação ótima de agentes.",
          "Zonas de Patrulha: defina e gerencie áreas de cobertura.",
          "Ranking: acompanhe performance por agente (resoluções, tempo de resposta, avaliações).",
          "Conquistas da Equipe: objetivos coletivos com metas e recompensas.",
          "Capacitação: gerencie módulos de treinamento e acompanhe certificados.",
        ],
      },
      {
        title: "Frota & Equipamentos",
        icon: Truck,
        items: [
          "Viaturas: cadastre veículos, associe agentes e acompanhe status operacional.",
          "Manutenção de Frota: agende revisões preventivas por KM ou data.",
          "Estoque Geral: controle de equipamentos com alertas de nível mínimo.",
          "Estoque Tático QR: gestão avançada com geração de QR Code por item, check-in/out e alertas de vencimento.",
          "Tickets de Manutenção: acompanhe falhas reportadas pelos agentes.",
        ],
      },
      {
        title: "Vigilância",
        icon: Camera,
        items: [
          "Câmeras: cadastre câmeras por localização, tipo e URL de stream.",
          "Análise de Vídeo: use IA para analisar imagens e identificar situações suspeitas.",
          "Alertas de Geocercas: configure zonas e receba alertas de entrada/saída.",
        ],
      },
      {
        title: "Saúde & RH",
        icon: Brain,
        items: [
          "Painel de Fadiga: cruzamento automático de turno + dados psicológicos.",
          "Avaliações Psicológicas: veja o painel de bem-estar de toda a equipe.",
          "Consultas Agendadas: acompanhe as sessões psicológicas agendadas.",
          "Alertas de urgência são enviados automaticamente para consultas críticas.",
        ],
      },
    ],
  },
];

const STORAGE_KEY = "sentinela_manual_read";

function loadReadSections() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

// ─── Section accordion ────────────────────────────────────────────────────────
function Section({ section, profileId, isRead, onToggleRead, searchQuery, forceOpen }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  const isHighlighted = searchQuery && (
    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    section.items.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const key = `${profileId}::${section.title}`;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isRead ? "border-success/40 bg-success/5" : 
      isHighlighted ? "border-primary/50 bg-primary/5" : "border-border/60"
    }`}>
      <div className="flex items-center">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 flex-shrink-0 ${isRead ? "text-success" : "text-primary"}`} />
            <span className={`font-medium text-sm ${isRead ? "line-through text-muted-foreground" : ""}`}>
              {section.title}
            </span>
            {isHighlighted && !isRead && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded font-medium">match</span>
            )}
          </div>
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        <button
          onClick={() => onToggleRead(key)}
          title={isRead ? "Marcar como não lido" : "Marcar como lido"}
          className={`px-3 py-3 transition-colors ${isRead ? "text-success hover:text-muted-foreground" : "text-muted-foreground hover:text-success"}`}
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/20">
          <ul className="space-y-2">
            {section.items.map((item, i) => {
              const itemMatch = searchQuery && item.toLowerCase().includes(searchQuery.toLowerCase());
              return (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="text-primary font-bold mt-0.5 flex-shrink-0">•</span>
                  <span className={itemMatch ? "text-foreground bg-primary/10 rounded px-1" : ""}>{item}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function UserManual() {
  const role = useAppRole();
  const isAdmin = role === "admin";

  // Parse URL params
  const urlParams = new URLSearchParams(window.location.search);
  const paramProfile = urlParams.get("profile");
  const paramSection = urlParams.get("section");
  const paramQ = urlParams.get("q");

  const availableProfiles = isAdmin ? PROFILES : PROFILES.filter((p) => p.id === role);
  const defaultProfile = (isAdmin && paramProfile) ? paramProfile : (availableProfiles[0]?.id || "citizen");

  const [activeProfile, setActiveProfile] = useState(defaultProfile);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [readSections, setReadSections] = useState(loadReadSections);
  const [searchQuery, setSearchQuery] = useState(paramQ || "");

  const profile = PROFILES.find((p) => p.id === activeProfile) || PROFILES[0];
  const Icon = profile.icon;

  // Count read sections for this profile
  const totalSections = profile.sections.length;
  const readCount = profile.sections.filter(s => readSections[`${activeProfile}::${s.title}`]).length;
  const progressPct = totalSections > 0 ? Math.round((readCount / totalSections) * 100) : 0;

  const toggleRead = (key) => {
    setReadSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const markAllRead = () => {
    setReadSections(prev => {
      const next = { ...prev };
      profile.sections.forEach(s => { next[`${activeProfile}::${s.title}`] = true; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Filter sections by search
  const filteredSections = searchQuery.trim()
    ? profile.sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.items.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : profile.sections;

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxW = pageW - margin * 2;
      let y = 20;

      const addPage = () => { doc.addPage(); y = 20; };
      const checkY = (needed = 10) => { if (y + needed > 280) addPage(); };

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Manual do Sentinela", margin, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(`Perfil: ${profile.label}  ·  ${profile.description}`, margin, y, { maxWidth: maxW });
      y += 10;

      doc.setDrawColor(200);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
      doc.setTextColor(0);

      profile.sections.forEach((section) => {
        checkY(14);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(section.title, margin, y);
        y += 6;

        section.items.forEach((item) => {
          const lines = doc.splitTextToSize(`• ${item}`, maxW - 4);
          checkY(lines.length * 5 + 2);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(lines, margin + 2, y);
          y += lines.length * 5 + 1;
        });
        y += 5;
      });

      checkY(10);
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("Sentinela — Plataforma de Segurança Cidadã · Manual v2.0", margin, y);
      doc.save(`manual-sentinela-${profile.id}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setGeneratingPdf(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Manual do Sentinela
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Guia completo de uso da plataforma por perfil de acesso.
            {!isAdmin && <span className="ml-1 text-primary">· Perfil: <strong>{profile.label}</strong></span>}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGeneratePdf}
          disabled={generatingPdf}
          className="flex-shrink-0"
        >
          {generatingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline ml-1.5">Exportar PDF</span>
        </Button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 bg-muted/60 border border-border/60 rounded-xl px-4 h-11 focus-within:ring-1 focus-within:ring-ring transition-all">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <input
            className="bg-transparent text-sm outline-none flex-1 placeholder:text-muted-foreground"
            placeholder="Buscar tópicos no manual..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>
        {searchQuery && (
          <div className="mt-2 text-xs text-muted-foreground px-1">
            {filteredSections.length} resultado(s) para "{searchQuery}"
          </div>
        )}
      </div>

      {/* Profile Selector — only for admins */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PROFILES.map((p) => {
            const PIcon = p.icon;
            const isActive = activeProfile === p.id;
            const pRead = p.sections.filter(s => readSections[`${p.id}::${s.title}`]).length;
            const pPct = p.sections.length > 0 ? Math.round((pRead / p.sections.length) * 100) : 0;
            return (
              <button
                key={p.id}
                onClick={() => setActiveProfile(p.id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  isActive ? `${p.bg} ${p.color}` : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                }`}
              >
                <PIcon className="w-6 h-6" />
                <span className="text-sm font-medium">{p.label}</span>
                {pPct > 0 && (
                  <span className="text-[10px] font-mono">{pPct}% lido</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Profile Content */}
      <div className="space-y-4">
        <div className={`flex items-start gap-4 p-5 rounded-2xl border ${profile.bg}`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.accent}/20`}>
            <Icon className={`w-5 h-5 ${profile.color}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-4">
              <h2 className={`font-semibold text-lg ${profile.color}`}>Perfil: {profile.label}</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{readCount}/{totalSections} lidos</span>
                {readCount < totalSections && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Marcar todos
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{profile.description}</p>
            {/* Progress bar */}
            <div className="mt-3 h-1.5 rounded-full bg-border/60 overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {filteredSections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum tópico encontrado para "{searchQuery}".
            </div>
          ) : (
            filteredSections.map((s) => (
              <Section
                key={s.title}
                section={s}
                profileId={activeProfile}
                isRead={!!readSections[`${activeProfile}::${s.title}`]}
                onToggleRead={toggleRead}
                searchQuery={searchQuery}
                forceOpen={paramSection === s.title}
              />
            ))
          )}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border/40 space-y-2">
        <div>Sentinela — Plataforma de Segurança Cidadã · Manual v2.0</div>
        <a href="/termos" className="inline-flex items-center gap-1 text-primary hover:underline">
          <Scale className="w-3.5 h-3.5" /> Termos e Condições de Uso
        </a>
      </div>
    </div>
  );
}