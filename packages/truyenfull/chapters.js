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

let INDEX = 1;

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

  await page.waitForSelector(".list-chapter");

  console.log("View chapters in first page!");

  let chapters = [];
  let rows;
  let nextButton;
  let nextButtonDisabled;

  await page.waitForSelector(".list-chapter li a");
  rows = await page.$$(".list-chapter li a");
  chapters = chapters.concat(await processChapterRows(rows));
  nextButton = await page.$(".pagination .glyphicon-menu-right");

  while (!!nextButton) {
    nextButton.click();
    await page.waitForTimeout(2000);
    await page.waitForSelector(".list-chapter li a");
    rows = await page.$$(".list-chapter li a");
    chapters = chapters.concat(await processChapterRows(rows));
    nextButton = await page.$(".pagination .glyphicon-menu-right");
    console.log("Viewing chapters in next page!");
  }
  await fsPromises.writeFile(
    "./chapters.json",
    JSON.stringify(chapters, null, 2)
  );
  await browser.close();
}

async function processChapterRows(rows) {
  const chapters = [];
  for (const row of rows) {
    const chapterUrl = await row.evaluate((e) => e.getAttribute("href"));
    const chapterNo = INDEX++;
    const chapterName = (
      await row.evaluate((e) => e.getAttribute("title"))
    ).trim();
    chapters.push([chapterUrl, chapterNo, chapterName]);
  }
  return chapters;
}

(async () => {
  await getChapterUrls(titleUrl);
})();
