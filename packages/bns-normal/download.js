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
const CHAPTER_DOMAIN = "https://bachngocsach.com";

async function downloadChapter(page, chapter) {
  const [chapterPath, chapterIndex, chapterTitle] = chapter;
  const chapterUrl = `${CHAPTER_DOMAIN}${chapterPath}`;

  await page.goto(chapterUrl);

  console.log("Page chapter loaded!");
  await page.waitForSelector("div#noi-dung");
  const chapterContentElementHandle = await page.$("div#noi-dung");
  const chapterContent = await chapterContentElementHandle.evaluate((e) =>
    e.textContent.trim()
  );
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
