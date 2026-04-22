import AppLayout from "./AppLayout";
import { LayoutDashboard, Map, Trophy, MessageSquare } from "lucide-react";

const NAV = [
  { to: "/admin", end: true, label: "Painel", icon: LayoutDashboard },
  { to: "/agent", label: "Central Ops", icon: Map },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/messages", label: "Mensagens", icon: MessageSquare },
];

export default function AdminLayout() {
  return <AppLayout navItems={NAV} roleLabel="Admin" />;
}