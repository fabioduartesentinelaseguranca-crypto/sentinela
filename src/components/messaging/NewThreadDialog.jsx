import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function NewThreadDialog({ open, onOpenChange, currentUser, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.entities.User.filter({ role: ["agent", "admin"] }, "-created_date", 100).then((all) =>
      setUsers(all.filter((u) => u.id !== currentUser?.id))
    );
  }, [open, currentUser?.id]);

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = async () => {
    if (selected.length === 0) return toast.error("Selecione ao menos um participante");
    setLoading(true);
    const participants = [currentUser?.id, ...selected];
    const isGroup = participants.length > 2;
    const name = isGroup
      ? groupName || `Grupo (${participants.length})`
      : users.find((u) => u.id === selected[0])?.full_name || "Conversa";

    const thread = await base44.entities.MessageThread.create({
      name,
      type: isGroup ? "group" : "direct",
      participant_ids: participants,
      last_message_at: new Date().toISOString(),
    });
    toast.success("Conversa criada");
    onCreated?.(thread);
    setSelected([]);
    setGroupName("");
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Nova Conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto scrollbar-thin">
          {selected.length > 1 && (
            <div>
              <Label className="text-xs">Nome do grupo</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Equipe Alpha" className="mt-1" />
            </div>
          )}

          <div>
            <Label className="text-xs mb-2 block">Participantes ({selected.length} selecionados)</Label>
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin">
              {users.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.includes(u.id)}
                    onCheckedChange={() => toggle(u.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground">{u.role} · {u.email}</div>
                  </div>
                </label>
              ))}
              {users.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum agente/admin encontrado</p>
              )}
            </div>
          </div>
        </div>

        <Button onClick={create} disabled={loading || selected.length === 0} className="mt-3">
          {selected.length > 1 ? <Users className="w-4 h-4 mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
          {selected.length > 1 ? "Criar Grupo" : "Iniciar Conversa"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}