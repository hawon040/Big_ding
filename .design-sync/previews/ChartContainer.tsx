import { ChartContainer, ChartTooltip, ChartTooltipContent } from "bigdata-community-client";
import { BarChart, Bar, XAxis, CartesianGrid } from "recharts";

const stage = {
  background: "var(--background)",
  color: "var(--foreground)",
  padding: 24,
  borderRadius: 8,
  width: 420,
};

const data = [
  { month: "5월", posts: 82 },
  { month: "6월", posts: 104 },
  { month: "7월", posts: 61 },
  { month: "8월", posts: 143 },
  { month: "9월", posts: 176 },
];

const chartConfig = {
  posts: { label: "게시물 수", color: "#3b82f6" },
};

export function Default() {
  return (
    <div style={stage}>
      <ChartContainer config={chartConfig} className="h-[220px] w-full">
        <BarChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="posts" fill="var(--color-posts)" radius={4} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
