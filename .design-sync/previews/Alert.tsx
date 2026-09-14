import { Alert, AlertTitle, AlertDescription } from "bigdata-community-client";

const stage = { background: "var(--background)", color: "var(--foreground)", padding: 24, borderRadius: 8 };

export function Default() {
  return (
    <div style={{ ...stage, width: 420 }}>
      <Alert>
        <AlertTitle>신고가 접수되었습니다</AlertTitle>
        <AlertDescription>
          운영진 검토 후 24시간 이내에 처리 결과를 알려드립니다.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export function Destructive() {
  return (
    <div style={{ ...stage, width: 420 }}>
      <Alert variant="destructive">
        <AlertTitle>게시물을 삭제할 수 없습니다</AlertTitle>
        <AlertDescription>이미 삭제되었거나 존재하지 않는 게시물입니다.</AlertDescription>
      </Alert>
    </div>
  );
}
