import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Paperclip, MapPin, Mic, MicOff, Image,
  Video, MessageSquare, Users, AlertTriangle, Loader2, X
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const CHANNELS = [
  { id: "general", label: "Geral", icon: MessageSquare },
  { id: "agents", label: "Agentes", icon: Users },
  { id: "alerts", label: "Alertas", icon: AlertTriangle },
];

export default function UnifiedChat({ occurrenceId = null }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(occurrenceId ? `occ-${occurrenceId}` : "general");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [files, setFiles] = useState([]);
  const bottomRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fileInputRef = useRef(null);

  const loadMessages = async () => {
    const msgs = await base44.entities.ChatMessage.filter({ channel }, "-created_date", 60);
    setMessages(msgs.reverse());
  };

  useEffect(() => {
    loadMessages();
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel !== channel) return;
      if (event.type === "create") setMessages((prev) => [...prev, event.data]);
    });
    return unsub;
  }, [channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content, extra = {}) => {
    if (!content?.trim() && !extra.media_url && !extra.location) return;
    setSending(true);
    await base44.entities.ChatMessage.create({
      channel,
      sender_id: user?.id,
      sender_name: user?.full_name || "Usuário",
      sender_role: user?.role || "citizen",
      content: content?.trim() || "",
      occurrence_id: occurrenceId,
      ...extra,
    });
    setText("");
    setFiles([]);
    setSending(false);
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) return toast.error("Geolocalização não suportada");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await sendMessage("📍 Localização compartilhada", {
        location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        msg_type: "location",
      });
    }, () => toast.error("Permissão de localização negada"));
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSending(true);
    toast.info("Enviando arquivo...");
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    await sendMessage(`📎 ${f.name}`, { media_url: file_url, msg_type: f.type.startsWith("video") ? "video" : "image" });
    setSending(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
          const result = await base44.integrations.Core.InvokeLLM({
            prompt: `Transcreva o seguinte áudio para texto em português. Retorne apenas a transcrição sem comentários adicionais. Se não conseguir transcrever, retorne: "Áudio recebido (transcrição indisponível)".`,
            file_urls: [file_url],
            response_json_schema: { type: "object", properties: { transcription: { type: "string" } } },
          });
          await sendMessage(`🎙 ${result.transcription || "Áudio recebido"}`, { media_url: file_url, msg_type: "audio" });
        } catch {
          toast.error("Erro na transcrição de áudio");
        }
        setTranscribing(false);
      };
      mr.start();
      setRecording(true);
    } catch {
      toast.error("Sem permissão para microfone");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const ROLE_COLORS = {
    admin: "text-destructive",
    agent: "text-primary",
    psychologist: "text-chart-5",
    citizen: "text-success",
  };

  const isMe = (msg) => msg.sender_id === user?.id;

  return (
    <div className="flex flex-col h-full min-h-[420px] rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Chat Integrado</span>
          {occurrenceId && (
            <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">Ocorrência</span>
          )}
        </div>
        {!occurrenceId && (
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Nenhuma mensagem ainda. Inicie a conversa!
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${isMe(msg) ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] ${isMe(msg) ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {!isMe(msg) && (
                <span className={`text-[10px] font-semibold ${ROLE_COLORS[msg.sender_role] || "text-muted-foreground"} flex items-center gap-1.5`}>
                  {msg.sender_name} · {msg.sender_role}
                  {msg.occurrence_id && (
                    <span className="bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium">Ocorrência</span>
                  )}
                </span>
              )}
              {isMe(msg) && msg.occurrence_id && (
                <span className="text-[10px] bg-warning/20 text-warning px-1.5 py-0.5 rounded font-medium self-end">Ocorrência</span>
              )}
              <div className={`rounded-2xl px-3 py-2 text-sm ${isMe(msg) ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted/40 border border-border/40 rounded-bl-sm"}`}>
                {msg.msg_type === "location" && msg.location ? (
                  <a
                    href={`https://www.google.com/maps?q=${msg.location.lat},${msg.location.lng}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 underline"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Ver no mapa
                  </a>
                ) : msg.msg_type === "image" && msg.media_url ? (
                  <div>
                    <img src={msg.media_url} alt="img" className="max-w-[200px] rounded-lg mb-1" onError={(e) => e.target.style.display = "none"} />
                    {msg.content && <p>{msg.content}</p>}
                  </div>
                ) : msg.msg_type === "video" && msg.media_url ? (
                  <div>
                    <video src={msg.media_url} controls className="max-w-[200px] rounded-lg mb-1" />
                    {msg.content && <p>{msg.content}</p>}
                  </div>
                ) : msg.msg_type === "audio" && msg.media_url ? (
                  <div className="space-y-1">
                    <audio src={msg.media_url} controls className="w-full max-w-[200px]" />
                    {msg.content && <p className="text-xs italic opacity-80">{msg.content}</p>}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground px-1">
                {msg.created_date ? format(new Date(msg.created_date), "HH:mm") : ""}
              </span>
            </div>
          </div>
        ))}
        {transcribing && (
          <div className="flex justify-start">
            <div className="bg-muted/40 border border-border/40 rounded-2xl px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcrevendo áudio...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border/60 p-3 bg-muted/10">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending}>
            <Paperclip className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={shareLocation} disabled={sending}>
            <MapPin className="w-4 h-4" />
          </Button>
          <Button
            variant={recording ? "destructive" : "ghost"}
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
          >
            {recording ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
          </Button>
          <Input
            className="flex-1 h-8 text-sm"
            placeholder={recording ? "Gravando... clique no mic para parar" : "Mensagem..."}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(text); } }}
            disabled={sending || recording}
          />
          <Button size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => sendMessage(text)} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        {recording && (
          <p className="text-[10px] text-destructive mt-1 text-center animate-pulse">⏺ Gravando — clique no microfone para parar e transcrever</p>
        )}
      </div>
    </div>
  );
}