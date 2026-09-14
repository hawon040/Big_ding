import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  padding: 24,
  borderRadius: 8,
  minHeight: 380,
};

export function Default() {
  return (
    <div style={stage}>
      <Dialog open>
        <DialogTrigger asChild>
          <Button variant="outline">신고하기</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>게시물 신고</DialogTitle>
            <DialogDescription>
              신고 사유를 선택하면 운영진이 검토 후 처리 결과를 알려드립니다.
            </DialogDescription>
          </DialogHeader>
          <div style={{ fontSize: 14, color: "var(--muted-foreground)" }}>
            허위 정보, 욕설/비방, 광고성 게시물 등을 신고할 수 있습니다.
          </div>
          <DialogFooter>
            <Button variant="outline">취소</Button>
            <Button variant="destructive">신고 제출</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
