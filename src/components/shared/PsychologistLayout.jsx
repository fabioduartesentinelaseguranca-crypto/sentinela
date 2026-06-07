import AppLayout from "./AppLayout";
import { Brain, Bell, HelpCircle } from "lucide-react";

const NAV = [
  { to: "/psych", end: true, label: "Painel", icon: Brain },
  { to: "/notifications", label: "Notificações", icon: Bell },
  { to: "/manual", label: "Manual", icon: HelpCircle },
];

export default function PsychologistLayout() {
  return <AppLayout navItems={NAV} roleLabel="Psicólogo" />;
}