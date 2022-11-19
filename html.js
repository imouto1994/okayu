const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("./stealth");

// Get chapters JSON
const chaptersJson = fs.readFileSync(
  path.join(process.cwd(), "./chapters.json")
);
const chapters = JSON.parse(chaptersJson);

(async () => {
  for (let i = 327; i < chapters.length; i++) {
    const chapter = chapters[i];
    const [_, chapterIndex, chapterTitle] = chapter;
    const chapterContent = fs.readFileSync(
      path.join(
        process.cwd(),
        `./content/${String(chapterIndex).padStart(4, "0")}.txt`
      ),
      {
        encoding: "utf-8",
      }
    );
    const chapterLines = chapterContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const htmlContent = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <title>${chapterTitle}</title>
  <link href="../Styles/stylesheet.css" type="text/css" rel="stylesheet"/>
</head>
<body>
  <section epub:type="chapter">
    <h2>${chapterTitle}</h2>

${chapterLines.map((line) => `    <p>${line.trim()}</p>\n\n`).join("")}
  </section>
</body>
</html>`;
    await fsPromises.writeFile(
      `./html/Chapter-${String(chapterIndex).padStart(4, "0")}.xhtml`,
      htmlContent
    );
  }
})();
