import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Plus, Send, Users, CheckCheck, Search } from "lucide-react";
import NewThreadDialog from "@/components/messaging/NewThreadDialog";

function ThreadItem({ thread, active, currentUserId, onClick }) {
  const unread = thread._unreadCount || 0;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl transition-colors flex items-start gap-3 ${
        active ? "bg-primary/15 border border-primary/30" : "hover:bg-muted/50 border border-transparent"
      }`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
        thread.type === "group" ? "bg-chart-5/20 text-chart-5" : "bg-primary/20 text-primary"
      }`}>
        {thread.type === "group" ? <Users className="w-4 h-4" /> : (thread.name || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{thread.name || "Conversa"}</span>
          {thread.last_message_at && (
            <span className="text-[10px] text-muted-foreground font-mono ml-1 flex-shrink-0">
              {format(new Date(thread.last_message_at), "HH:mm")}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground truncate">{thread.last_message || "..."}</span>
          {unread > 0 && (
            <span className="ml-1 bg-primary text-primary-foreground rounded-full text-[10px] px-1.5 py-0.5 font-bold flex-shrink-0">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ msg, currentUserId }) {
  const mine = msg.sender_id === currentUserId;
  const readByOthers = (msg.read_by || []).filter((id) => id !== currentUserId).length > 0;

  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
      {!mine && (
        <span className="text-[10px] text-muted-foreground mb-1 px-1">
          {msg.sender_name || "Usuário"} · {msg.sender_role || ""}
        </span>
      )}
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 ${
        mine
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border/60 text-foreground"
      }`}>
        <div className="text-sm leading-relaxed">{msg.content}</div>
        <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${mine ? "justify-end opacity-70" : "opacity-50"}`}>
          {format(new Date(msg.created_date), "HH:mm")}
          {mine && <CheckCheck className={`w-3 h-3 ${readByOthers ? "text-sky-300" : ""}`} />}
        </div>
      </div>
    </div>
  );
}

export default function MessagingCenter() {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const bottomRef = useRef(null);

  const loadThreads = async () => {
    const all = await base44.entities.MessageThread.list("-last_message_at", 100);
    const mine = all.filter((t) => (t.participant_ids || []).includes(user?.id));
    // Count unread per thread
    const withUnread = await Promise.all(
      mine.map(async (t) => {
        const msgs = await base44.entities.DirectMessage.filter({ thread_id: t.id }, "-created_date", 50);
        const unread = msgs.filter((m) => m.sender_id !== user?.id && !(m.read_by || []).includes(user?.id)).length;
        return { ...t, _unreadCount: unread };
      })
    );
    setThreads(withUnread);
  };

  const loadMessages = async (thread) => {
    if (!thread) return;
    const msgs = await base44.entities.DirectMessage.filter({ thread_id: thread.id }, "created_date", 200);
    setMessages(msgs);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    // Mark unread as read
    const unread = msgs.filter((m) => m.sender_id !== user?.id && !(m.read_by || []).includes(user?.id));
    for (const m of unread) {
      await base44.entities.DirectMessage.update(m.id, { read_by: [...(m.read_by || []), user?.id] });
    }
  };

  useEffect(() => {
    if (!user) return;
    loadThreads();
    const unsub = base44.entities.DirectMessage.subscribe(() => {
      loadThreads();
      if (activeThread) loadMessages(activeThread);
    });
    return () => unsub?.();
  }, [user?.id]);

  useEffect(() => {
    if (activeThread) loadMessages(activeThread);
  }, [activeThread?.id]);

  const send = async () => {
    if (!text.trim() || !activeThread) return;
    const content = text.trim();
    setText("");
    await base44.entities.DirectMessage.create({
      thread_id: activeThread.id,
      sender_id: user?.id,
      sender_name: user?.full_name,
      sender_role: user?.role,
      content,
      read_by: [user?.id],
    });
    await base44.entities.MessageThread.update(activeThread.id, {
      last_message: content.slice(0, 60),
      last_message_at: new Date().toISOString(),
    });
    loadMessages(activeThread);
    loadThreads();
  };

  const filteredThreads = threads.filter((t) =>
    !search || (t.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = threads.reduce((s, t) => s + (t._unreadCount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Central de Mensagens</h1>
        {totalUnread > 0 && (
          <span className="bg-emergency text-white rounded-full text-xs px-2 py-0.5 font-bold">
            {totalUnread} não lida{totalUnread > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-3 overflow-hidden">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" onClick={() => setShowNewThread(true)} className="flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
            {filteredThreads.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-8">
                Nenhuma conversa. Clique em + para iniciar.
              </p>
            )}
            {filteredThreads.map((t) => (
              <ThreadItem
                key={t.id}
                thread={t}
                active={activeThread?.id === t.id}
                currentUserId={user?.id}
                onClick={() => setActiveThread(t)}
              />
            ))}
          </div>
        </div>

        {/* Chat area */}
        {activeThread ? (
          <div className="flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                activeThread.type === "group" ? "bg-chart-5/20 text-chart-5" : "bg-primary/20 text-primary"
              }`}>
                {activeThread.type === "group" ? <Users className="w-4 h-4" /> : (activeThread.name || "?").charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-sm">{activeThread.name || "Conversa"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {activeThread.type === "group" ? "Grupo" : "Mensagem direta"} · {activeThread.participant_ids?.length || 0} participantes
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} currentUserId={user?.id} />
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border/60 flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Escreva uma mensagem..."
                className="flex-1"
              />
              <Button size="icon" onClick={send} disabled={!text.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/60 bg-card flex items-center justify-center text-center p-8">
            <div>
              <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm text-muted-foreground">Selecione uma conversa ou crie uma nova</p>
            </div>
          </div>
        )}
      </div>

      <NewThreadDialog
        open={showNewThread}
        onOpenChange={setShowNewThread}
        currentUser={user}
        onCreated={(t) => { setActiveThread(t); loadThreads(); }}
      />
    </div>
  );
}