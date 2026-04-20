import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function EmergencyContactsManager({ userId, onChange }) {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ name: "", phone: "", relation: "" });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const list = await base44.entities.EmergencyContact.filter({ owner_id: userId });
    setContacts(list);
    onChange?.(list);
  };

  useEffect(() => { if (userId) load(); }, [userId]);

  const add = async () => {
    if (!form.name || !form.phone) return toast.error("Nome e telefone obrigatórios");
    if (contacts.length >= 3) return toast.error("Máximo de 3 contatos");
    setLoading(true);
    await base44.entities.EmergencyContact.create({ ...form, owner_id: userId });
    setForm({ name: "", phone: "", relation: "" });
    await load();
    setLoading(false);
  };

  const remove = async (id) => {
    await base44.entities.EmergencyContact.delete(id);
    await load();
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Rede de Apoio
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Até 3 contatos serão notificados via WhatsApp no acionamento do pânico.
          </p>
        </div>
        <span className="text-xs text-muted-foreground font-mono">{contacts.length}/3</span>
      </div>

      <div className="space-y-2 mb-4">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="text-sm font-medium">{c.name} {c.relation && <span className="text-muted-foreground font-normal">· {c.relation}</span>}</div>
              <div className="text-xs text-muted-foreground font-mono">{c.phone}</div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      {contacts.length < 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Telefone (DDD+número)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input placeholder="Relação (opcional)" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
          <Button onClick={add} disabled={loading} className="md:col-span-3">
            <Plus className="w-4 h-4 mr-2" /> Adicionar contato
          </Button>
        </div>
      )}
    </div>
  );
}