import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Send, Lock } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";

export default function CitizenOccurrenceChat({ occurrence, open, onOpenChange }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  const load = async () => {
    if (!occurrence?.id) return;
    const list = await base44.entities.ChatMessage.filter({ occurrence_id: occurrence.id }, "created_date", 200);
    setMessages(list);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => {
    if (!open) return;
    load();
    const unsub = base44.entities.ChatMessage.subscribe((e) => {
      if (e.data?.occurrence_id === occurrence?.id) load();
    });
    return () => unsub?.();
  }, [open, occurrence?.id]);

  const send = async () => {
    if (!text.trim()) return;
    await base44.entities.ChatMessage.create({
      occurrence_id: occurrence.id,
      sender_id: user.id,
      sender_name: user.full_name,
      content: text,
    });
    setText("");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[600px] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Acompanhamento da Ocorrência
            <span className="ml-auto flex items-center gap-1 text-[10px] uppercase tracking-wider text-success">
              <Lock className="w-3 h-3" /> Seguro
            </span>
          </DialogTitle>
          {occurrence && (
            <p className="text-xs text-muted-foreground text-left">
              {occurrence.subtype || occurrence.type}
              {occurrence.address ? ` · ${occurrence.address}` : ""}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {messages.length === 0 && (
            <div className="text-center text-xs text-muted-foreground mt-10">
              Nenhuma mensagem ainda. O agente responsável pode entrar em contato aqui.
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {!mine && <div className="text-[10px] font-semibold mb-0.5 opacity-80">{m.sender_name || "Agente"}</div>}
                  <div className="text-sm">{m.content}</div>
                  <div className="text-[10px] opacity-60 mt-0.5 font-mono">
                    {format(new Date(m.created_date), "HH:mm")}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <div className="p-3 border-t flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Enviar mensagem ao agente..."
          />
          <Button size="icon" onClick={send}><Send className="w-4 h-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}