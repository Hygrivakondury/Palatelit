import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Send, MessageCircle, Loader2, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CommunityMessage, Recipe } from "@shared/schema";

interface CommunityChatProps {
  recipe: Recipe;
  currentUserId: string;
  onClose: () => void;
  isAdmin?: boolean;
}

export function CommunityChat({ recipe, currentUserId, onClose, isAdmin }: CommunityChatProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages = [], isLoading } = useQuery<CommunityMessage[]>({
    queryKey: ["/api/community-messages", recipe.id],
    queryFn: async () => {
      const res = await fetch(`/api/community-messages/${recipe.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/community-messages/${recipe.id}`, { content });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community-messages", recipe.id] });
      setInput("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/community/messages/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/community-messages", recipe.id] });
      toast({ title: "Message deleted" });
    },
    onError: () => {
      toast({ title: "Delete failed", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(560px, 90vh)" }}>
        <div
          className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)" }}
        >
          <MessageCircle size={18} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{recipe.title}</p>
            <p className="text-xs opacity-75">Community chat</p>
          </div>
          <button
            data-testid="button-community-chat-close"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {recipe.submittedByName && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950 border-b border-emerald-100 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex-shrink-0">
            Recipe by <span className="font-semibold">{recipe.submittedByName}</span> — ask them anything!
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-emerald-600" size={24} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-neutral-500">
              <MessageCircle size={32} className="opacity-30" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                  <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
                    <AvatarImage src={msg.senderImageUrl ?? undefined} />
                    <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                      {(msg.senderName ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className="text-xs text-neutral-500 px-1">{msg.senderName ?? "Community Member"}</span>
                    )}
                    <div
                      data-testid={`community-message-${msg.id}`}
                      className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isMe
                          ? "bg-emerald-600 text-white rounded-br-sm"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-xs text-neutral-400">{formatTime(msg.createdAt)}</span>
                      {isAdmin && (
                        <button
                          data-testid={`button-delete-message-${msg.id}`}
                          onClick={() => deleteMutation.mutate(msg.id)}
                          disabled={deleteMutation.isPending}
                          title="Delete message"
                          className="p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 py-3 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              data-testid="input-community-message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this recipe…"
              className="resize-none text-sm min-h-[40px] max-h-[100px] flex-1 rounded-xl"
              rows={1}
              disabled={sendMutation.isPending}
            />
            <Button
              data-testid="button-community-send"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              size="sm"
              className="h-10 w-10 p-0 rounded-xl flex-shrink-0 bg-emerald-600 hover:bg-emerald-700"
            >
              {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
