const puppeteer = require("puppeteer");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("../../stealth");

// Get config JSON
const configJson = fs.readFileSync(path.join(__dirname, "./config.json"));
const config = JSON.parse(configJson);
const { titleUrl } = config;

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;

async function getChapterUrls(titleUrl) {
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

  await page.goto(titleUrl);

  console.log("Page title loaded!");

  await page.waitForSelector("a#nav-tab-chap");
  await page.click("a#nav-tab-chap");
  await page.waitForSelector("div#chapter-list .nh-section a");

  const rows = await page.$$("div#chapter-list .nh-section a");
  const chapters = await processChapterRows(rows);

  await fsPromises.writeFile(
    "./chapters.json",
    JSON.stringify(chapters, null, 2)
  );
  await browser.close();
}

async function processChapterRows(rows) {
  const chapters = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const chapterUrl = await row.evaluate((e) => e.getAttribute("href"));
    const chapterNo = i + 1;
    const chapterName = await (
      await row.$("div.text-overflow-1-lines")
    ).evaluate((e) => {
      e.removeChild(e.firstElementChild);
      return e.textContent.trim();
    });
    chapters.push([chapterUrl, chapterNo, chapterName]);
  }
  return chapters;
}

(async () => {
  // TODO: Add series URL
  await getChapterUrls(titleUrl);
})();
