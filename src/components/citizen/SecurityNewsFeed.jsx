import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Newspaper, RefreshCw, AlertTriangle, Shield, TrendingUp, Clock, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const CATEGORY_STYLE = {
  alerta: "bg-destructive/10 text-destructive border-destructive/20",
  prevenção: "bg-warning/10 text-warning border-warning/20",
  informativo: "bg-primary/10 text-primary border-primary/20",
  estatística: "bg-success/10 text-success border-success/20",
};

const CATEGORY_ICON = {
  alerta: AlertTriangle,
  prevenção: Shield,
  informativo: Newspaper,
  estatística: TrendingUp,
};

export default function SecurityNewsFeed({ city = "sua região" }) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema de notícias de segurança pública do Brasil.
        
Gere 6 notícias recentes e relevantes sobre segurança pública, criminalidade e segurança da ${city} ou do Brasil.
As notícias devem ser realistas, variadas e atuais (considere a data atual como ${format(new Date(), "dd/MM/yyyy")}).
Inclua notícias de: alertas de segurança, dicas de prevenção, estatísticas, operações policiais, segurança no trânsito.

Retorne no formato JSON solicitado.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            news: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  summary: { type: "string" },
                  category: { type: "string", description: "alerta | prevenção | informativo | estatística" },
                  time: { type: "string", description: "Ex: há 2 horas, hoje às 14h" },
                  source: { type: "string" },
                  tip: { type: "string", description: "Dica de segurança relacionada (opcional)" },
                }
              }
            }
          }
        }
      });
      setNews(result.news || []);
      setLastUpdated(new Date());
    } catch (e) {
      // Fallback static news
      setNews([
        { title: "Operação integrada reduz roubos em 18% no mês", summary: "Forças de segurança intensificam patrulhamento em zonas de risco identificadas pelo sistema de inteligência.", category: "informativo", time: "há 3 horas", source: "Sentinela" },
        { title: "Alerta: aumento de golpes via WhatsApp na região", summary: "Criminosos se passam por familiares pedindo transferências urgentes. Desconfie e confirme por ligação.", category: "alerta", time: "há 5 horas", source: "Sentinela" },
        { title: "Como proteger sua casa durante férias", summary: "Confira as principais dicas de segurança para deixar sua residência protegida durante viagens.", category: "prevenção", time: "hoje", source: "Sentinela" },
        { title: "Câmeras de monitoramento expandidas em 3 novos bairros", summary: "O projeto Sentinela amplia cobertura de videomonitoramento para aumentar a segurança pública.", category: "informativo", time: "ontem", source: "Sentinela" },
        { title: "Índice de resolução de ocorrências cresce 22%", summary: "Integração entre cidadãos e agentes via plataforma digital eleva a taxa de resolução de casos.", category: "estatística", time: "ontem", source: "Sentinela" },
        { title: "Dica: evite exibir objetos de valor em locais públicos", summary: "Celulares, relógios e joias são os principais alvos. Reduza a exposição em locais com grande circulação.", category: "prevenção", time: "há 2 dias", source: "Sentinela" },
      ]);
      setLastUpdated(new Date());
    }
    setLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" /> Diário de Segurança
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> {format(lastUpdated, "HH:mm")}
            </span>
          )}
          <Button size="sm" variant="ghost" onClick={fetchNews} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && news.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando notícias...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {news.map((n, i) => {
            const Icon = CATEGORY_ICON[n.category] || Newspaper;
            const style = CATEGORY_STYLE[n.category] || "bg-muted/20 text-muted-foreground border-border/40";
            return (
              <div key={i} className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-1.5 hover:border-border/70 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style}`}>
                      <Icon className="w-2.5 h-2.5" />
                      {n.category}
                    </span>
                    {n.time && <span className="text-[10px] text-muted-foreground">{n.time}</span>}
                  </div>
                </div>
                <h4 className="text-sm font-semibold leading-snug">{n.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{n.summary}</p>
                {n.tip && (
                  <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary">
                    <Shield className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{n.tip}</span>
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