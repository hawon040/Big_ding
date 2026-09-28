// Figma 비교용 요소 위치 측정: node scripts/measure.mjs <화면> "<CSS 선택자>"
import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 780 } });
await p.goto("http://localhost:5173/__aplan/" + process.argv[2], { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
const rows = await p.evaluate((sel) => [...document.querySelectorAll(sel)].map(e => { const r = e.getBoundingClientRect(); return `${e.tagName.padEnd(7)} x${r.x.toFixed(1)} y${r.y.toFixed(1)} w${r.width.toFixed(1)} h${r.height.toFixed(1)} ${(e.getAttribute("aria-label")||e.textContent||"").trim().slice(0,14)}`; }), process.argv[3]);
console.log(rows.join("\n")); await b.close();
