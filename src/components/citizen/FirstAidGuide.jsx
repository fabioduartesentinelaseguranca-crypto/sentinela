import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeartPulse, Heart, Wind, Droplets } from "lucide-react";

const GUIDES = [
  {
    id: "rcp", title: "RCP (Massagem Cardíaca)", icon: Heart,
    steps: [
      "Verifique a segurança do local e chame ajuda (SAMU 192).",
      "Cheque se a vítima responde. Chame-a pelo nome e sacuda os ombros.",
      "Posicione a vítima de costas em superfície firme.",
      "Coloque as mãos sobrepostas no centro do tórax, entre os mamilos.",
      "Comprima com força, 5 a 6 cm de profundidade, a 100-120 compressões por minuto.",
      "Mantenha o ritmo ('Staying Alive' ajuda a marcar) até a chegada do socorro.",
    ],
  },
  {
    id: "engasgo", title: "Engasgo (Manobra de Heimlich)", icon: Wind,
    steps: [
      "Pergunte se a pessoa consegue falar ou tossir. Se sim, incentive a tossir.",
      "Se não conseguir respirar, posicione-se atrás da vítima.",
      "Abrace pela cintura, feche uma mão em punho acima do umbigo.",
      "Cubra com a outra mão e faça 5 compressões rápidas para dentro e para cima.",
      "Alterne com 5 tapas interescapulares se necessário.",
      "Se a vítima desmaiar, inicie RCP e chame o SAMU imediatamente.",
    ],
  },
  {
    id: "sangue", title: "Estancamento de Sangramento", icon: Droplets,
    steps: [
      "Use luvas ou plástico se disponível para proteção.",
      "Pressione firmemente o ferimento com pano limpo ou gaze.",
      "Mantenha a pressão constante — não retire o pano, apenas adicione mais por cima.",
      "Eleve o membro ferido acima do nível do coração, se possível.",
      "Se o sangramento persistir, aplique torniquete apenas acima do ferimento (membros).",
      "Chame o SAMU (192) e mantenha a vítima aquecida até a chegada.",
    ],
  },
];

export default function FirstAidGuide() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-border/60 bg-card p-6 hover:border-primary/40 transition-colors text-left"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
            <HeartPulse className="w-5 h-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold">Primeiros Socorros</h3>
            <p className="text-xs text-muted-foreground">Guia rápido · Acesso offline</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Procedimentos essenciais enquanto o SAMU não chega.
        </p>
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setActive(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{active ? active.title : "Primeiros Socorros"}</DialogTitle>
          </DialogHeader>
          {!active ? (
            <div className="grid gap-2 mt-2">
              {GUIDES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActive(g)}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-colors text-left"
                >
                  <g.icon className="w-5 h-5 text-success" />
                  <span className="font-medium">{g.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              <ol className="space-y-3">
                {active.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed">{s}</span>
                  </li>
                ))}
              </ol>
              <button onClick={() => setActive(null)} className="text-sm text-primary hover:underline">
                ← Voltar aos guias
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}