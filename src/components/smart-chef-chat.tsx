import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChefHat, X, Send, Sparkles, RotateCcw, BookMarked, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SmartChefChatProps {
  recipeContext?: string | null;
}

const SUGGESTED_QUESTIONS = [
  "What can I substitute for paneer?",
  "How do I make dal more flavourful?",
  "Tips for fluffy rotis?",
  "What spices for biryani?",
];

function looksLikeRecipe(text: string): boolean {
  const lower = text.toLowerCase();
  const hasIngredients = /ingredient/.test(lower);
  const hasInstructions = /instruction|method|step|direction|preparation/.test(lower);
  return hasIngredients && hasInstructions;
}

export function SmartChefChat({ recipeContext }: SmartChefChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const saveRecipeMutation = useMutation({
    mutationFn: async ({ messageText, index }: { messageText: string; index: number }) => {
      const res = await fetch("/api/chef-chat/save-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messageText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to save recipe");
      }
      return { data: await res.json(), index };
    },
    onSuccess: ({ data, index }) => {
      setSavedIndices((prev) => new Set([...prev, index]));
      qc.invalidateQueries({ queryKey: ["/api/recipes"] });
      toast({
        title: data.alreadyExists ? "Already in your library" : "Recipe added!",
        description: data.alreadyExists
          ? `"${data.recipe.title}" is already in the recipe library.`
          : `"${data.recipe.title}" has been added to the recipe library.`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save recipe",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chef-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          messages: newMessages,
          recipeContext: recipeContext || null,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.content) {
              full += evt.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: full };
                return updated;
              });
            }
          } catch {}
        }
      }

      // Auto-save general Q&A answers (not recipes) to the blog
      if (full.length > 80 && !looksLikeRecipe(full)) {
        fetch("/api/chef-chat/save-to-blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ question: trimmed, answer: full }),
        })
          .then((r) => r.ok && r.json())
          .then((data) => {
            if (data?.success) {
              toast({
                title: "Shared to Blog",
                description: "Your question & Smart Chef's answer have been posted to the Blog.",
              });
            }
          })
          .catch(() => {});
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I couldn't reach the kitchen just now. Please try again.",
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSavedIndices(new Set());
    setStreaming(false);
  };

  return (
    <>
      <button
        data-testid="button-smart-chef-open"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)" }}
      >
        <ChefHat size={18} />
        <span>Smart Chef AI</span>
        <Sparkles size={14} className="opacity-80" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 pb-24 sm:p-6 sm:pb-6 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-sm bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl flex flex-col border border-neutral-200 dark:border-neutral-700 overflow-hidden"
            style={{ height: "min(560px, calc(100vh - 5rem))" }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)" }}
            >
              <div className="flex items-center gap-2">
                <ChefHat size={20} />
                <div>
                  <p className="font-semibold text-sm leading-tight">Smart Chef AI</p>
                  <p className="text-xs opacity-75 leading-tight">Vegetarian cooking assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    data-testid="button-chef-clear"
                    onClick={clearChat}
                    className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                    title="Clear chat"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
                <button
                  data-testid="button-chef-close"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {recipeContext && (
              <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950 border-b border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Sparkles size={11} />
                  Asking about: <span className="font-semibold">{recipeContext}</span>
                </p>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #2d6a4f20, #2d6a4f40)" }}
                  >
                    <ChefHat size={28} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700 dark:text-neutral-200 text-sm">
                      Ask me anything about vegetarian cooking!
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">
                      I know Indian cuisine inside out. Ask for a recipe and I can save it to your library.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        data-testid={`button-suggestion-${q.slice(0, 15).replace(/\s+/g, "-")}`}
                        onClick={() => sendMessage(q)}
                        className="text-xs px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i}>
                    <div
                      data-testid={`message-${msg.role}-${i}`}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2">
                          <ChefHat size={13} className="text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-emerald-600 text-white rounded-br-sm"
                            : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                        {msg.role === "assistant" && i === messages.length - 1 && streaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-emerald-600 ml-0.5 rounded-sm animate-pulse align-middle" />
                        )}
                      </div>
                    </div>
                    {msg.role === "assistant" && !streaming && looksLikeRecipe(msg.content) && (
                      <div className="ml-8 mt-1.5">
                        {savedIndices.has(i) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={13} />
                            Saved to library
                          </span>
                        ) : (
                          <button
                            data-testid={`button-save-recipe-${i}`}
                            onClick={() => saveRecipeMutation.mutate({ messageText: msg.content, index: i })}
                            disabled={saveRecipeMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors disabled:opacity-60"
                          >
                            <BookMarked size={11} />
                            Save to Recipe Library
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-3 py-3 border-t border-neutral-200 dark:border-neutral-700 flex-shrink-0">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  data-testid="input-chef-message"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about ingredients, substitutions, spices… or request a recipe!"
                  className="resize-none text-sm min-h-[40px] max-h-[100px] flex-1 rounded-xl border-neutral-200 dark:border-neutral-700 focus:ring-emerald-500"
                  rows={1}
                  disabled={streaming}
                />
                <Button
                  data-testid="button-chef-send"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || streaming}
                  size="sm"
                  className="h-10 w-10 p-0 rounded-xl flex-shrink-0"
                  style={{ background: "#2d6a4f" }}
                >
                  <Send size={15} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
