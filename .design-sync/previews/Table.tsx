import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
};

const rows = [
  { course: "데이터구조론", prof: "김민석", credit: 3, rating: "4.6" },
  { course: "운영체제", prof: "이수진", credit: 3, rating: "4.2" },
  { course: "빅데이터처리", prof: "박현우", credit: 3, rating: "4.8" },
  { course: "확률과통계", prof: "정다은", credit: 2, rating: "3.9" },
];

export function Default() {
  return (
    <div style={{ ...stage, width: 520 }}>
      <Table>
        <TableCaption>2026년 2학기 강의평 요약</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>과목명</TableHead>
            <TableHead>교수</TableHead>
            <TableHead>학점</TableHead>
            <TableHead>평점</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.course}>
              <TableCell>{r.course}</TableCell>
              <TableCell>{r.prof}</TableCell>
              <TableCell>{r.credit}</TableCell>
              <TableCell>
                <Badge variant="secondary">{r.rating}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
