import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, Check, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export default function ProfileModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.full_name || "");
  const fileRef = useRef();

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      await refreshUser();
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar foto.");
    }
    setUploading(false);
  };

  const handleRemovePhoto = async () => {
    try {
      await base44.auth.updateMe({ avatar_url: null });
      await refreshUser();
      toast.success("Foto removida.");
    } catch {
      toast.error("Erro ao remover foto.");
    }
  };

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      await refreshUser();
      toast.success("Nome atualizado!");
      setEditing(false);
    } catch {
      toast.error("Erro ao salvar.");
    }
    setSaving(false);
  };

  const avatarUrl = user?.avatar_url;
  const initials = (user?.full_name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  const ROLE_LABEL = {
    admin: "Administrador",
    agent: "Agente",
    citizen: "Cidadão",
    psychologist: "Psicólogo",
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>

        {/* Avatar section */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-primary/30 overflow-hidden bg-muted flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              title="Trocar foto"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          {avatarUrl && (
            <button
              onClick={handleRemovePhoto}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <Trash2 className="w-3 h-3" /> Remover foto
            </button>
          )}
        </div>

        {/* Info section */}
        <div className="rounded-xl border border-border/60 bg-muted/30 divide-y divide-border/40">
          {/* Nome */}
          <div className="flex items-center justify-between px-4 py-3 gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Nome</div>
              {editing ? (
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditing(false); }}
                />
              ) : (
                <div className="font-medium text-sm truncate">{user?.full_name || "—"}</div>
              )}
            </div>
            {editing ? (
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" className="w-7 h-7" onClick={handleSaveName} disabled={saving}>
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </Button>
                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => { setEditing(false); setName(user?.full_name || ""); }}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="w-7 h-7 flex-shrink-0" onClick={() => { setName(user?.full_name || ""); setEditing(true); }}>
                <Pencil className="w-3 h-3" />
              </Button>
            )}
          </div>

          {/* E-mail */}
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">E-mail</div>
            <div className="text-sm break-all">{user?.email || "—"}</div>
          </div>

          {/* Perfil / Role */}
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Perfil</div>
            <div className="text-sm font-medium text-primary">{ROLE_LABEL[user?.role] || user?.role || "—"}</div>
          </div>

          {/* ID */}
          <div className="px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">ID do usuário</div>
            <div className="text-xs text-muted-foreground font-mono truncate">{user?.id || "—"}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}