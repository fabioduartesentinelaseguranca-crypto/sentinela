import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { MessageSquare } from "lucide-react";

/**
 * Notification badge shown in the top bar.
 * Shows count of unread direct messages.
 */
export default function MessagingBadge() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  const check = async () => {
    if (!user?.id) return;
    const threads = await base44.entities.MessageThread.list("-last_message_at", 100);
    const mine = threads.filter((t) => (t.participant_ids || []).includes(user.id));
    let count = 0;
    for (const t of mine) {
      const msgs = await base44.entities.DirectMessage.filter({ thread_id: t.id }, "-created_date", 50);
      count += msgs.filter((m) => m.sender_id !== user.id && !(m.read_by || []).includes(user.id)).length;
    }
    setUnread(count);
  };

  useEffect(() => {
    if (!user?.id) return;
    check();
    const unsub = base44.entities.DirectMessage.subscribe(() => check());
    return () => unsub?.();
  }, [user?.id]);

  return (
    <button
      onClick={() => navigate("/messages")}
      className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      title="Central de Mensagens"
    >
      <MessageSquare className="w-5 h-5 text-muted-foreground" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-emergency text-white rounded-full text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}