const fs = require("fs");
const path = require("path");

const docsDir = __dirname;
const sourcePath = path.join(docsDir, "ASTEM-Attendance-User-Manual.md");
const outputPath = path.join(docsDir, "ASTEM-Attendance-User-Manual.html");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function tableHtml(rows) {
  const parsedRows = rows
    .filter((row) => !/^\|\s*-+/.test(row))
    .map((row) =>
      row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim())
    );

  if (!parsedRows.length) return "";

  return [
    "<table>",
    ...parsedRows.map((cells, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      return `<tr>${cells
        .map((cell) => `<${tag}>${inlineMarkdown(cell)}</${tag}>`)
        .join("")}</tr>`;
    }),
    "</table>",
  ].join("\n");
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let listType = null;
  let tableRows = [];
  let inCode = false;
  let codeLines = [];

  function closeList() {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  }

  function flushTable() {
    if (tableRows.length) {
      html.push(tableHtml(tableRows));
      tableRows = [];
    }
  }

  function flushCode() {
    if (codeLines.length) {
      html.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      codeLines = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushTable();
      closeList();
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^\|.*\|$/.test(line.trim())) {
      closeList();
      tableRows.push(line);
      continue;
    }

    flushTable();

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }

    if (line.startsWith("### ")) {
      closeList();
      html.push(`<h3>${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${inlineMarkdown(numbered[2])}</li>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineMarkdown(line)}</p>`);
  }

  flushTable();
  flushCode();
  closeList();

  return html.join("\n");
}

const styles = `
body {
  font-family: Arial, sans-serif;
  color: #172033;
  line-height: 1.55;
  margin: 0;
  background: #f5f7fb;
}
main {
  max-width: 980px;
  margin: 0 auto;
  padding: 34px 22px 70px;
  background: #ffffff;
}
h1 {
  color: #0B1C33;
  margin-bottom: 4px;
  font-size: 34px;
}
h2 {
  color: #123F7A;
  border-top: 1px solid #E5EAF2;
  padding-top: 20px;
  margin-top: 30px;
}
h3 {
  color: #172033;
  margin-top: 20px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0 20px;
}
th,
td {
  border: 1px solid #D9E1EE;
  padding: 9px 11px;
  text-align: left;
  vertical-align: top;
}
th {
  background: #DDEBFF;
  color: #0B1C33;
}
code {
  background: #EEF2F7;
  padding: 1px 4px;
  border-radius: 4px;
}
pre {
  background: #F1F5F9;
  border-left: 4px solid #2563EB;
  padding: 14px;
  overflow: auto;
  color: #334155;
}
ul,
ol {
  padding-left: 25px;
}
strong {
  color: #0B1C33;
}
@media print {
  body {
    background: #ffffff;
  }
  main {
    max-width: none;
    padding: 16mm;
  }
  h2 {
    break-after: avoid;
  }
  table,
  ul,
  ol,
  pre {
    break-inside: avoid;
  }
}
`;

const markdown = fs.readFileSync(sourcePath, "utf8");
const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ASTEM Attendance Register User Manual</title>
  <style>${styles}</style>
</head>
<body>
<main>
${markdownToHtml(markdown)}
</main>
</body>
</html>
`;

fs.writeFileSync(outputPath, html, "utf8");
console.log(outputPath);

