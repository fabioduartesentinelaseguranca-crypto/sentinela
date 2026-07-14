import EscolarManagement from "@/components/checkpoint/escolar/EscolarManagement";
import ProcuradosManagement from "@/components/checkpoint/procurados/ProcuradosManagement";

export default function CheckpointManagement({ module, onChange }) {
  return module === "procurados"
    ? <ProcuradosManagement onSaved={onChange} />
    : <EscolarManagement onSaved={onChange} />;
}