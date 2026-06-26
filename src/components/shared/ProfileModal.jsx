import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Loader2, User as UserIcon, Check } from "lucide-react";
import { toast } from "sonner";

export default function ProfileModal({ open, onClose }) {
  const { user, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      await refreshUser();
      toast.success("Nome atualizado!");
      onClose();
    } catch {
      toast.error("Erro ao salvar.");
    }
    setSaving(false);
  };

  const avatarUrl = user?.avatar_url;
  const initials = (user?.full_name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Meu Perfil</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* Avatar */}
          <div className="relative group">
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
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          </div>

          <div className="text-center">
            <div className="font-semibold">{user?.full_name}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
            <div className="text-[10px] uppercase tracking-widest text-primary mt-1">{user?.role}</div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Nome de exibição</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <Button onClick={handleSaveName} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}