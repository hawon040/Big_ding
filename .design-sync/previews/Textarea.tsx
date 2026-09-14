import { Textarea } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Empty() {
  return (
    <div style={{ ...stage, width: 360 }}>
      <Textarea placeholder="이 강의에 대한 솔직한 후기를 남겨주세요." />
    </div>
  );
}

export function Filled() {
  return (
    <div style={{ ...stage, width: 360 }}>
      <Textarea defaultValue={"과제량은 적당했고 팀플이 없어서 만족스러웠습니다.\n다만 출석 체크가 엄격한 편이라 지각에 주의해야 합니다."} />
    </div>
  );
}

export function Disabled() {
  return (
    <div style={{ ...stage, width: 360 }}>
      <Textarea disabled defaultValue="이미 제출된 후기는 수정할 수 없습니다." />
    </div>
  );
}
