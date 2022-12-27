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

const AD_PATTERNS = [
  "truyenfull",
  "www.truyenfull",
  "truyệnfull",
  "www.truyệnfull",
];

async function downloadChapter(page, chapter) {
  const [chapterPath, chapterIndex, chapterTitle] = chapter;

  await page.goto(chapterPath);

  console.log("Page chapter loaded!", chapterIndex);
  await page.waitForSelector("div#chapter-c");
  const chapterContentElementHandle = await page.$("div#chapter-c");
  const chapterContent = await chapterContentElementHandle.evaluate(
    (e, patterns) => {
      function cleanupChildren(element) {
        for (const child of element.children) {
          if (
            child.tagName !== "BR" &&
            child.tagName !== "I" &&
            child.tagName !== "A"
          ) {
            element.removeChild(child);
          } else if (child.children.length > 0) {
            cleanupChildren(child);
          }
        }
      }

      cleanupChildren(e);

      // for (const child of e.children) {
      //   if (
      //     child.tagName !== "BR" &&
      //     child.tagName !== "I" &&
      //     child.tagName !== "A"
      //   ) {
      //     e.removeChild(child);
      //   }

      //   // Remove nested children
      //   for (const nestedChild of child.children) {
      //     if (nestedChild.tagName === "BR") {
      //       continue;
      //     }
      //   }
      //   while (child.children.length > 0) {
      //     child.removeChild(child.children[0]);
      //   }
      // }

      const textContent = e.innerHTML
        .replaceAll("<br>", "\n")
        .replaceAll("<i>", "")
        .replaceAll("</i>", "");
      const lines = textContent
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Remove ad text
      const processedLines = [];
      for (const line of lines) {
        let cleanLine = line.replace(/<\/a>/g, "").replace(/<a.*>/g, "");
        let loweredCaseCleanLine = cleanLine.toLowerCase();

        let adIndex = Infinity;
        for (const adPattern of patterns) {
          const matchIndex = loweredCaseCleanLine.indexOf(adPattern);
          if (matchIndex === -1) {
            continue;
          }
          adIndex = Math.min(adIndex, matchIndex);
        }

        if (adIndex !== Infinity) {
          let lastIndex = adIndex - 1;
          while (lastIndex >= 0) {
            if (
              loweredCaseCleanLine.charAt(lastIndex) === "." ||
              loweredCaseCleanLine.charAt(lastIndex) === "!" ||
              loweredCaseCleanLine.charAt(lastIndex) === "?"
            ) {
              break;
            }
            lastIndex--;
          }
          cleanLine = cleanLine.substring(0, lastIndex + 1);
          loweredCaseCleanLine = cleanLine.toLowerCase();
        }

        for (const adPattern of patterns) {
          if (loweredCaseCleanLine.includes(adPattern)) {
            console.log("Unremoved ads", loweredCaseCleanLine);
          }
        }
        processedLines.push(cleanLine);
      }
      // Filter out lines starting with ad prefixes
      const cleanTextContent = processedLines.join("\n");

      return cleanTextContent;
    },
    AD_PATTERNS
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

  page.setJavaScriptEnabled(false);

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
        console.log("ERROR", err);
        console.log("Cooldown for 15 secs");
        await new Promise((resolve) => setTimeout(resolve, 15000));
      }
    }
  }
  await browser.close();
})();
