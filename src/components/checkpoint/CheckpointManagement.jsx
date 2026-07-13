import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, ShieldAlert, Trash2, Plus } from "lucide-react";
import CheckpointFaceCapture from "@/components/checkpoint/CheckpointFaceCapture";

function StudentForm({ onSaved }) {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ name: "", class: "", allowed_checkin_time: "07:00", allowed_checkout_time: "12:00" });
  const [biometria, setBiometria] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => { setStudents(await base44.entities.Students.list("-created_date", 100)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) { toast.error("Nome é obrigatório"); return; }
    if (!biometria?.embedding?.length) { toast.error("Biometria facial é obrigatória"); return; }
    setLoading(true);
    try {
      await base44.entities.Students.create({
        name: form.name, class: form.class,
        allowed_checkin_time: form.allowed_checkin_time,
        allowed_checkout_time: form.allowed_checkout_time,
        status: "outside",
        photo_url: biometria.file_url,
        face_embedding: biometria.embedding,
      });
      toast.success("Aluno cadastrado com biometria");
      setForm({ name: "", class: "", allowed_checkin_time: "07:00", allowed_checkout_time: "12:00" });
      setBiometria(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Students.delete(id); load(); onSaved?.(); toast.info("Aluno removido"); };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Input placeholder="Nome do aluno *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Turma / classe" value={form.class} onChange={(e) => setForm({ ...form, class: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-muted-foreground">Entrada permitida</label><Input type="time" value={form.allowed_checkin_time} onChange={(e) => setForm({ ...form, allowed_checkin_time: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Saída permitida</label><Input type="time" value={form.allowed_checkout_time} onChange={(e) => setForm({ ...form, allowed_checkout_time: e.target.value })} /></div>
          </div>
          <CheckpointFaceCapture onCapture={setBiometria} />
          <Button className="w-full" onClick={save} disabled={loading}>{loading ? "Salvando..." : "Cadastrar Aluno"}</Button>
        </div>
        <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
          {students.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
              {s.photo_url ? <img src={s.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <GraduationCap className="w-8 h-8 text-muted-foreground" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.class} · {s.allowed_checkin_time}-{s.allowed_checkout_time} · <span className={s.status === "inside" ? "text-success" : "text-muted-foreground"}>{s.status === "inside" ? "dentro" : "fora"}</span></div>
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
          {students.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno cadastrado.</p>}
        </div>
      </div>
    </div>
  );
}

function WantedForm({ onSaved }) {
  const [wanted, setWanted] = useState([]);
  const [form, setForm] = useState({ alias: "", threat_level: "high", notes: "" });
  const [biometria, setBiometria] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => { setWanted(await base44.entities.Wanted_Persons.list("-created_date", 100)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.alias) { toast.error("Alias é obrigatório"); return; }
    if (!biometria?.embedding?.length) { toast.error("Biometria facial é obrigatória"); return; }
    setLoading(true);
    try {
      await base44.entities.Wanted_Persons.create({
        alias: form.alias, threat_level: form.threat_level, notes: form.notes,
        photo_url: biometria.file_url, face_embedding: biometria.embedding,
      });
      toast.success("Procurado cadastrado");
      setForm({ alias: "", threat_level: "high", notes: "" });
      setBiometria(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Wanted_Persons.delete(id); load(); onSaved?.(); toast.info("Removido"); };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Alias / nome *" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
        <Select value={form.threat_level} onValueChange={(v) => setForm({ ...form, threat_level: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Média</SelectItem></SelectContent>
        </Select>
        <Textarea placeholder="Notas / observações" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <CheckpointFaceCapture onCapture={setBiometria} />
        <Button className="w-full bg-destructive hover:bg-destructive/90" onClick={save} disabled={loading}><Plus className="w-4 h-4 mr-2" />{loading ? "Salvando..." : "Cadastrar Procurado"}</Button>
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin">
        {wanted.map((w) => (
          <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            {w.photo_url ? <img src={w.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <ShieldAlert className="w-8 h-8 text-destructive" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{w.alias}</div>
              <div className="text-xs"><span className={w.threat_level === "high" ? "text-destructive" : "text-warning"}>{w.threat_level === "high" ? "Ameaça Alta" : "Ameaça Média"}</span></div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(w.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {wanted.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum procurado cadastrado.</p>}
      </div>
    </div>
  );
}

export default function CheckpointManagement({ onChange }) {
  return (
    <Tabs defaultValue="students">
      <TabsList className="mb-4">
        <TabsTrigger value="students"><GraduationCap className="w-4 h-4 mr-1.5" /> Alunos</TabsTrigger>
        <TabsTrigger value="wanted"><ShieldAlert className="w-4 h-4 mr-1.5" /> Procurados</TabsTrigger>
      </TabsList>
      <TabsContent value="students"><StudentForm onSaved={onChange} /></TabsContent>
      <TabsContent value="wanted"><WantedForm onSaved={onChange} /></TabsContent>
    </Tabs>
  );
}