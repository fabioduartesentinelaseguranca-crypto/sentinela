import AppLayout from "./AppLayout";
import { LayoutDashboard, Map, Trophy } from "lucide-react";

const NAV = [
  { to: "/admin", end: true, label: "Painel", icon: LayoutDashboard },
  { to: "/agent", label: "Central Ops", icon: Map },
  { to: "/ranking", label: "Ranking", icon: Trophy },
];

export default function AdminLayout() {
  return <AppLayout navItems={NAV} roleLabel="Admin" />;
}