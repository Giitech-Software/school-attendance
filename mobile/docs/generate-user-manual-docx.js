const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const docsDir = __dirname;
const sourcePath = path.join(docsDir, "ASTEM-Attendance-User-Manual.md");
const buildDir = path.join(docsDir, ".docx-build");
const zipPath = path.join(docsDir, "ASTEM-Attendance-User-Manual.zip");
const outputPath = path.join(docsDir, "ASTEM-Attendance-User-Manual.docx");

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cleanMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/\\\|/g, "|")
    .trim();
}

function parseInline(text) {
  const runs = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      runs.push({ text: text.slice(cursor, match.index) });
    }

    const token = match[0];
    if (token.startsWith("**")) {
      runs.push({ text: token.slice(2, -2), bold: true });
    } else {
      runs.push({ text: token.slice(1, -1), code: true });
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    runs.push({ text: text.slice(cursor) });
  }

  return runs.length ? runs : [{ text }];
}

function runXml(run) {
  const props = [];
  if (run.bold) props.push("<w:b/>");
  if (run.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="334155"/>');
  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  const preserve = /^\s|\s$/.test(run.text) ? ' xml:space="preserve"' : "";
  return `<w:r>${rPr}<w:t${preserve}>${xmlEscape(run.text)}</w:t></w:r>`;
}

function paragraph(text, style, options = {}) {
  const pPr = [];
  if (style) pPr.push(`<w:pStyle w:val="${style}"/>`);
  if (options.indent) pPr.push(`<w:ind w:left="${options.indent}" w:hanging="360"/>`);
  if (options.keepNext) pPr.push("<w:keepNext/>");
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";
  return `<w:p>${pPrXml}${parseInline(text).map(runXml).join("")}</w:p>`;
}

function emptyParagraph() {
  return "<w:p/>";
}

function pageBreak() {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
}

function tableXml(rows) {
  const parsedRows = rows
    .filter((row) => !/^\|\s*-+/.test(row))
    .map((row) =>
      row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cleanMarkdown)
    );

  if (!parsedRows.length) return "";

  const gridColumns = parsedRows[0]
    .map(() => '<w:gridCol w:w="3000"/>')
    .join("");

  const rowXml = parsedRows
    .map((cells, rowIndex) => {
      const cellsXml = cells
        .map((cell) => {
          const fill = rowIndex === 0 ? '<w:shd w:fill="DDEBFF"/>' : "";
          return `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/>${fill}</w:tcPr>${paragraph(
            rowIndex === 0 ? `**${cell}**` : cell,
            "TableText"
          )}</w:tc>`;
        })
        .join("");
      return `<w:tr>${cellsXml}</w:tr>`;
    })
    .join("");

  return `<w:tbl>
    <w:tblPr>
      <w:tblStyle w:val="TableGrid"/>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${gridColumns}</w:tblGrid>
    ${rowXml}
  </w:tbl>`;
}

function buildDocumentXml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const body = [];
  let tableRows = [];
  let inCode = false;
  let codeLines = [];

  function flushTable() {
    if (tableRows.length) {
      body.push(tableXml(tableRows));
      body.push(emptyParagraph());
      tableRows = [];
    }
  }

  function flushCode() {
    if (codeLines.length) {
      codeLines.forEach((line) => body.push(paragraph(line, "CodeBlock")));
      body.push(emptyParagraph());
      codeLines = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushTable();
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
      tableRows.push(line);
      continue;
    }

    flushTable();

    if (!line.trim()) {
      body.push(emptyParagraph());
      continue;
    }

    if (line.startsWith("# ")) {
      body.push(paragraph(line.slice(2), "Title"));
      body.push(paragraph("Printable Word Manual", "Subtitle"));
      body.push(pageBreak());
      continue;
    }

    if (line.startsWith("## ")) {
      body.push(paragraph(line.slice(3), "Heading1", { keepNext: true }));
      continue;
    }

    if (line.startsWith("### ")) {
      body.push(paragraph(line.slice(4), "Heading2", { keepNext: true }));
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.*)$/);
    if (numbered) {
      body.push(paragraph(`${numbered[1]}. ${numbered[2]}`, "ListParagraph", { indent: 720 }));
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      body.push(paragraph(`- ${bullet[1]}`, "ListParagraph", { indent: 720 }));
      continue;
    }

    const nestedBullet = line.match(/^\s+-\s+(.*)$/);
    if (nestedBullet) {
      body.push(paragraph(`- ${nestedBullet[1]}`, "ListParagraph", { indent: 1080 }));
      continue;
    }

    body.push(paragraph(line, "Normal"));
  }

  flushTable();
  flushCode();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join("\n")}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1080" w:bottom="1440" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/>
      <w:cols w:space="720"/>
      <w:docGrid w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos"/><w:sz w:val="22"/><w:color w:val="172033"/></w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr><w:spacing w:after="220"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="42"/><w:color w:val="0B1C33"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle">
    <w:name w:val="Subtitle"/>
    <w:pPr><w:spacing w:after="400"/></w:pPr>
    <w:rPr><w:sz w:val="24"/><w:color w:val="475569"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="360" w:after="180"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="123F7A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="25"/><w:color w:val="172033"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="100"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="60"/><w:shd w:fill="F1F5F9"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableText">
    <w:name w:val="Table Text"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:after="40"/></w:pPr>
    <w:rPr><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>
  </w:style>
</w:styles>`;
}

function writeFile(relativePath, content) {
  const filePath = path.join(buildDir, relativePath);
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, "utf8");
}

function buildPackage() {
  const markdown = fs.readFileSync(sourcePath, "utf8");

  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.rmSync(zipPath, { force: true });
  fs.rmSync(outputPath, { force: true });
  fs.mkdirSync(buildDir, { recursive: true });

  writeFile(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  writeFile(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`
  );

  writeFile(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );

  writeFile("word/document.xml", buildDocumentXml(markdown));
  writeFile("word/styles.xml", stylesXml());

  const now = new Date().toISOString();
  writeFile(
    "docProps/core.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>ASTEM Attendance Register User Manual</dc:title>
  <dc:creator>ASTEM Attendance Register</dc:creator>
  <cp:lastModifiedBy>ASTEM Attendance Register</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
  );

  writeFile(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>ASTEM Attendance Register</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>ASTEM</Company>
</Properties>`
  );

  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path "${path.join(buildDir, "*")}" -DestinationPath "${zipPath}" -Force`,
    ],
    { stdio: "inherit" }
  );

  fs.renameSync(zipPath, outputPath);
  fs.rmSync(buildDir, { recursive: true, force: true });
  console.log(outputPath);
}

buildPackage();

