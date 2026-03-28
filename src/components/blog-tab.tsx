import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Clock, Calendar, MessageSquare, Send, BookOpen,
  User, Tag, ChevronRight, Loader2, PenSquare, ImageIcon,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { BlogPost, BlogComment, AdSlot } from "@shared/schema";

// ─── AD SLOT RENDERER ──────────────────────────────────────────────────────
function AdSlotRenderer({ slotName }: { slotName: string }) {
  const { data: slots = [] } = useQuery<AdSlot[]>({ queryKey: ["/api/ad-slots"] });
  const slot = slots.find(s => s.slotName === slotName && s.isActive && s.htmlCode.trim());
  if (!slot) return null;
  return (
    <div
      className="my-6 rounded-xl overflow-hidden border border-dashed border-border bg-muted/20"
      dangerouslySetInnerHTML={{ __html: slot.htmlCode }}
      data-testid={`ad-slot-${slotName}`}
    />
  );
}

// ─── COMMENT SECTION ───────────────────────────────────────────────────────
function CommentSection({ post, isAdmin }: { post: BlogPost; isAdmin: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: comments = [], isLoading } = useQuery<BlogComment[]>({
    queryKey: ["/api/blog", post.id, "comments"],
    queryFn: () => fetch(`/api/blog/${post.id}/comments`).then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/blog/${post.id}/comments`, { content: commentText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog", post.id, "comments"] });
      setCommentText("");
      toast({ title: "Comment posted!" });
    },
    onError: () => toast({ title: "Failed to post comment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/blog/comments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/blog", post.id, "comments"] }),
    onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
  });

  const initials = (name: string | null) =>
    (name || "?").split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold font-serif text-foreground">
          {comments.length} Comment{comments.length !== 1 ? "s" : ""}
        </h3>
      </div>

      {user ? (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Leave a comment</p>
          <Textarea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Share your thoughts, tips, or questions…"
            rows={3}
            className="resize-none"
            data-testid="input-blog-comment"
          />
          <Button
            onClick={() => addMutation.mutate()}
            disabled={!commentText.trim() || addMutation.isPending}
            className="gap-2"
            data-testid="button-submit-comment"
          >
            {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {addMutation.isPending ? "Posting…" : "Post Comment"}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <p className="text-sm text-muted-foreground">Sign in to leave a comment and join the conversation.</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-muted-foreground py-6 text-sm">Be the first to comment!</p>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="w-9 h-9 flex-shrink-0 mt-0.5">
                <AvatarImage src={comment.authorImageUrl ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials(comment.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{comment.authorName || "Reader"}</p>
                  {comment.createdAt && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(comment.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm("Delete this comment?")) deleteMutation.mutate(comment.id); }}
                      className="ml-auto text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed mt-1 whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── POST DETAIL ───────────────────────────────────────────────────────────
function PostDetail({ slug, onBack, isAdmin }: { slug: string; onBack: () => void; isAdmin: boolean }) {
  const { data: post, isLoading } = useQuery<BlogPost>({
    queryKey: ["/api/blog", slug],
    queryFn: () => fetch(`/api/blog/${slug}`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-64 rounded-2xl bg-muted" />
        <div className="h-8 w-3/4 rounded-lg bg-muted" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 rounded bg-muted" />)}
        </div>
      </div>
    );
  }

  if (!post || (post as any).message) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Post not found.</p>
        <Button variant="outline" onClick={onBack} className="mt-4">Back to Blog</Button>
      </div>
    );
  }

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "Draft";

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" /> Back to Blog
      </Button>

      {/* Cover image */}
      {post.coverImageData && post.coverImageData !== "has_image" && (
        <div className="rounded-2xl overflow-hidden aspect-[16/7] w-full">
          <img
            src={post.coverImageData.startsWith("data:") ? post.coverImageData : `data:image/jpeg;base64,${post.coverImageData}`}
            alt={post.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div className="space-y-4">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1">
                <Tag className="w-3 h-3" />{tag}
              </Badge>
            ))}
          </div>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold font-serif text-foreground leading-tight">{post.title}</h1>
        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <User className="w-4 h-4" />
            <span>{post.authorName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{post.readTimeMinutes} min read</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Top ad slot */}
      <AdSlotRenderer slotName="blog_banner_top" />

      {/* Post content — rendered markdown */}
      <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-serif prose-headings:text-foreground prose-p:text-foreground prose-p:leading-relaxed prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>

      {/* Inline ad after content */}
      <AdSlotRenderer slotName="blog_inline" />

      <Separator />

      {/* Comments */}
      <CommentSection post={post} isAdmin={isAdmin} />

      {/* Bottom ad */}
      <AdSlotRenderer slotName="blog_banner_bottom" />
    </article>
  );
}

// ─── POST CARD ─────────────────────────────────────────────────────────────
function PostCard({ post, onClick, isAdmin }: { post: BlogPost & { coverImageData: string | null }; onClick: () => void; isAdmin: boolean }) {
  const date = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Draft";

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-200"
      data-testid={`blog-card-${post.id}`}
    >
      {/* Cover image */}
      <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden relative">
        {post.coverImageData && post.coverImageData !== "has_image" ? (
          <img
            src={post.coverImageData.startsWith("data:") ? post.coverImageData : `data:image/jpeg;base64,${post.coverImageData}`}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <BookOpen className="w-10 h-10 text-primary/30" />
            {!post.isPublished && isAdmin && (
              <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Draft</Badge>
            )}
          </div>
        )}
        {!post.isPublished && isAdmin && post.coverImageData && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="text-[10px] bg-card/80 border-amber-400 text-amber-600">Draft</Badge>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map(tag => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0">{tag}</Badge>
            ))}
          </div>
        )}
        <h3 className="font-bold font-serif text-foreground text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{post.excerpt}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{date}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTimeMinutes}m</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </div>
  );
}

// ─── BLOG TAB (Main) ───────────────────────────────────────────────────────
export function BlogTab({ isAdmin }: { isAdmin: boolean }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog", isAdmin ? "admin" : "public"],
    queryFn: () => fetch(`/api/blog${isAdmin ? "?admin=1" : ""}`).then(r => r.json()),
  });

  if (openSlug) {
    return (
      <div className="pt-4 pb-20 sm:pb-8 px-2">
        <PostDetail slug={openSlug} onBack={() => setOpenSlug(null)} isAdmin={isAdmin} />
      </div>
    );
  }

  return (
    <div className="pt-4 pb-20 sm:pb-8 px-2 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2 py-4">
        <div className="flex items-center justify-center gap-2 text-primary">
          <PenSquare className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-widest">Palate Lit Blog</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold font-serif text-foreground">
          Stories from the Kitchen
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
          Recipes, food stories, cooking tips and the flavours of India — from our table to yours.
        </p>
      </div>

      {/* Top banner ad */}
      <AdSlotRenderer slotName="blog_banner_top" />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden animate-pulse">
              <div className="aspect-[16/9] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-1/3 bg-muted rounded" />
                <div className="h-5 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 space-y-4">
          <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground">No posts published yet.</p>
          {isAdmin && (
            <p className="text-sm text-muted-foreground">Go to the Admin panel → Blog Posts to write your first post.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post as BlogPost & { coverImageData: string | null }}
              onClick={() => setOpenSlug(post.slug)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      {/* Bottom ad */}
      <AdSlotRenderer slotName="blog_banner_bottom" />
    </div>
  );
}
