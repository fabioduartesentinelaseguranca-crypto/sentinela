import AppLayout from "./AppLayout";
import { Map, Radio } from "lucide-react";

const NAV = [
  { to: "/agent", end: true, label: "Central", icon: Map },
];

export default function AgentLayout() {
  return <AppLayout navItems={NAV} roleLabel="Agente" />;
}