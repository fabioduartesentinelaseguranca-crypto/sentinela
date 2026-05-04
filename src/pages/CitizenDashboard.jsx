import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Award, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import RegisterOccurrenceDialog from "@/components/citizen/RegisterOccurrenceDialog";
import PanicButton from "@/components/citizen/PanicButton";
import ProtectiveMeasureCard from "@/components/citizen/ProtectiveMeasureCard";
import EmergencyContactsManager from "@/components/citizen/EmergencyContactsManager";
import FirstAidGuide from "@/components/citizen/FirstAidGuide";
import OccurrenceList from "@/components/citizen/OccurrenceList";
import CitizenOccurrenceChat from "@/components/citizen/OccurrenceChat";
import AnonymousTipForm from "@/components/citizen/AnonymousTipForm";
import StatCard from "@/components/shared/StatCard";
import SecurityNewsFeed from "@/components/citizen/SecurityNewsFeed";
import { FileText, Shield, Trophy } from "lucide-react";

export default function CitizenDashboard() {
  const { user, refreshUser } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [defaultType, setDefaultType] = useState("crime");
  const [occurrences, setOccurrences] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [chatOccurrence, setChatOccurrence] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  const loadOccurrences = async () => {
    if (!user?.id) return;
    const list = await base44.entities.Occurrence.filter({ reporter_id: user.id }, "-created_date", 20);
    setOccurrences(list);
  };

  useEffect(() => { loadOccurrences(); }, [user?.id]);

  const openRegister = (type) => { setDefaultType(type); setOpenDialog(true); };

  const panicEnabled = user?.protective_measure_status === "active";
  const openCount = occurrences.filter((o) => o.status === "open" || o.status === "in_progress").length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      {/* Hero */}
      <div className="rounded-3xl border border-border/60 bg-card overflow-hidden relative">
        <div className="grid-bg absolute inset-0 opacity-30" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Olá, {user?.full_name?.split(" ")[0]}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Sua cidade, sua segurança.</p>
            </div>
            <Button size="lg" onClick={() => openRegister("crime")}>
              <Plus className="w-4 h-4 mr-2" /> Registrar Ocorrência
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Ocorrências" value={occurrences.length} icon={FileText} />
        <StatCard label="Em atendimento" value={openCount} icon={AlertTriangle} accent="warning" />
        <StatCard label="Pontos" value={user?.points || 0} icon={Trophy} accent="success" hint="Cidadão Sentinela" />
        <StatCard label="Medida Protetiva" value={panicEnabled ? "Ativa" : "—"} icon={Shield} accent={panicEnabled ? "success" : "primary"} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { type: "crime", label: "Crime", color: "from-emergency/30 to-emergency/5" },
          { type: "traffic", label: "Trânsito", color: "from-warning/30 to-warning/5" },
          { type: "civil_defense", label: "Defesa Civil", color: "from-chart-5/30 to-chart-5/5" },
          { type: "health", label: "Saúde / SAMU", color: "from-success/30 to-success/5" },
        ].map((a) => (
          <button
            key={a.type}
            onClick={() => openRegister(a.type)}
            className={`p-4 rounded-xl border border-border/60 bg-gradient-to-br ${a.color} hover:border-primary/40 transition-colors text-left`}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Reportar</div>
            <div className="font-semibold">{a.label}</div>
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Minhas Ocorrências</h2>
            <Link to="/ranking" className="text-xs text-primary hover:underline flex items-center gap-1">
              <Award className="w-3 h-3" /> Ver ranking
            </Link>
          </div>
          <OccurrenceList items={occurrences} onOpenChat={(o) => { setChatOccurrence(o); setChatOpen(true); }} />
        </div>

        <div className="space-y-4">
          {panicEnabled ? (
            <PanicButton contacts={contacts} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Botão de pânico indisponível</p>
              <p className="text-xs text-muted-foreground mt-1">
                Envie seu documento de medida protetiva para ativação.
              </p>
            </div>
          )}

          <ProtectiveMeasureCard user={user} onUpdated={refreshUser} />
          <EmergencyContactsManager userId={user?.id} onChange={setContacts} />
          <FirstAidGuide />

          <SecurityNewsFeed city="sua região" />

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <AnonymousTipForm />
          </div>

          <Link to="/disguise" className="block rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <EyeOff className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Modo Disfarçado</h3>
                <p className="text-xs text-muted-foreground">Interface de calculadora. Rastreamento em segundo plano.</p>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <CitizenOccurrenceChat occurrence={chatOccurrence} open={chatOpen} onOpenChange={setChatOpen} />

      <RegisterOccurrenceDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        defaultType={defaultType}
        onCreated={loadOccurrences}
      />
    </div>
  );
}