// Figma 비교 스크린샷: 로컬 A안 화면(/__aplan/<screen>)을 360×780으로 찍고,
// docs/figma-compare/<screen>-figma.png(Figma get_screenshot 결과)와 나란히 붙인 이미지를 만든다.
//   node scripts/figma-compare.mjs <screen> [baseUrl]
// 결과: docs/figma-compare/<screen>-local.png, <screen>-compare.png
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [screen, baseUrl = "http://localhost:5173"] = process.argv.slice(2);
if (!screen) {
  console.error("사용법: node scripts/figma-compare.mjs <screen> [baseUrl]");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "docs", "figma-compare");
const localPng = path.join(outDir, `${screen}-local.png`);
const figmaPng = path.join(outDir, `${screen}-figma.png`);
const comparePng = path.join(outDir, `${screen}-compare.png`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/__aplan/${screen}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: localPng });
  console.log(`로컬: ${localPng}`);

  if (existsSync(figmaPng)) {
    const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString("base64")}`;
    const compare = await browser.newPage({ viewport: { width: 760, height: 820 }, deviceScaleFactor: 1 });
    await compare.setContent(`
      <body style="margin:0;background:#888;font:12px sans-serif;color:#fff;display:flex;gap:20px;padding:10px">
        <div><div>Figma</div><img src="${b64(figmaPng)}" width="360" height="780"></div>
        <div><div>Local</div><img src="${b64(localPng)}" width="360" height="780"></div>
      </body>`);
    await compare.screenshot({ path: comparePng, fullPage: true });
    console.log(`비교: ${comparePng}`);
  } else {
    console.log(`Figma 스크린샷이 없습니다: ${figmaPng}`);
  }
} finally {
  await browser.close();
}
