import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Plus, X } from "lucide-react";
import { resolveAssetUrl } from "@/api";
import { meApi, postApi } from "@/api/aplan";
import { BOARDS, RECRUIT_BOARDS, type BoardKey } from "@/constants/boards";
import { TextField } from "@/aplan/components/TextField";
import { StarRating } from "@/aplan/components/StarRating";
import { LECTURE_GRADES, LECTURE_GROUPS, LECTURE_MIN_CONTENT, PROFESSORS } from "@/constants/lectures";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { BottomSheet, SheetItem } from "@/aplan/components/BottomSheet";
import { TopicSelectChip } from "@/aplan/components/TopicSelectChip";
import { ErrorState } from "@/aplan/components/States";
import type { PostDetail } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

interface WriteScreenProps {
  /** 커뮤니티 탭에서 고르고 있던 게시판을 기본값으로 (없으면 "자유") */
  initialBoard?: BoardKey | null;
  /** 있으면 수정 모드로 그 글을 불러온다. 서버 PATCH로 제목·내용·태그·사진·투표·강의평가(교과군·별점)를
   *  바꿀 수 있고, 게시판·모집 인원은 수정 모드에서 바꿀 수 없다(server/routes/posts/core.js) */
  editPostId?: string;
  onDone: (postId: string) => void;
  onBack: () => void;
}

const MAX_IMAGES = 5;
const MAX_TAGS = 10;
const MAX_POLL_OPTIONS = 5;

// 글쓰기 / 수정 (Figma에 없는 화면 — 5개 시안 모두 01~09까지만 있고 글쓰기는 없다).
// 수정 모드는 postApi.get으로 원본을 먼저 불러온 뒤에만 아래 폼을 그려서, 폼의 초기 state가
// 불러온 값으로 정확히 시작하게 한다(늦게 도착하는 응답을 useState 초기값에 반영할 수 없어서).
export function WriteScreen({ initialBoard, editPostId, onDone, onBack }: WriteScreenProps) {
  const [editPost, setEditPost] = useState<PostDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!editPostId) return;
    postApi.get(editPostId).then(setEditPost).catch((err) => setLoadError(err?.response?.data?.message || "게시물을 불러오지 못했어요."));
  }, [editPostId]);

  if (editPostId && loadError) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[20px]">
        <ErrorState message={loadError} onRetry={onBack} />
      </div>
    );
  }
  if (editPostId && !editPost) {
    return <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[20px]" aria-busy="true" />;
  }

  return <WriteForm initialBoard={initialBoard} editPost={editPost ?? undefined} onDone={onDone} onBack={onBack} />;
}

function WriteForm({
  initialBoard,
  editPost,
  onDone,
  onBack,
}: {
  initialBoard?: BoardKey | null;
  editPost?: PostDetail;
  onDone: (postId: string) => void;
  onBack: () => void;
}) {
  const isEdit = !!editPost;
  const board = editPost?.board ?? initialBoard ?? "free";
  const [boardSheetOpen, setBoardSheetOpen] = useState(false);
  // 공지사항(event)은 관리자·공지 작성 권한이 있는 계정만 고를 수 있다(서버도 403으로 막음).
  // 권한을 확인하기 전까지는 일반 유저로 보고, 공지사항에서 글쓰기를 눌렀어도 자유 게시판으로 시작한다.
  const [canWriteNotice, setCanWriteNotice] = useState(false);
  const [pickedBoard, setPickedBoard] = useState<BoardKey>(board === "event" ? "free" : board);
  useEffect(() => {
    if (isEdit) return;
    let cancelled = false;
    meApi.get().then((me) => {
      if (cancelled) return;
      const allowed = !!(me.isAdmin || me.canPostEvents);
      setCanWriteNotice(allowed);
      if (allowed && board === "event") setPickedBoard("event");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isEdit, board]);
  const selectableBoards = BOARDS.filter((b) => b.key !== "event" || canWriteNotice);
  const [title, setTitle] = useState(editPost?.title ?? "");
  const [content, setContent] = useState(editPost?.content ?? "");
  const [tagInput, setTagInput] = useState("");
  // 강의평가 글은 교과군·교수가 태그 앞쪽에 들어가 있어서, 수정할 때는 칩 선택으로 따로 꺼내고 태그 목록에서는 뺀다
  const editingLecture = editPost?.board === "lecture";
  const initialLectureGrade = editingLecture
    ? editPost?.lectureGrade || editPost?.tags.find((t) => LECTURE_GRADES.includes(t)) || ""
    : "";
  const initialProfessor = editingLecture ? editPost?.tags.find((t) => PROFESSORS.includes(t)) ?? "" : "";
  const [tags, setTags] = useState<string[]>(
    (editPost?.tags ?? []).filter((t) => !editingLecture || (t !== initialLectureGrade && t !== initialProfessor)),
  );
  const [images, setImages] = useState<File[]>([]);
  // 수정 모드: 원래 글에 있던 사진 중 남길 것 (새 사진은 이 뒤에 붙는다)
  const [keptImages, setKeptImages] = useState<string[]>(editPost?.images ?? []);
  const imageCount = keptImages.length + images.length;
  const imagesChanged =
    images.length > 0 ||
    keptImages.length !== (editPost?.images.length ?? 0) ||
    keptImages.some((u, i) => u !== editPost?.images[i]);
  const [capacity, setCapacity] = useState(4);
  // 수정 모드는 원래 글의 투표로 시작한다
  const initialPoll = editPost?.poll ?? null;
  const [pollOn, setPollOn] = useState(!!initialPoll);
  const [pollQuestion, setPollQuestion] = useState(initialPoll?.question ?? "");
  const [pollOptions, setPollOptions] = useState(initialPoll ? initialPoll.options.map((o) => o.text) : ["", ""]);
  const [lectureGrade, setLectureGrade] = useState(initialLectureGrade);
  const [professor, setProfessor] = useState(initialProfessor);
  const [rating, setRating] = useState(editPost?.rating ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBoard = isEdit ? board : pickedBoard;
  const boardMeta = BOARDS.find((b) => b.key === activeBoard)!;
  const showRecruit = !isEdit && RECRUIT_BOARDS.includes(activeBoard);
  // 전공 강의평가: 제목=강의명, 교과군·교수는 태그로, 별점·20자 이상 평가 필수.
  // 수정할 때도 글쓰기와 같은 목록 선택(교과군 → 강의명, 교수님, 별점)으로 바꾼다
  const isLecture = activeBoard === "lecture";
  const lectureTags = () =>
    [lectureGrade, professor, ...tags.filter((t) => t !== lectureGrade && t !== professor)].slice(0, MAX_TAGS);
  // 강의평가 게시판에는 투표가 없다 (수정 모드도 동일)
  const showPoll = activeBoard !== "lecture";
  const pollFilled = pollOptions.map((o) => o.trim()).filter(Boolean);
  const pollValid = !pollOn || (pollQuestion.trim().length > 0 && pollFilled.length >= 2);

  const imagePreviews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => imagePreviews.forEach((u) => URL.revokeObjectURL(u)), [imagePreviews]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return;
    setTags((prev) => [...prev, t]);
    setTagInput("");
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    // FileList는 input.value를 비우면 같이 비워지는 살아있는 목록이라, 상태 업데이트(지연 실행) 전에 미리 배열로 복사한다.
    const incoming = Array.from(files);
    setImages((prev) => [...prev, ...incoming].slice(0, MAX_IMAGES - keptImages.length));
  };

  const hasPoll = showPoll && pollOn;
  const canSubmit = isLecture
    ? !!lectureGrade && title.trim().length > 0 && !!professor && rating > 0 && content.trim().length >= LECTURE_MIN_CONTENT
    : title.trim().length > 0 &&
      (content.trim().length > 0 || (hasPoll && pollValid)) &&
      pollValid;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editPost) {
        // 투표: 뺐으면 null, 새로 넣었거나 바꿨으면 새 값, 그대로면 보내지 않는다
        const nextPoll = hasPoll ? { question: pollQuestion.trim(), options: pollFilled } : null;
        const pollChanged = initialPoll
          ? !nextPoll ||
            nextPoll.question !== initialPoll.question ||
            nextPoll.options.length !== initialPoll.options.length ||
            nextPoll.options.some((t, i) => t !== initialPoll.options[i].text)
          : !!nextPoll;
        await postApi.update(
          editPost.id,
          {
            title: title.trim(),
            content: content.trim(),
            tags: isLecture ? lectureTags() : tags,
            ...(pollChanged ? { poll: nextPoll } : {}),
            ...(isLecture ? { rating, lectureGrade } : {}),
          },
          imagesChanged ? { keep: keptImages, files: images } : undefined,
        );
        onDone(editPost.id);
      } else {
        const created = await postApi.create({
          board: activeBoard,
          tags: isLecture ? lectureTags() : tags,
          title: title.trim(),
          content: content.trim(),
          images: images.length ? images : undefined,
          recruit: showRecruit ? { capacity } : undefined,
          poll: hasPoll ? { question: pollQuestion.trim(), options: pollFilled } : undefined,
          rating: isLecture ? rating : undefined,
          lectureGrade: isLecture ? lectureGrade : undefined,
        });
        onDone(created._id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "게시하지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex w-full shrink-0 items-center gap-[12px] px-[20px] py-[12px]">
        <button type="button" onClick={onBack} aria-label="뒤로 가기" className="flex h-[31px] w-[26px] shrink-0 items-center justify-center border-0 bg-transparent p-0">
          <ChevronLeft size={26} strokeWidth={1.5} style={{ color: "var(--a-color-text-primary)" }} />
        </button>
        <h1 className="m-0 min-w-px flex-1 text-[17px] leading-[20px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          {isEdit ? "글 수정" : "글쓰기"}
        </h1>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[16px] overflow-y-auto px-[20px] py-[4px] pb-[24px]">
        {/* 게시판 (수정 모드에선 바꿀 수 없음) */}
        <button
          type="button"
          disabled={isEdit}
          onClick={() => setBoardSheetOpen(true)}
          className="flex w-full items-center gap-[8px] border border-solid px-[14px] py-[13px] text-left disabled:opacity-60"
          style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)", background: "var(--a-color-bg)" }}
        >
          <span className="min-w-px flex-1 text-[14px] leading-[17px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>
            {boardMeta.label}
          </span>
          {!isEdit && <ChevronDown size={18} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />}
        </button>

        {isLecture && (
          <section className="flex w-full flex-col gap-[12px]">
            <ChipRow label="교과군" options={LECTURE_GRADES} value={lectureGrade} onPick={(g) => { setLectureGrade(g); if (!LECTURE_GROUPS[g]?.includes(title)) setTitle(""); }} />
            {lectureGrade && <ChipRow label="강의명" options={LECTURE_GROUPS[lectureGrade]} value={title} onPick={setTitle} />}
            <ChipRow label="교수님" options={PROFESSORS} value={professor} onPick={setProfessor} />
            <div className="flex items-center gap-[10px]">
              <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>별점</span>
              <StarRating value={rating} onChange={setRating} size={26} />
              <span className="text-[13px] leading-[16px]" style={{ color: "var(--a-color-text-secondary)" }}>{rating > 0 ? rating.toFixed(1) : "선택해주세요"}</span>
            </div>
          </section>
        )}
        {!isLecture && <TextField label="제목" placeholder="제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isLecture ? `강의 평가를 ${LECTURE_MIN_CONTENT}자 이상 적어주세요` : hasPoll ? "내용 (투표만 올릴 땐 비워도 돼요)" : "내용을 입력하세요"}
          rows={8}
          aria-label="내용"
                    className="a-text-field w-full shrink-0 resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[18px] font-normal outline-none"
          style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)", fontFamily: "var(--a-font-sans)" }}
        />

        {/* 태그 */}
        <section className="flex w-full flex-col gap-[8px]">
          <TextField
            label="태그"
            placeholder="태그 입력 후 Enter (최대 10개)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          {tags.length > 0 && (
            <div className="flex w-full flex-wrap gap-[8px]">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-[6px] py-[6px] pl-[12px] pr-[8px] text-[12px] leading-[14px] font-[500]"
                  style={{ borderRadius: "var(--a-radius-pill)", background: "var(--a-color-surface-muted)", color: "var(--a-color-icon)" }}
                >
                  #{t}
                  <button type="button" aria-label={`${t} 삭제`} onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="flex size-[14px] items-center justify-center border-0 bg-transparent p-0">
                    <X size={12} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 이미지 (수정 모드에서는 기존 사진을 지우거나 새 사진을 더할 수 있다) */}
        <section className="flex w-full flex-col gap-[8px]">
            <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>사진 (최대 {MAX_IMAGES}장)</span>
            <div className="flex w-full flex-wrap gap-[8px]">
              {keptImages.map((src) => (
                <span key={src} className="relative block size-[76px] shrink-0 overflow-hidden border border-solid" style={{ borderColor: "var(--a-color-border)", borderRadius: 8 }}>
                  <img src={resolveAssetUrl(src)} alt="" className="block size-full object-cover" />
                  <button
                    type="button"
                    aria-label="사진 삭제"
                    onClick={() => setKeptImages((prev) => prev.filter((u) => u !== src))}
                    className="absolute top-[4px] right-[4px] flex size-[18px] items-center justify-center border-0 p-0"
                    style={{ borderRadius: "50%", background: "rgba(0,0,0,0.6)" }}
                  >
                    <X size={12} strokeWidth={2} style={{ color: "#fff" }} aria-hidden />
                  </button>
                </span>
              ))}
              {imagePreviews.map((src, i) => (
                <span key={src} className="relative block size-[76px] shrink-0 overflow-hidden border border-solid" style={{ borderColor: "var(--a-color-border)", borderRadius: 8 }}>
                  <img src={src} alt="" className="block size-full object-cover" />
                  <button
                    type="button"
                    aria-label="사진 삭제"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-[4px] right-[4px] flex size-[18px] items-center justify-center border-0 p-0"
                    style={{ borderRadius: "50%", background: "rgba(0,0,0,0.6)" }}
                  >
                    <X size={12} strokeWidth={2} style={{ color: "#fff" }} aria-hidden />
                  </button>
                </span>
              ))}
              {imageCount < MAX_IMAGES && (
                <button
                  type="button"
                  aria-label="사진 추가"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-[76px] shrink-0 items-center justify-center border border-dashed p-0"
                  style={{ borderColor: "var(--a-color-border)", borderRadius: 8, background: "var(--a-color-surface-muted)" }}
                >
                  <Plus size={22} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
                </button>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
          </section>

        {/* 투표 (강의평가 제외). 수정 시 글자가 그대로인 선택지는 기존 득표가 유지된다 */}
        {showPoll && (
          <section className="flex w-full flex-col gap-[8px]">
            <button
              type="button"
              aria-pressed={pollOn}
              onClick={() => setPollOn((v) => !v)}
              className="flex w-full items-center justify-between border border-solid bg-transparent px-[14px] py-[13px] text-left text-[14px] leading-[17px] font-[500]"
              style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)" }}
            >
              {pollOn ? "투표 빼기" : "투표 추가"}
              {pollOn ? <X size={18} strokeWidth={1.5} aria-hidden /> : <Plus size={18} strokeWidth={1.5} aria-hidden />}
            </button>
            {pollOn && (
              <>
                <TextField label="투표 질문" placeholder="투표 질문" value={pollQuestion} maxLength={100} onChange={(e) => setPollQuestion(e.target.value)} />
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex w-full items-center gap-[8px]">
                    <TextField label={`선택지 ${i + 1}`} placeholder={`선택지 ${i + 1}`} value={opt} maxLength={50} onChange={(e) => setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))} className="min-w-px flex-1" />
                    {pollOptions.length > 2 && (
                      <button type="button" aria-label={`선택지 ${i + 1} 삭제`} onClick={() => setPollOptions((prev) => prev.filter((_, idx) => idx !== i))} className="flex shrink-0 border-0 bg-transparent p-0">
                        <X size={18} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <button type="button" onClick={() => setPollOptions((prev) => [...prev, ""])} className="self-start border-0 bg-transparent p-0 text-[13px] leading-[16px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>+ 선택지 추가</button>
                )}
              </>
            )}
          </section>
        )}

        {/* 모집 인원 (스터디·공모전만) */}
        {showRecruit && (
          <section className="flex w-full items-center gap-[10px]">
            <span className="min-w-px flex-1 text-[13px] leading-[16px] font-[500]" style={{ color: "var(--a-color-text-primary)" }}>모집 인원</span>
            <input
              type="number"
              min={2}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(Math.max(2, Math.min(100, Number(e.target.value) || 2)))}
              aria-label="모집 인원"
              className="w-[72px] border border-solid px-[10px] py-[8px] text-center text-[14px] outline-none"
              style={{ borderColor: "var(--a-color-border)", borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)" }}
            />
            <span className="text-[13px] leading-[16px] font-normal" style={{ color: "var(--a-color-text-secondary)" }}>명</span>
          </section>
        )}

        {error && <p role="alert" className="m-0 text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>}
      </main>

      <div className="w-full shrink-0 px-[20px] pt-[8px] pb-[20px]">
        <PrimaryButton onClick={submit} disabled={!canSubmit} loading={submitting}>
          {isEdit ? "저장" : "등록"}
        </PrimaryButton>
      </div>

      <BottomSheet open={boardSheetOpen} title="게시판 선택" onClose={() => setBoardSheetOpen(false)}>
        {selectableBoards.map((b) => (
          <SheetItem key={b.key} selected={b.key === pickedBoard} onClick={() => { setPickedBoard(b.key); setBoardSheetOpen(false); }}>
            {b.label}
          </SheetItem>
        ))}
      </BottomSheet>
    </div>
  );
}

// 단일 선택 칩 줄 (강의평가의 교과군·강의명·교수)
function ChipRow({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex w-full flex-col gap-[8px]">
      <span className="text-[12px] leading-[14px] font-[500]" style={{ color: "var(--a-color-text-secondary)" }}>{label}</span>
      <div className="flex w-full flex-wrap gap-[8px]">
        {options.map((o) => (
          <TopicSelectChip key={o} selected={value === o} onClick={() => onPick(o)}>{o}</TopicSelectChip>
        ))}
      </div>
    </div>
  );
}
