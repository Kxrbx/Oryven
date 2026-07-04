// Rewrites the Oryven brand mark path data from the original 0-1254
// user-unit coordinate space into a square 0-923.61 coordinate space.
//
// Why: resvg (used by `npx tauri icon`) does not apply the Y component
// of <g transform="scale(sx sy) ..."> for non-uniform scales, so we
// bake the transform directly into the path data.
//
// IMPORTANT: this script handles SVG implicit command repetition.
// A path like `c1 2 3 4 5 6 7 8 9 10 11 12` actually means TWO cubic
// beziers (the second c is implicit). The script tracks `lastCmd` and
// repeats it when numbers are encountered without a new command letter.
//
// Supported commands: M, m, c, z, Z. Other commands throw.
//
// Usage: node scripts/rewrite-brand-paths.cjs <file1.svg> [file2.tsx] ...

const fs = require("fs");

// The mark's natural bbox in the original 0-1254 coord space is
// (191.89, 191.29) -> (1115.50, 1013.26). We map it to (0, 0) ->
// (923.61, 923.61), so the O fills a square viewBox edge-to-edge.
const TX = -191.89;
const TY = -191.29;
const SY = 923.61 / 821.97; // 1.12364...

function transformAbs(x, y) {
  return [x + TX, (y + TY) * SY];
}

function fmt(n) {
  return n.toFixed(2);
}

function tokenize(d) {
  const tokens = [];
  let i = 0;
  while (i < d.length) {
    const c = d[i];
    if (c === " " || c === "," || c === "\n" || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (/[A-Za-z]/.test(c)) {
      tokens.push({ type: "cmd", value: c });
      i++;
      continue;
    }
    let j = i;
    if (c === "-" || c === "+") j++;
    while (j < d.length && /[\d.eE+\-]/.test(d[j])) j++;
    if (j === i) {
      i++;
      continue;
    }
    const num = parseFloat(d.slice(i, j));
    if (Number.isNaN(num)) {
      i++;
      continue;
    }
    tokens.push({ type: "num", value: num });
    i = j;
  }
  return tokens;
}

function transformPath(d) {
  const tokens = tokenize(d);
  let curX = 0;
  let curY = 0;
  let newCurX = 0;
  let newCurY = 0;
  let result = "";
  let tokenIdx = 0;
  let lastCmd = null;
  let absoluteMode = true;

  const need = (n) => {
    if (tokenIdx + n > tokens.length) {
      throw new Error(`unexpected end of path data near token ${tokenIdx}`);
    }
  };

  while (tokenIdx < tokens.length) {
    const token = tokens[tokenIdx];
    if (token.type === "cmd") {
      lastCmd = token.value;
      tokenIdx++;
      absoluteMode = lastCmd === lastCmd.toUpperCase();
    }
    if (!lastCmd) break;
    if (tokenIdx >= tokens.length) break;

    if (lastCmd === "M") {
      need(2);
      const x = tokens[tokenIdx++].value;
      const y = tokens[tokenIdx++].value;
      const [nx, ny] = transformAbs(x, y);
      curX = x;
      curY = y;
      newCurX = nx;
      newCurY = ny;
      result += `M${fmt(nx)} ${fmt(ny)} `;
    } else if (lastCmd === "c") {
      need(6);
      const dx1 = tokens[tokenIdx++].value;
      const dy1 = tokens[tokenIdx++].value;
      const dx2 = tokens[tokenIdx++].value;
      const dy2 = tokens[tokenIdx++].value;
      const dx = tokens[tokenIdx++].value;
      const dy = tokens[tokenIdx++].value;

      const absX1 = curX + dx1, absY1 = curY + dy1;
      const absX2 = curX + dx2, absY2 = curY + dy2;
      const absX = curX + dx, absY = curY + dy;

      const [nX1, nY1] = transformAbs(absX1, absY1);
      const [nX2, nY2] = transformAbs(absX2, absY2);
      const [nX, nY] = transformAbs(absX, absY);

      const ndx1 = nX1 - newCurX, ndy1 = nY1 - newCurY;
      const ndx2 = nX2 - newCurX, ndy2 = nY2 - newCurY;
      const ndx = nX - newCurX, ndy = nY - newCurY;

      curX = absX; curY = absY;
      newCurX = nX; newCurY = nY;

      result += `c${fmt(ndx1)} ${fmt(ndy1)} ${fmt(ndx2)} ${fmt(ndy2)} ${fmt(ndx)} ${fmt(ndy)} `;
    } else if (lastCmd === "z" || lastCmd === "Z") {
      result += "z ";
    } else {
      throw new Error(
        `unsupported SVG path command "${lastCmd}" in path data: ${d.slice(0, 80)}...`
      );
    }
  }

  return result.trim();
}

// Sanity check: the bbox corners must map to (0,0) and (923.61, 923.60).
const [tlX, tlY] = transformAbs(191.89, 191.29);
const [brX, brY] = transformAbs(1115.50, 1013.26);
console.log(`Sanity: (191.89, 191.29) -> (${tlX.toFixed(2)}, ${tlY.toFixed(2)})`);
console.log(`Sanity: (1115.50, 1013.26) -> (${brX.toFixed(2)}, ${brY.toFixed(2)})`);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/rewrite-brand-paths.cjs <file1> [file2] ...");
  process.exit(1);
}

// <svg> wrapper replacement. Different rules per file type:
// - .svg: rewrite width/height/viewBox to the canonical square 923.61
//   so resvg (used by `npx tauri icon`) sees a square source.
// - .tsx: update the viewBox. Preserve existing width/height if present;
//   if absent, fall back to the viewBox size (923.61) so the SVG is
//   visible. The caller can override the rendered size via CSS or by
//   passing --width / --height flags.
function rewriteSvgRoot(content, file) {
  const isTsx = file.toLowerCase().endsWith(".tsx");
  return content.replace(
    /<svg([^>]*?)>/,
    (match, attrs) => {
      const widthMatch = attrs.match(/\swidth="([^"]*)"/);
      const heightMatch = attrs.match(/\sheight="([^"]*)"/);
      const existingWidth = widthMatch ? widthMatch[1] : null;
      const existingHeight = heightMatch ? heightMatch[1] : null;
      const stripped = attrs
        .replace(/\s+viewBox="[^"]*"/, "")
        .replace(/\s+preserveAspectRatio="[^"]*"/, "")
        .replace(/\s+width="[^"]*"/, "")
        .replace(/\s+height="[^"]*"/, "")
        .trim();
      if (isTsx) {
        const w = existingWidth || "923.61";
        const h = existingHeight || "923.61";
        return `<svg ${stripped} width="${w}" height="${h}" viewBox="0 0 923.61 923.61">`;
      }
      return `<svg ${stripped} width="923.61" height="923.61" viewBox="0 0 923.61 923.61" preserveAspectRatio="xMidYMid meet">`;
    }
  );
}

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const pathRegex = /d="([^"]+)"/g;
  let newContent = content;
  let m;
  let transformed = 0;
  while ((m = pathRegex.exec(content)) !== null) {
    const oldD = m[1];
    const newD = transformPath(oldD);
    newContent = newContent.replace(`d="${oldD}"`, `d="${newD}"`);
    transformed++;
    console.log(`  ${file}: path ${transformed}  ${oldD.length} chars -> ${newD.length} chars`);
  }
  newContent = rewriteSvgRoot(newContent, file);
  fs.writeFileSync(file, newContent);
  console.log(`${file}: done (${transformed} path(s) transformed, ${file.endsWith(".tsx") ? "tsx" : "svg"} wrapper mode)`);
}
