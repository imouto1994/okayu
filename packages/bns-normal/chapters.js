const puppeteer = require("puppeteer");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("../../stealth");

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

  await page.waitForSelector("div#mucluc-list");

  const rows = await page.$$("a.chuong-link");
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
      await row.$(".chuong-name")
    ).evaluate((e) => e.textContent.trim());
    chapters.push([chapterUrl, chapterNo, chapterName]);
  }
  return chapters;
}

(async () => {
  // TODO: Add series URL
  await getChapterUrls(
    "https://bachngocsach.com/reader/an-sat/muc-luc?page=all"
  );
})();
