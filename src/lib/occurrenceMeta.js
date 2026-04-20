import { Shield, Car, CloudRain, HeartPulse, Siren } from "lucide-react";

export const TYPE_META = {
  crime: { label: "Crime", icon: Shield, color: "text-emergency", bg: "bg-emergency/10", border: "border-emergency/30" },
  traffic: { label: "Trânsito", icon: Car, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  civil_defense: { label: "Defesa Civil", icon: CloudRain, color: "text-chart-5", bg: "bg-chart-5/10", border: "border-chart-5/30" },
  health: { label: "Saúde / SAMU", icon: HeartPulse, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  panic: { label: "Pânico", icon: Siren, color: "text-emergency", bg: "bg-emergency/20", border: "border-emergency/50" },
};

export const SUBTYPES = {
  crime: ["Roubo", "Furto", "Agressão", "Violência Doméstica", "Tráfico", "Outro"],
  traffic: ["Acidente", "Semáforo", "Buraco na Via", "Congestionamento", "Sinalização"],
  civil_defense: ["Enchente", "Deslizamento", "Lâmpada Queimada", "Árvore Caída", "Vazamento"],
  health: ["Emergência Médica", "Acidente", "Mal Súbito", "Outro"],
  panic: ["Emergência Pessoal"],
};

export const STATUS_META = {
  open: { label: "Aberta", color: "text-emergency", bg: "bg-emergency/15" },
  in_progress: { label: "Em Atendimento", color: "text-warning", bg: "bg-warning/15" },
  resolved: { label: "Resolvida", color: "text-success", bg: "bg-success/15" },
  canceled: { label: "Cancelada", color: "text-muted-foreground", bg: "bg-muted" },
};

export const CIVIL_DEFENSE_GAMIFIED = ["Lâmpada Queimada", "Buraco na Via", "Árvore Caída", "Sinalização", "Vazamento"];