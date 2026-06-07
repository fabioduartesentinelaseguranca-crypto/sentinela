import AppLayout from "./AppLayout";
import { LayoutDashboard, Trophy, MessageSquare, Shield, HelpCircle, BookOpen, Bell } from "lucide-react";

const NAV = [
  { to: "/admin", end: true, label: "Painel Admin", icon: LayoutDashboard },
  { to: "/training", label: "Capacitação", icon: BookOpen },
  { to: "/achievements", label: "Conquistas", icon: Trophy },
  { to: "/messages", label: "Mensagens", icon: MessageSquare },
  { to: "/wanted", label: "Procurados", icon: Shield },
  { to: "/notifications", label: "Notificações", icon: Bell },
  { to: "/manual", label: "Manual", icon: HelpCircle },
];

export default function AdminLayout() {
  return <AppLayout navItems={NAV} roleLabel="Admin" />;
}