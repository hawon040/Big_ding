import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "bigdata-community-client";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  width: 440,
};

const slides = [
  { title: "1강. 오리엔테이션", color: "#1d4ed8" },
  { title: "2강. 자료구조 기초", color: "#0f766e" },
  { title: "3강. 알고리즘 실습", color: "#7c3aed" },
  { title: "4강. 프로젝트 안내", color: "#b45309" },
];

export function Default() {
  return (
    <div style={stage}>
      <Carousel>
        <CarouselContent>
          {slides.map((s) => (
            <CarouselItem key={s.title}>
              <div
                style={{
                  height: 160,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: s.color,
                  color: "white",
                  fontWeight: 600,
                }}
              >
                {s.title}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
