import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { Loader2, ExternalLink, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function NewsArticleModal({ article, onClose }) {
  const [fullContent, setFullContent] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadFullArticle = async () => {
    if (fullContent) return;
    setLoading(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Escreva o artigo completo e detalhado sobre a seguinte notícia de segurança pública brasileira.
      
Título: "${article.title}"
Resumo: "${article.summary}"
Categoria: ${article.category}
Fonte: ${article.source}

Elabore com:
- Contexto completo do fato
- Detalhes relevantes
- Impacto na segurança pública
- Recomendações para a população
- Informações adicionais relacionadas

Use linguagem clara e informativa. Escreva em markdown.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Artigo completo em markdown" },
          related_tips: { type: "array", items: { type: "string" } },
        }
      }
    });
    setFullContent(result);
    setLoading(false);
  };

  // Load on open
  useState(() => { loadFullArticle(); }, []);

  // Trigger load once
  if (!fullContent && !loading) {
    loadFullArticle();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-base leading-snug">{article.title}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">{article.time}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{article.source}</span>
          </div>
        </DialogHeader>

        <div className="mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Carregando artigo completo...</span>
            </div>
          ) : fullContent ? (
            <div className="space-y-4">
              <div className="prose prose-sm prose-invert max-w-none text-foreground [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_p]:text-muted-foreground [&_li]:text-sm [&_li]:text-muted-foreground [&_strong]:text-foreground">
                <ReactMarkdown>{fullContent.content}</ReactMarkdown>
              </div>
              {fullContent.related_tips?.length > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Dicas de Segurança Relacionadas
                  </h4>
                  <ul className="space-y-1.5">
                    {fullContent.related_tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}