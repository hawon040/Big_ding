import { useEffect, useMemo, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { meApi } from "@/api/aplan";
import { Avatar } from "@/aplan/components/Avatar";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import { ScreenHeader } from "@/aplan/components/ScreenHeader";
import { TextField } from "@/aplan/components/TextField";
import { TopicSelectChip } from "@/aplan/components/TopicSelectChip";
import { ErrorState, Skeleton } from "@/aplan/components/States";
import type { Me } from "@/types/aplan";
import "@/styles/aplan-tokens.css";

const NICKNAME_MIN = 2;
const NICKNAME_MAX = 20;
const DEPARTMENT_MAX = 50;
const BIO_MAX = 20;
const GRADES = [1, 2, 3, 4] as const;

interface EditProfileScreenProps {
  onBack: () => void;
  onDone: (me: Me) => void;
}

// 프로필 수정 (Figma에 없는 화면 — 마이페이지 톤으로 구성).
// 사진·닉네임·학과·학년·소개를 바꾼다. 서버 규칙(PATCH /api/users/me)과 같은 길이 제한을 미리 확인한다.
export function EditProfileScreen({ onBack, onDone }: EditProfileScreenProps) {
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoadError(null);
    meApi
      .get()
      .then((m) => {
        setMe(m);
        setNickname(m.nickname);
        setDepartment(m.department ?? "");
        setGrade(m.grade);
        setBio(m.bio ?? "");
      })
      .catch((err) => setLoadError(err?.response?.data?.message || "불러오지 못했어요."));
  };
  useEffect(load, []);

  const avatarPreview = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile]);
  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const trimmedNickname = nickname.trim();
  const bioLength = bio.length;
  const changed =
    !!me &&
    (avatarFile !== null ||
      trimmedNickname !== me.nickname ||
      department.trim() !== (me.department ?? "") ||
      grade !== me.grade ||
      bio.trim() !== (me.bio ?? ""));
  const nicknameInvalid = trimmedNickname.length < NICKNAME_MIN || trimmedNickname.length > NICKNAME_MAX;
  const bioInvalid = bioLength > BIO_MAX;

  const pickAvatar = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있어요.");
      return;
    }
    setError(null);
    setAvatarFile(file);
  };

  const save = () => {
    if (!me || saving || !changed) return;
    if (nicknameInvalid) {
      setNicknameError(`닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 입력해주세요.`);
      return;
    }
    if (bioInvalid) {
      setError(`소개는 ${BIO_MAX}자 이내로 입력해주세요.`);
      return;
    }
    setNicknameError(null);
    setError(null);

    // 바뀐 값만 보낸다. 빈 문자열은 서버에서 "지우기"로 처리된다(닉네임 제외).
    const fields: Record<string, string> = {};
    if (trimmedNickname !== me.nickname) fields.nickname = trimmedNickname;
    if (department.trim() !== (me.department ?? "")) fields.department = department.trim();
    if (grade !== me.grade) fields.grade = grade === null ? "" : String(grade);
    if (bio.trim() !== (me.bio ?? "")) fields.bio = bio.trim();

    let body: FormData | Record<string, string> = fields;
    if (avatarFile) {
      const form = new FormData();
      form.append("avatar", avatarFile);
      Object.entries(fields).forEach(([k, v]) => form.append(k, v));
      body = form;
    }

    setSaving(true);
    meApi
      .updateProfile(body as Parameters<typeof meApi.updateProfile>[0])
      .then(onDone)
      .catch((err) => {
        const message = err?.response?.data?.message || "저장하지 못했어요.";
        if (err?.response?.status === 409) setNicknameError(message);
        else setError(message);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader title="프로필 수정" onBack={onBack} />

      <main className="flex min-h-0 w-full flex-1 flex-col items-start gap-[20px] overflow-y-auto px-[20px] py-[8px] pb-[24px]">
        {loadError && <ErrorState message={loadError} onRetry={load} />}
        {!loadError && !me && (
          <div className="flex w-full flex-col items-center gap-[16px]">
            <Skeleton className="size-[88px]" style={{ borderRadius: "50%" }} />
            <Skeleton className="h-[46px] w-full" />
            <Skeleton className="h-[46px] w-full" />
          </div>
        )}

        {me && (
          <>
            {/* 프로필 사진 */}
            <div className="flex w-full justify-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="프로필 사진 바꾸기"
                className="relative border-0 bg-transparent p-0"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="block size-[88px] rounded-full object-cover" />
                ) : (
                  <Avatar src={me.profileImage} size={88} />
                )}
                <span
                  className="absolute right-0 bottom-0 flex size-[28px] items-center justify-center rounded-full border-2 border-solid"
                  style={{ background: "var(--a-color-surface-inverse)", borderColor: "var(--a-color-bg)" }}
                  aria-hidden
                >
                  <Camera size={14} strokeWidth={2} style={{ color: "var(--a-color-on-inverse)" }} />
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files)} />
            </div>

            <Field label="닉네임" hint={`${trimmedNickname.length}/${NICKNAME_MAX}`}>
              <TextField
                label="닉네임"
                value={nickname}
                maxLength={NICKNAME_MAX}
                placeholder="닉네임"
                error={nicknameError}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setNicknameError(null);
                }}
              />
            </Field>

            <Field label="학과">
              <TextField label="학과" value={department} maxLength={DEPARTMENT_MAX} placeholder="예) 빅데이터학과" onChange={(e) => setDepartment(e.target.value)} />
            </Field>

            <Field label="학년">
              <div className="flex w-full flex-wrap gap-[8px]" role="radiogroup" aria-label="학년">
                <TopicSelectChip selected={grade === null} onClick={() => setGrade(null)}>선택 안 함</TopicSelectChip>
                {GRADES.map((g) => (
                  <TopicSelectChip key={g} selected={grade === g} onClick={() => setGrade(g)}>{g}학년</TopicSelectChip>
                ))}
              </div>
            </Field>

            <Field label="소개" hint={`${bioLength}/${BIO_MAX}`}>
              <textarea
                value={bio}
                maxLength={BIO_MAX}
                rows={3}
                placeholder="나를 한 줄로 소개해보세요"
                aria-label="소개"
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                className="a-text-field w-full shrink-0 resize-none border border-solid px-[14px] py-[13px] text-[14px] leading-[20px] font-normal outline-none"
                style={{ borderRadius: "var(--a-radius-control)", color: "var(--a-color-text-primary)", background: "var(--a-color-bg)" }}
              />
            </Field>

            {error && (
              <p role="alert" className="m-0 w-full text-[12px] leading-[14px]" style={{ color: "var(--a-color-danger)" }}>{error}</p>
            )}
          </>
        )}
      </main>

      {me && (
        <footer className="w-full shrink-0 px-[20px] pt-[8px] pb-[16px]">
          <PrimaryButton onClick={save} disabled={!changed} loading={saving}>
            {saving ? "저장 중…" : "저장"}
          </PrimaryButton>
        </footer>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-[8px]">
      <div className="flex w-full items-center">
        <h2 className="m-0 min-w-px flex-1 text-[14px] leading-[17px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>{label}</h2>
        {hint && <span className="text-[12px] leading-[14px]" style={{ color: "var(--a-color-text-secondary)" }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}
