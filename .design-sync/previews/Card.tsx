import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  padding: 24,
  borderRadius: 8,
};

export function Default() {
  return (
    <div style={stage}>
      <Card style={{ width: 360 }}>
        <CardHeader>
          <CardTitle>강의평 작성</CardTitle>
          <CardDescription>
            수강한 강의에 대한 솔직한 후기를 남겨주세요.
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm">
              수정
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
            이 강의는 과제량이 적당하고 팀플이 없어서 만족스러웠습니다. 다만
            출석 체크가 엄격한 편이라 지각에 주의해야 합니다.
          </p>
        </CardContent>
        <CardFooter style={{ gap: 8 }}>
          <Button variant="outline">취소</Button>
          <Button>등록하기</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export function Simple() {
  return (
    <div style={stage}>
      <Card style={{ width: 320 }}>
        <CardHeader>
          <CardTitle>공지사항</CardTitle>
          <CardDescription>2026년 2학기 수강신청 안내</CardDescription>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 14 }}>
            수강신청 정정 기간은 9월 20일부터 24일까지입니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
