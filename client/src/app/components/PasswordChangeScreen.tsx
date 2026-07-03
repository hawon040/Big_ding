import { useState } from "react";
import { ChevronLeft, Eye, EyeOff } from "lucide-react"; // 비밀번호 보기 아이콘 추가
import bigRoadingIcon from "@/assets/big-roading-icon.png";

interface RegisterScreenProps {
  onComplete: () => void; // 회원가입 완료 → 로그인 화면으로
  onSkip: () => void; // 뒤로가기
}

export function PasswordChangeScreen({ onComplete, onSkip }: RegisterScreenProps) {
  // 단계: info(기본정보) → verify(인증) → password(비밀번호설정)
  const [verified, setVerified] = useState(false);
  const [nicknameChecked, setNicknameChecked] = useState(false);

  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [professor, setProfessor] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // 팀원 추가 기능: 비밀번호 보이기/숨기기 상태
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const checkNickname = async () => {
    if (!name) {
      alert("닉네임을 입력해주세요.");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/auth/check-nickname", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nickname: name,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNicknameChecked(true);
      }

      alert(data.message);
    } catch {
      alert("서버 연결 실패");
    }
  };

  // 인증번호 확인
  const handleVerify = async () => {
    if (!studentId || !name || !professor) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    if (!nicknameChecked) {
      alert("닉네임 중복확인을 먼저 해주세요.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, professor, code }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      // 인증 성공
      setVerified(true);
      alert("인증이 완료되었습니다.");
    } catch {
      alert("서버 연결 실패");
    }
  };

  // 회원가입 완료 (내 신규 코드 기준 정규식 적용)
  const handleRegister = async () => {
    if (!password || !confirmPassword) {
      alert("비밀번호를 입력해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }
    
    // 내 신규 버전 정규식 검사
    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      alert("비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.");
      return;
    }
    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, name, professor, code, password }),
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message); return; }
      alert("회원가입이 완료되었습니다! 로그인해주세요.");

      setNicknameChecked(false);
      setVerified(false);

      onComplete(); // 로그인 화면으로
    } catch {
      alert("서버 연결 실패");
    }
  };

  return (
    <div
      className="flex-1 flex flex-col items-center px-6 py-10 min-h-full"
      style={{ background: "linear-gradient(160deg, #0a0f1f 0%, #0d1426 60%, #111a30 100%)" }}
    >
      <div className="w-full rounded-3xl p-6 pb-60 shadow-xl" style={{ background: "var(--card)" }}>

<<<<<<< Updated upstream
        {/* 뒤로가기 버튼 */}
=======
        {/* 팀원 추가 기능: 뒤로가기 버튼 */}
>>>>>>> Stashed changes
        <button
          type="button"
          onClick={onSkip}
          className="flex items-center gap-1 mb-2 -ml-1 px-1 py-1 text-xs font-medium transition-all active:scale-95"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ChevronLeft size={16} />
          뒤로가기
        </button>

        {/* 상단 아이콘 + 제목 */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-3xl mb-3 overflow-hidden">
            <img src={bigRoadingIcon} alt="Big Roading" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
            회원가입
          </h2>
        </div>

        <div className="flex flex-col gap-3">

          {/* 회원가입 정보 */}
          <>
            {/* 학번 */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                학번
              </label>
              <input
                type="text"
                placeholder="예) 20210001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={verified}
                maxLength={8}
                className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
            </div>

            {/* 닉네임 (내 신규 버전 placeholder) */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                닉네임
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="닉네임 (예: 홍길동)"
                  value={name}
                  disabled={verified}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNicknameChecked(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
<<<<<<< Updated upstream

                <button
                  type="button"
                  disabled={verified}
                  onClick={checkNickname}
                  className="px-4 py-3 rounded-2xl font-semibold text-sm"
                  style={{ background: "var(--primary)", color: "white", whiteSpace: "nowrap" }}
                >
                  중복확인
                </button>
              </div>
            </div>

            {/* 담당 교수 선택 */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                담당 교수
              </label>
              <select
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                disabled={verified}
                className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: professor ? "var(--foreground)" : "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
              >
                <option value="">교수님을 선택하세요</option>
                <option value="유진호">유진호 교수</option>
                <option value="차대현">차대현 교수</option>
                <option value="홍진근">홍진근 교수</option>
              </select>
            </div>

            {/* 인증번호 */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                인증번호 (교수님께 받은 2자리)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={verified}
                  placeholder="예) 11"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={2}
                  className="flex-1 px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
                {/* 인증 확인 버튼 */}
                <button
                  onClick={handleVerify}
                  disabled={verified}
                  className="px-4 py-3 rounded-2xl font-semibold text-sm"
                  style={{
                    background: verified ? "#999999" : "var(--primary)",
                    color: "white",
                    whiteSpace: "nowrap",
                    cursor: verified ? "not-allowed" : "pointer",
                  }}
                >
                  인증 확인
                </button>
              </div>
            </div>
          </>

          {/* 비밀번호 (내 신규 버전 placeholder + 팀원의 눈 모양 버튼 추가) */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="8자 이상 / 영문 / 숫자 / 특수문자 포함"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 (내 신규 버전 placeholder + 팀원의 눈 모양 버튼 추가) */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호 확인
            </label>

  <div className="relative">
    <input
      type={showConfirmPassword ? "text" : "password"}
      placeholder="비밀번호를 다시 입력하세요"
      value={confirmPassword}
      onChange={(e) => setConfirmPassword(e.target.value)}
      className="w-full px-4 py-3 pr-11 rounded-2xl outline-none text-sm"
      style={{
        background: "var(--input-background)",
        color: "var(--foreground)",
        border: "1.5px solid var(--border)"
      }}
    />
    <button
      type="button"
      onClick={() => setShowConfirmPassword((v) => !v)}
      className="absolute right-3 top-1/2 -translate-y-1/2"
      style={{ color: "var(--muted-foreground)" }}
      tabIndex={-1}
    >
      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  </div>
</div>

          <button
            onClick={() => {
              if (!nicknameChecked) {
                alert("닉네임 중복확인을 먼저 해주세요.");
                return;
              }

              if (!verified) {
                alert("먼저 인증번호 확인을 완료해주세요.");
                return;
              }

=======

                <button
                  type="button"
                  disabled={verified}
                  onClick={checkNickname}
                  className="px-4 py-3 rounded-2xl font-semibold text-sm"
                  style={{ background: "var(--primary)", color: "white", whiteSpace: "nowrap" }}
                >
                  중복확인
                </button>
              </div>
            </div>

            {/* 담당 교수 선택 */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                담당 교수
              </label>
              <select
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                disabled={verified}
                className="w-full px-4 py-3 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: professor ? "var(--foreground)" : "var(--muted-foreground)", border: "1.5px solid var(--border)" }}
              >
                <option value="">교수님을 선택하세요</option>
                <option value="유진호">유진호 교수</option>
                <option value="차대현">차대현 교수</option>
                <option value="홍진근">홍진근 교수</option>
              </select>
            </div>

            {/* 인증번호 */}
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
                인증번호 (교수님께 받은 2자리)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={verified}
                  placeholder="예) 11"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={2}
                  className="flex-1 px-4 py-3 rounded-2xl outline-none text-sm"
                  style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
                />
                {/* 인증 확인 버튼 */}
                <button
                  onClick={handleVerify}
                  disabled={verified}
                  className="px-4 py-3 rounded-2xl font-semibold text-sm"
                  style={{
                    background: verified ? "#999999" : "var(--primary)",
                    color: "white",
                    whiteSpace: "nowrap",
                    cursor: verified ? "not-allowed" : "pointer",
                  }}
                >
                  인증 확인
                </button>
              </div>
            </div>
          </>

          {/* 비밀번호 (내 신규 버전 placeholder + 팀원의 눈 모양 버튼 추가) */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="8자 이상 / 영문 / 숫자 / 특수문자 포함"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 비밀번호 확인 (내 신규 버전 placeholder + 팀원의 눈 모양 버튼 추가) */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--muted-foreground)" }}>
              비밀번호 확인
            </label>

            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 pr-11 rounded-2xl outline-none text-sm"
                style={{ background: "var(--input-background)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            onClick={() => {
              if (!nicknameChecked) {
                alert("닉네임 중복확인을 먼저 해주세요.");
                return;
              }

              if (!verified) {
                alert("먼저 인증번호 확인을 완료해주세요.");
                return;
              }

>>>>>>> Stashed changes
              handleRegister();
            }}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm shadow-md mt-1"
            style={{ background: "var(--primary)", color: "white" }}
          >
            가입 완료
          </button>

        </div>
      </div>
    </div>
  );
}