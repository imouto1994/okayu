const puppeteer = require("puppeteer");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("./stealth");

// Get user data
const userJson = fs.readFileSync(path.join(process.cwd(), "./user.json"));

const VIEWPORT_WIDTH = 800;
const VIEWPORT_HEIGHT = 600;

async function downloadChapter(chapterUrl) {
  const browser = await puppeteer.launch({
    // args: [
    //   "--disable-web-security",
    //   "--disable-features=IsolateOrigins",
    //   " --disable-site-isolation-trials",
    // ],
    headless: true,
  });
  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
  });

  await page.goto(chapterUrl);

  await page.evaluate((user) => {
    localStorage.setItem("user", user);
  }, userJson);

  await page.goto(chapterUrl);

  await browser.close();
}

async function getChapterUrls(titleUrl) {
  const browser = await puppeteer.launch({
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins",
      " --disable-site-isolation-trials",
    ],
    headless: false,
  });
  const page = await browser.newPage();

  await page.setViewport({
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
  });

  // await hideHeadless(page);

  await page.setRequestInterception(true);

  page.on("request", (req) => {
    if (req.resourceType() === "image") {
      req.abort();
    } else {
      req.continue();
    }
  });

  await page.goto(titleUrl);

  console.log("Inject local storage!");

  await page.evaluate(() => {
    localStorage.setItem("user", ``);
  });
  await page.goto(titleUrl);

  console.log("Page title loaded!");

  await page.waitForSelector("div#list-chapters");
  await page.click("div#list-chapters");

  console.log("View chapters in first page!");

  let chapters = [];
  let rows;
  let nextButton;
  let nextButtonDisabled;

  await page.waitForSelector("table#list-chapters .chapter.table-row");
  rows = await page.$$("table#list-chapters .chapter.table-row");
  chapters = chapters.concat(await processChapterRows(rows));
  nextButton = await page.$("table#list-chapters + div li:last-of-type");
  nextButtonDisabled = await nextButton.evaluate(
    (e) => e.getAttribute("class") === "disabled"
  );

  while (!nextButtonDisabled) {
    nextButton.click();
    await page.waitForTimeout(2000);
    await page.waitForSelector("table#list-chapters a.chapter.table-row");
    rows = await page.$$("table#list-chapters a.chapter.table-row");
    chapters = chapters.concat(await processChapterRows(rows));
    nextButton = await page.$("table#list-chapters + div li:last-of-type");
    nextButtonDisabled = await nextButton.evaluate(
      (e) => e.getAttribute("class") === "disabled"
    );
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
    const chapterNo = await (
      await row.$(".text-center")
    ).evaluate((e) => e.textContent.trim());
    const chapterName = await (
      await row.$(".chapter-name")
    ).evaluate((e) => e.textContent.trim());
    chapters.push([chapterUrl, chapterNo, chapterName]);
  }
  return chapters;
}

(async () => {
  await getChapterUrls(
    "https://vip.bachngocsach.com/truyen/trung-nhien/304.html"
  );
})();
