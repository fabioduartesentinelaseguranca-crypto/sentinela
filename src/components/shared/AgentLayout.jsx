import AppLayout from "./AppLayout";
import { Map, MessageSquare } from "lucide-react";

const NAV = [
  { to: "/agent", end: true, label: "Central", icon: Map },
  { to: "/messages", label: "Mensagens", icon: MessageSquare },
];

export default function AgentLayout() {
  return <AppLayout navItems={NAV} roleLabel="Agente" />;
}