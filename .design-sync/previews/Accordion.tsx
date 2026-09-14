import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  minHeight: 320,
};

export function Default() {
  return (
    <div style={stage}>
      <Accordion type="single" collapsible defaultValue="item-1" style={{ width: 420 }}>
        <AccordionItem value="item-1">
          <AccordionTrigger>수강신청은 언제 하나요?</AccordionTrigger>
          <AccordionContent>
            매 학기 개강 2주 전에 수강신청 기간이 공지되며, 포털의
            수강신청 메뉴에서 진행합니다.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-2">
          <AccordionTrigger>강의평은 누구나 볼 수 있나요?</AccordionTrigger>
          <AccordionContent>
            재학생 인증을 완료한 회원만 강의평을 열람하고 작성할 수 있습니다.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="item-3">
          <AccordionTrigger>신고한 게시물은 어떻게 처리되나요?</AccordionTrigger>
          <AccordionContent>
            운영진 검토 후 3영업일 이내에 처리 결과가 알림으로 전송됩니다.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
