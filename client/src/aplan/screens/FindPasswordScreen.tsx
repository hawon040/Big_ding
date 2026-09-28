import { useState, type FormEvent } from "react";
import { ChevronLeft } from "lucide-react";
import api from "@/api";
import { TextField } from "@/aplan/components/TextField";
import { PrimaryButton } from "@/aplan/components/PrimaryButton";
import "@/styles/aplan-tokens.css";

interface FindPasswordScreenProps {
  onBack: () => void;
  onDone: (message: string) => void;
}

type Field = "studentId" | "phone" | "newPassword" | "confirmPassword";

// 비밀번호 찾기 (7-5). 기존 기능(학번 + 가입 때 등록한 전화번호로 본인 확인 후 재설정)을
// A-02 로그인 화면과 같은 톤으로 옮겼다. Figma에 없는 화면이라 A-02의 입력칸·버튼·글자 크기를 그대로 쓴다.
export function FindPasswordScreen({ onBack, onDone }: FindPasswordScreenProps) {
  const [values, setValues] = useState<Record<Field, string>>({
    studentId: "", phone: "", newPassword: "", confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const bind = (field: Field) => ({
    value: values[field],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: e.target.value })),
    error: errors[field],
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<Field, string>> = {};
    if (!values.studentId.trim()) next.studentId = "학번을 입력해주세요.";
    if (!values.phone.trim()) next.phone = "가입할 때 등록한 전화번호를 입력해주세요.";
    if (values.newPassword.length < 4) next.newPassword = "새 비밀번호를 입력해주세요.";
    if (values.newPassword !== values.confirmPassword) next.confirmPassword = "새 비밀번호가 일치하지 않습니다.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await api.post("/auth/find-password", {
        studentId: values.studentId.trim(),
        phone: values.phone.trim(),
        newPassword: values.newPassword,
      });
      onDone("비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해주세요.");
    } catch (err: any) {
      const message: string = err?.response?.data?.message || "비밀번호 재설정에 실패했습니다.";
      setErrors(message.includes("비밀번호") ? { newPassword: message } : { phone: message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="a-screen flex flex-col">
      <form onSubmit={handleSubmit} noValidate className="flex min-h-dvh flex-col gap-[14px] px-[20px] py-[12px]">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="-ml-[4px] flex size-[30px] items-center justify-center border-0 bg-transparent p-0"
        >
          <ChevronLeft size={22} strokeWidth={1.5} style={{ color: "var(--a-color-icon)" }} />
        </button>
        <h1 className="m-0 mt-[20px] text-[26px] leading-[31px] font-bold" style={{ color: "var(--a-color-text-primary)" }}>
          비밀번호 찾기
        </h1>
        <p className="m-0 text-[14px] leading-[17px] [word-break:keep-all]" style={{ color: "var(--a-color-text-secondary)" }}>
          가입할 때 등록한 학번과 전화번호로 확인해요
        </p>
        <TextField label="학번" placeholder="학번" inputMode="numeric" maxLength={8} autoComplete="username" {...bind("studentId")} />
        <TextField label="전화번호" placeholder="전화번호" type="tel" maxLength={13} autoComplete="tel" {...bind("phone")} />
        <TextField label="새 비밀번호" placeholder="새 비밀번호" type="password" autoComplete="new-password" {...bind("newPassword")} />
        <TextField label="새 비밀번호 확인" placeholder="새 비밀번호 확인" type="password" autoComplete="new-password" {...bind("confirmPassword")} />
        <PrimaryButton type="submit" loading={submitting} className="mt-[6px]">
          비밀번호 재설정
        </PrimaryButton>
      </form>
    </div>
  );
}
