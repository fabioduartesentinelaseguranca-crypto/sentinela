import AppLayout from "./AppLayout";
import { Home, Award, HelpCircle, MapPin, Navigation, Shield } from "lucide-react";
import { useModulos } from "@/lib/useModulos.jsx";

const ALL_NAV = [
  { to: "/citizen", end: true, label: "Início", icon: Home, modulo: null },
  { to: "/ranking", label: "Ranking", icon: Award, modulo: null },
  { to: "/rotas-seguras", label: "Rotas Seguras", icon: MapPin, modulo: "cidadao_rotas_seguras" },
  { to: "/caminhe-comigo", label: "Caminhe Comigo", icon: Navigation, modulo: "cidadao_caminhe_comigo" },
  { to: "/manual", label: "Manual", icon: HelpCircle, modulo: null },
];

export default function CitizenLayout() {
  const { hasModulo } = useModulos();
  const navItems = ALL_NAV.filter(item => !item.modulo || hasModulo(item.modulo));
  return <AppLayout navItems={navItems} roleLabel="Cidadão" />;
}