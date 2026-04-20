import AppLayout from "./AppLayout";
import { Home, Award } from "lucide-react";

const NAV = [
  { to: "/citizen", end: true, label: "Início", icon: Home },
  { to: "/ranking", label: "Ranking", icon: Award },
];

export default function CitizenLayout() {
  return <AppLayout navItems={NAV} roleLabel="Cidadão" />;
}