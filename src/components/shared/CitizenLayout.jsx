import AppLayout from "./AppLayout";
import { Home, Award, HelpCircle } from "lucide-react";

const NAV = [
  { to: "/citizen", end: true, label: "Início", icon: Home },
  { to: "/ranking", label: "Ranking", icon: Award },
  { to: "/manual", label: "Manual", icon: HelpCircle },
];

export default function CitizenLayout() {
  return <AppLayout navItems={NAV} roleLabel="Cidadão" />;
}