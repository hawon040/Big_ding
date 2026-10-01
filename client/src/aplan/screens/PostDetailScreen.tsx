import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronLeft, Flag, Heart, MoreVertical, Send } from "lucide-react";
import { postApi, commentApi, userApi, reportApi } from "@/api/aplan";
import { resolveAssetUrl } from "@/api";
import { formatTime } from "@/utils";
import { Avatar } from "@/aplan/components/Avatar";
import { IconButton } from "@/aplan/components/IconButton";
import { BottomSheet, SheetItem } from "@/aplan/components/BottomSheet";
import { EmptyState, ErrorState, Skeleton } from "@/aplan/components/States";
import { StarRating } from "@/aplan/components/StarRating";
import type { CommentNode, Poll, PostDetail } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface PostDetailScreenProps {
  postId: string;
  onBack: () => void;
  onOpenUser: (id: string) => void;
  /** 글 수정 (아직 없는 화면 — 연결 전까지 더보기 메뉴에서 숨김 처리해도 됨) */
  onEditPost?: (id: string) => void;
}

const REPORT_REASONS = ["스팸/광고", "욕설·혐오 표현", "음란물", "기타"];

// A-09 상세 (Figma 2:524).
// 헤더의 두 아이콘은 Figma 와이어프레임에 빈 사각형으로만 있어 공유·더보기(신고/수정/삭제)로 채웠다.
// 액션 줄의 세 번째 아이콘(의미 불명)은 더보기 메뉴와 기능이 겹쳐 생략했다.
export function PostDetailScreen({ postId, onBack, onOpenUser, onEditPost }: PostDetailScreenProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentNode[] | null>(null);
  const [commentCount, setCommentCount] = useState(0);
  const [acceptedCommentId, setAcceptedCommentId] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [scrapBusy, setScrapBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; nickname: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPost = () => {
    setPostError(null);
    postApi.get(postId).then(setPost).catch((err) => setPostError(err?.response?.data?.message || "게시물을 찾을 수 없어요."));
  };
  const loadComments = () => {
    setCommentsError(null);
    commentApi.tree(postId)
      .then((tree) => {
        setComments(tree.items);
        setCommentCount(tree.commentCount);
        setAcceptedCommentId(tree.acceptedCommentId);
      })
      .catch((err) => setCommentsError(err?.response?.data?.message || null));
  };
  useEffect(() => {
    loadPost();
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // 투표: 다른 선택지를 누르면 옮기고, 같은 선택지를 다시 누르면 취소(서버와 같은 규칙). 낙관적 반영 후 실패하면 다시 불러온다.
  const vote = (index: number) => {
    if (!post?.poll) return;
    const options = post.poll.options.map((o, i) => {
      const was = o.voted;
      const now = i === index ? !was : false;
      return { ...o, voted: now, count: o.count + (now ? 1 : 0) - (was ? 1 : 0) };
    });
    setPost({ ...post, poll: { ...post.poll, options, totalVotes: options.reduce((n, o) => n + o.count, 0) } });
    postApi.vote(postId, index).catch(loadPost);
  };

  const toggleLike = () => {
    if (!post || likeBusy) return;
    const next = !post.isLiked;
    setPost({ ...post, isLiked: next, likeCount: post.likeCount + (next ? 1 : -1) });
    setLikeBusy(true);
    (next ? postApi.like(postId) : postApi.unlike(postId))
      .then((r) => setPost((p) => (p ? { ...p, isLiked: r.isLiked, likeCount: r.likeCount } : p)))
      .catch(loadPost)
      .finally(() => setLikeBusy(false));
  };

  const toggleScrap = () => {
    if (!post || scrapBusy) return;
    const next = !post.isScrapped;
    setPost({ ...post, isScrapped: next, scrapCount: post.scrapCount + (next ? 1 : -1) });
    setScrapBusy(true);
    (next ? postApi.scrap(postId) : postApi.unscrap(postId))
      .then((r) => setPost((p) => (p ? { ...p, isScrapped: r.isScrapped, scrapCount: r.scrapCount } : p)))
      .catch(loadPost)
      .finally(() => setScrapBusy(false));
  };

  const toggleFollow = () => {
    if (!post?.author || followBusy) return;
    const next = !post.isFollowingAuthor;
    setPost({ ...post, isFollowingAuthor: next });
    setFollowBusy(true);
    (next ? userApi.follow(post.author.id) : userApi.unfollow(post.author.id))
      .catch(() => setPost((p) => (p ? { ...p, isFollowingAuthor: !next } : p)))
      .finally(() => setFollowBusy(false));
  };

  const submitComment = () => {
    const content = input.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    commentApi.create(postId, content, replyTo?.id ?? null)
      .then(() => {
        setInput("");
        setReplyTo(null);
        loadComments();
      })
      .catch(() => {})
      .finally(() => setSubmitting(false));
  };

  const saveEdit = (id: string) => {
    const content = editValue.trim();
    if (!content) return;
    commentApi.update(id, content).then(() => {
      setEditingId(null);
      loadComments();
    });
  };

  const removeComment = (id: string) => {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    commentApi.remove(id).then(loadComments);
  };

  const acceptComment = (id: string) => {
    commentApi.accept(id).then(() => {
      setAcceptedCommentId(id);
      setPost((p) => (p ? { ...p, isAnswered: true } : p));
    });
  };

  const removePost = () => {
    if (!window.confirm("게시물을 삭제할까요? 되돌릴 수 없어요.")) return;
    postApi.remove(postId).then(onBack);
  };

  const submitReport = (reason: string) => {
    reportApi.create({ targetType: "post", targetId: postId, reason }).finally(() => setReportOpen(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex size-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <span className="min-w-px flex-1" aria-hidden />
        <IconButton icon={MoreVertical} label="더보기" onClick={() => setMenuOpen(true)} />
      </header>

      {postError && (
        <main className="flex flex-1 items-center justify-center px-[20px]">
          <ErrorState message={postError} onRetry={loadPost} />
        </main>
      )}

      {!postError && (
        <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[14px] overflow-y-auto px-[20px] py-[12px]">
          {!post ? (
            <PostSkeleton />
          ) : (
            <>
              {/* 작성자 */}
              <div className="flex w-full items-center gap-[10px]">
                <button type="button" onClick={() => post.author && onOpenUser(post.author.id)} className="flex min-w-px flex-1 items-center gap-[10px] border-0 bg-transparent p-0 text-left">
                  <Avatar src={post.author?.profileImage} size={40} />
                  <span className="flex min-w-px flex-1 flex-col items-start gap-[2px] whitespace-nowrap">
                    <span className="text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
                      {post.author?.nickname ?? "알 수 없음"}
                    </span>
                    <span className="text-[11px] leading-[13px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>
                      {[post.author?.department, formatTime(post.createdAt)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
                {!post.isMine && post.author && (
                  <button
                    type="button"
                    onClick={toggleFollow}
                    className="shrink-0 border-0 px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                    style={{
                      borderRadius: "var(--a-radius-pill)",
                      background: post.isFollowingAuthor ? "var(--a-color-surface-muted)" : "var(--a-color-surface-inverse)",
                      color: post.isFollowingAuthor ? "var(--a-color-icon)" : "var(--a-color-on-inverse)",
                    }}
                  >
                    {post.isFollowingAuthor ? "팔로잉" : "팔로우"}
                  </button>
                )}
              </div>

              {/* 제목 */}
              <h1 className="m-0 w-full text-[20px] leading-[24px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{post.title}</h1>

              {post.rating != null && (
                <div className="flex items-center gap-[6px]">
                  <StarRating value={post.rating} size={16} />
                  <span className="text-[13px] leading-[16px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{post.rating.toFixed(1)}</span>
                </div>
              )}

              {/* 모집 상태 · 채택 완료 (Figma 예시엔 없지만, 목록(PostListItem)엔 있는 배지라 상세에도 맞춘다) */}
              {(post.recruit || post.isAnswered) && (
                <div className="flex items-center gap-[6px]">
                  {post.recruit && (
                    <span
                      className="inline-flex h-[16px] items-center px-[6px] text-[11px] font-bold"
                      style={{
                        borderRadius: 3,
                        background: post.recruit.status === "open" ? "var(--a-color-surface-inverse)" : "var(--a-color-surface-muted)",
                        color: post.recruit.status === "open" ? "var(--a-color-on-inverse)" : "var(--a-color-text-secondary)",
                      }}
                    >
                      {post.recruit.status === "open" ? "모집중" : "마감"} {post.recruit.current}/{post.recruit.capacity}명
                    </span>
                  )}
                  {post.isAnswered && (
                    <span
                      className="inline-flex h-[16px] items-center px-[6px] text-[11px] font-bold"
                      style={{ borderRadius: 3, background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}
                    >
                      채택 완료
                    </span>
                  )}
                </div>
              )}

              {/* 태그 */}
              {post.tags.length > 0 && (
                <div className="flex w-full flex-wrap gap-[6px]">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-[12px] py-[6px] text-[12px] leading-[14px] font-[500] whitespace-nowrap"
                      style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 첨부 이미지 (Figma는 본문 중간에 있지만, images는 content와 분리된 필드라
                  삽입 위치를 알 수 없다 — 본문 바로 앞에 모아서 보여준다) */}
              {post.images.map((img) => (
                <span
                  key={img}
                  className="block h-[150px] w-full shrink-0 overflow-hidden border border-solid"
                  style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-image)", background: "var(--a-color-surface-muted)" }}
                >
                  <img src={resolveAssetUrl(img)} alt="" loading="lazy" className="block size-full object-cover" />
                </span>
              ))}

              {/* 본문 (```코드``` 구간은 코드 블록으로 표시) */}
              {post.content.trim() && <PostBody content={post.content} />}
              {post.poll && <PollView poll={post.poll} onVote={vote} />}

              {/* 좋아요 · 스크랩 */}
              <div className="flex w-full items-center gap-[16px]">
                <button type="button" aria-pressed={post.isLiked} onClick={toggleLike} className="flex items-center gap-[4px] border-0 bg-transparent p-0">
                  <Heart size={16} strokeWidth={1.5} fill={post.isLiked ? "var(--a-color-text-primary)" : "none"} style={{ color: post.isLiked ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)" }} aria-hidden />
                  <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>좋아요 {post.likeCount}</span>
                </button>
                <button type="button" aria-pressed={post.isScrapped} onClick={toggleScrap} className="flex items-center gap-[4px] border-0 bg-transparent p-0">
                  <Bookmark size={16} strokeWidth={1.5} fill={post.isScrapped ? "var(--a-color-text-primary)" : "none"} style={{ color: post.isScrapped ? "var(--a-color-text-primary)" : "var(--a-color-text-secondary)" }} aria-hidden />
                  <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>스크랩 {post.scrapCount}</span>
                </button>
              </div>

              <div className="h-px w-full shrink-0" style={{ background: "var(--a-color-border)" }} aria-hidden />

              {/* 댓글 */}
              <h2 className="m-0 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>댓글 {commentCount}</h2>

              {commentsError && <ErrorState message={commentsError} onRetry={loadComments} />}
              {!commentsError && comments === null && <CommentSkeleton />}
              {!commentsError && comments !== null && comments.length === 0 && <EmptyState title="아직 댓글이 없어요" />}
              {!commentsError && comments !== null && comments.length > 0 && (
                <div className="flex w-full flex-col items-start gap-[14px]">
                  {comments.map((c) => (
                    <CommentRow
                      key={c.id}
                      comment={c}
                      depth={0}
                      canAccept={post.isMine && post.board === "question" && !acceptedCommentId}
                      acceptedCommentId={acceptedCommentId}
                      editingId={editingId}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                      onStartEdit={(cc) => {
                        setEditingId(cc.id);
                        setEditValue(cc.content);
                      }}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onDelete={removeComment}
                      onAccept={acceptComment}
                      onReply={(cc) => {
                        setReplyTo({ id: cc.id, nickname: cc.author?.nickname ?? "알 수 없음" });
                        inputRef.current?.focus();
                      }}
                      onOpenUser={onOpenUser}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {/* 댓글 입력 */}
      <div className="flex w-full shrink-0 flex-col gap-[6px] border-0 border-t border-solid px-[16px] pt-[10px] pb-[28px]" style={{ borderColor: "var(--a-color-border)" }}>
        {replyTo && (
          <div className="flex items-center gap-[6px] text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>
            <span>{replyTo.nickname}님에게 답글</span>
            <button type="button" onClick={() => setReplyTo(null)} className="border-0 bg-transparent p-0 font-bold" style={{ color: "var(--a-color-text-secondary)" }}>취소</button>
          </div>
        )}
        <div className="flex w-full items-center gap-[10px]">
          <span className="flex min-w-px flex-1 items-center border border-solid px-[14px] py-[11px]" style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="댓글을 입력하세요"
              aria-label="댓글 입력"
              className="min-w-px flex-1 border-0 bg-transparent p-0 text-[14px] leading-[17px] outline-none"
              style={{ color: "var(--a-color-text-primary)", fontFamily: "var(--a-font-sans)" }}
            />
          </span>
          <button
            type="button"
            aria-label="댓글 등록"
            disabled={!input.trim() || submitting}
            onClick={submitComment}
            className="flex size-[40px] shrink-0 items-center justify-center border-0 p-0"
            style={{ borderRadius: "50%", background: "var(--a-color-surface-inverse)", opacity: input.trim() ? 1 : 0.4 }}
          >
            <Send size={16} strokeWidth={1.5} style={{ color: "var(--a-color-on-inverse)" }} aria-hidden />
          </button>
        </div>
      </div>

      <BottomSheet open={menuOpen} title="더보기" onClose={() => setMenuOpen(false)}>
        {post?.isMine ? (
          <>
            <SheetItem onClick={() => { setMenuOpen(false); onEditPost?.(postId); }}>수정</SheetItem>
            <SheetItem danger onClick={() => { setMenuOpen(false); removePost(); }}>삭제</SheetItem>
          </>
        ) : (
          <SheetItem danger onClick={() => { setMenuOpen(false); setReportOpen(true); }}>신고</SheetItem>
        )}
      </BottomSheet>

      <BottomSheet open={reportOpen} title="신고 사유" onClose={() => setReportOpen(false)}>
        {REPORT_REASONS.map((reason) => (
          <SheetItem key={reason} onClick={() => submitReport(reason)}>{reason}</SheetItem>
        ))}
      </BottomSheet>
    </div>
  );
}

// 본문 마크다운의 ```코드``` 구간만 코드 블록으로 구분해서 보여준다 (그 외는 일반 문단).
function PostBody({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g).filter(Boolean);
  return (
    <div className="flex w-full flex-col items-start gap-[10px]">
      {parts.map((part, i) => {
        const isCode = part.startsWith("```");
        if (isCode) {
          const code = part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
          return (
            <pre
              key={i}
              className="m-0 w-full overflow-x-auto p-[12px] text-[12px] leading-[16px]"
              style={{ borderRadius: 8, background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)", fontFamily: "monospace" }}
            >
              {code}
            </pre>
          );
        }
        return part.trim() ? (
          <p key={i} className="m-0 w-full whitespace-pre-wrap text-[15px] leading-[20px] font-normal" style={{ color: "var(--a-color-text-primary)" }}>
            {part.trim()}
          </p>
        ) : null;
      })}
    </div>
  );
}

interface CommentRowProps {
  comment: CommentNode;
  depth: number;
  canAccept: boolean;
  acceptedCommentId: string | null;
  editingId: string | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: (c: CommentNode) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  onReply: (c: CommentNode) => void;
  onOpenUser: (id: string) => void;
}

function CommentRow({
  comment, depth, canAccept, acceptedCommentId, editingId, editValue, onEditValueChange,
  onStartEdit, onSaveEdit, onCancelEdit, onDelete, onAccept, onReply, onOpenUser,
}: CommentRowProps) {
  const isEditing = editingId === comment.id;
  const isAccepted = comment.isAccepted || comment.id === acceptedCommentId;

  return (
    <div className="flex w-full flex-col items-start gap-[10px]" style={depth > 0 ? { paddingLeft: 38 } : undefined}>
      <div className="flex w-full items-start gap-[10px]">
        <button type="button" onClick={() => comment.author && onOpenUser(comment.author.id)} className="shrink-0 border-0 bg-transparent p-0">
          <Avatar src={comment.author?.profileImage} size={depth > 0 ? 24 : 28} />
        </button>
        <div className="flex min-w-px flex-1 flex-col items-start gap-[4px]">
          <span className="flex items-center gap-[6px] text-[12px] leading-[14px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
            {comment.author?.nickname ?? "알 수 없음"}
            {isAccepted && (
              <span className="inline-flex h-[14px] items-center px-[5px] text-[10px] font-bold" style={{ borderRadius: 3, background: "var(--a-color-surface-inverse)", color: "var(--a-color-on-inverse)" }}>
                채택
              </span>
            )}
          </span>

          {comment.isDeleted ? (
            <p className="m-0 text-[13px] leading-[16px] italic" style={{ color: "var(--a-color-text-secondary)" }}>삭제된 댓글이에요</p>
          ) : comment.isHidden ? (
            <p className="m-0 text-[13px] leading-[16px] italic" style={{ color: "var(--a-color-text-secondary)" }}>숨겨진 댓글이에요</p>
          ) : isEditing ? (
            <div className="flex w-full flex-col gap-[6px]">
              <input
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                autoFocus
                className="w-full border border-solid px-[10px] py-[8px] text-[13px] leading-[16px] outline-none"
                style={{ borderColor: "var(--a-color-border)", borderRadius: 8, color: "var(--a-color-text-primary)" }}
              />
              <div className="flex items-center gap-[10px] text-[12px] font-bold">
                <button type="button" onClick={() => onSaveEdit(comment.id)} style={{ color: "var(--a-color-text-primary)" }} className="border-0 bg-transparent p-0">저장</button>
                <button type="button" onClick={onCancelEdit} style={{ color: "var(--a-color-text-secondary)" }} className="border-0 bg-transparent p-0 font-normal">취소</button>
              </div>
            </div>
          ) : (
            <p className="m-0 w-full whitespace-pre-wrap text-[13px] leading-[16px]" style={{ color: "var(--a-color-text-primary)" }}>{comment.content}</p>
          )}

          {!comment.isDeleted && !isEditing && (
            <div className="flex items-center gap-[10px] text-[11px] leading-[13px]" style={{ color: "var(--a-color-text-secondary)" }}>
              <span>{formatTime(comment.createdAt)}</span>
              {depth === 0 && <button type="button" onClick={() => onReply(comment)} className="border-0 bg-transparent p-0 font-bold" style={{ color: "inherit" }}>답글</button>}
              {canAccept && !comment.isMine && (
                <button type="button" onClick={() => onAccept(comment.id)} className="border-0 bg-transparent p-0 font-bold" style={{ color: "var(--a-color-text-primary)" }}>채택</button>
              )}
              {comment.isMine && (
                <>
                  <button type="button" onClick={() => onStartEdit(comment)} className="border-0 bg-transparent p-0" style={{ color: "inherit" }}>수정</button>
                  <button type="button" onClick={() => onDelete(comment.id)} className="border-0 bg-transparent p-0" style={{ color: "var(--a-color-danger)" }}>삭제</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {comment.replies?.map((reply) => (
        <CommentRow
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          canAccept={canAccept}
          acceptedCommentId={acceptedCommentId}
          editingId={editingId}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          onAccept={onAccept}
          onReply={onReply}
          onOpenUser={onOpenUser}
        />
      ))}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="flex w-full flex-col items-start gap-[14px]">
      <div className="flex w-full items-center gap-[10px]">
        <Skeleton className="size-[40px]" style={{ borderRadius: "50%" }} />
        <div className="flex flex-1 flex-col gap-[4px]">
          <Skeleton className="h-[14px] w-[90px]" />
          <Skeleton className="h-[11px] w-[120px]" />
        </div>
      </div>
      <Skeleton className="h-[24px] w-[90%]" />
      <Skeleton className="h-[15px] w-full" />
      <Skeleton className="h-[15px] w-[70%]" />
      <Skeleton className="h-[150px] w-full" style={{ borderRadius: 10 }} />
    </div>
  );
}

function CommentSkeleton() {
  return (
    <div className="flex w-full flex-col gap-[14px]" role="status" aria-label="불러오는 중">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex w-full items-start gap-[10px]">
          <Skeleton className="size-[28px]" style={{ borderRadius: "50%" }} />
          <div className="flex flex-1 flex-col gap-[4px]">
            <Skeleton className="h-[12px] w-[70px]" />
            <Skeleton className="h-[13px] w-[85%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 투표: 선택지별 득표 비율 막대. 내가 고른 선택지는 굵은 테두리로 표시한다.
function PollView({ poll, onVote }: { poll: Poll; onVote: (index: number) => void }) {
  return (
    <section className="flex w-full flex-col gap-[8px] border border-solid p-[14px]" style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-card)" }} aria-label="투표">
      <h2 className="m-0 text-[15px] leading-[18px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{poll.question}</h2>
      {poll.options.map((o, i) => {
        const pct = poll.totalVotes ? Math.round((o.count / poll.totalVotes) * 100) : 0;
        return (
          <button
            key={i}
            type="button"
            aria-pressed={o.voted}
            onClick={() => onVote(i)}
            className="relative flex w-full items-center gap-[8px] overflow-hidden border border-solid bg-transparent px-[12px] py-[11px] text-left"
            style={{ borderColor: o.voted ? "var(--a-color-text-primary)" : "var(--a-color-border)", borderWidth: o.voted ? 2 : 1, borderRadius: "var(--a-radius-control)" }}
          >
            <span className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: "var(--a-color-surface-muted)" }} aria-hidden />
            <span className={`relative min-w-px flex-1 text-[14px] leading-[17px] ${o.voted ? "font-bold" : "font-normal"}`} style={{ color: "var(--a-color-text-primary)" }}>{o.text}</span>
            <span className="relative shrink-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{o.count}표 · {pct}%</span>
          </button>
        );
      })}
      <span className="text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>총 {poll.totalVotes}명 참여</span>
    </section>
  );
}
