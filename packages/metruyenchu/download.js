const puppeteer = require("puppeteer");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("../../stealth");

// Get chapters JSON
const chaptersJson = fs.readFileSync(
  path.join(process.cwd(), "./chapters.json")
);
const chapters = JSON.parse(chaptersJson);

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;
const CHAPTER_DOMAIN = "https://metruyencv.com/truyen/";

async function downloadChapter(page, chapter) {
  const [chapterPath, chapterIndex, chapterTitle] = chapter;
  const chapterUrl = `${CHAPTER_DOMAIN}${chapterPath}`;

  await page.goto(chapterUrl);

  console.log("Page chapter loaded!");
  await page.waitForSelector("div#js-read__content");
  const chapterContentElementHandle = await page.$("div#js-read__content");
  const chapterContent = await chapterContentElementHandle.evaluate((e) => {
    const adPrefixes = [
      `"Mười vạn năm trước, Kiếp Dân phủ xuống. Cổ Thiên Đình chỉ`,
      `Mười vạn năm sau, Đông Hoang Việt quốc, một gã Chân Nhân`,
      `Mời đọc:`,
      `Mông Cổ nam chinh, Tống triều loạn lạc. Đại Việt`,
    ];

    for (const child of e.children) {
      if (child.tagName !== "BR") {
        e.removeChild(child);
      }
    }
    const textContent = e.innerHTML.replaceAll("<br>", "\n");
    const lines = textContent.split("\n").map((line) => line.trim());
    const cleanTextContent = lines
      .filter((line) => {
        for (const adPrefix of adPrefixes) {
          if (line.startsWith(adPrefix)) {
            return false;
          }
        }

        return true;
      })
      .filter((line) => line.length > 0)
      .join("\n");

    return cleanTextContent;
  });
  await fsPromises.writeFile(
    `./content/${String(chapterIndex).padStart(4, "0")}.txt`,
    chapterContent
  );
}

(async () => {
  const browser = await puppeteer.launch({
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins",
      " --disable-site-isolation-trials",
    ],
    headless: true,
  });
  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
  });

  await hideHeadless(page);

  await page.setRequestInterception(true);

  page.on("request", (req) => {
    if (req.resourceType() === "image") {
      req.abort();
    } else {
      req.continue();
    }
  });

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    for (let i = 0; i < 5; i++) {
      try {
        await downloadChapter(page, chapter);
        break;
      } catch (err) {
        console.log("Cooldown for 15 secs");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    }
  }
  await browser.close();
})();
