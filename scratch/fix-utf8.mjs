// Utility (throwaway): reverses mojibake where UTF-8 bytes were decoded as
// Windows-1252 and re-saved (e.g. "âœ“" -> "✓"). Only replaces runs that decode
// cleanly as UTF-8, so legit text is untouched. Not part of the build.
import fs from "fs";
import path from "path";

// chars that came from cp1252 bytes 0x80-0x9F (shifted)
const cp1252Shift = {
    "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
    "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
    "\u2030": 0x89, "\u0160": 0x8A, "\u2039": 0x8B, "\u0152": 0x8C,
    "\u017D": 0x8E, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
    "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
    "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9A, "\u203A": 0x9B,
    "\u0153": 0x9C, "\u017E": 0x9E, "\u0178": 0x9F
};

const runRegex = /[\u0080-\u00FF\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178]+/g;

function charToByte(ch) {
    const b = cp1252Shift[ch];
    if (b !== undefined) return b;
    const cp = ch.codePointAt(0);
    // bytes 0x80-0x9F sin definición cp1252 se guardaron como controles C1
    if (cp >= 0x80 && cp <= 0x9F) return cp;
    if (cp >= 0xA0 && cp <= 0xFF) return cp;
    return null;
}

const decoder = new TextDecoder("utf-8", { fatal: true });

function fixMojibake(text) {
    let fixed = 0;
    const out = text.replace(runRegex, run => {
        if (run.length < 2) return run;
        const chars = [...run];
        const bytes = [];
        for (const ch of chars) {
            const b = charToByte(ch);
            if (b === null) return run;
            bytes.push(b);
        }
        // Decodificar el mayor prefijo UTF-8 válido; los bytes sobrantes se
        // devuelven como chars originales (eran texto legítimo, no mojibake).
        let end = bytes.length;
        let decoded = null;
        while (end >= 2) {
            try {
                decoded = decoder.decode(Uint8Array.from(bytes.slice(0, end)));
                if (!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(decoded)) break;
                decoded = null;
            } catch {}
            end--;
        }
        if (decoded === null || decoded === run) return run;
        fixed++;
        return decoded + chars.slice(end).join("");
    });
    return { out, fixed };
}

function* walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) yield* walk(p);
        else if (/\.(ts|tsx)$/.test(ent.name)) yield p;
    }
}

const start = process.argv[2] ?? "src";
const results = [];
for (const file of walk(start)) {
    const text = fs.readFileSync(file, "utf8");
    if (!runRegex.test(text)) { runRegex.lastIndex = 0; continue; }
    runRegex.lastIndex = 0;
    const { out, fixed } = fixMojibake(text);
    if (fixed > 0) {
        fs.writeFileSync(file, out, "utf8");
        results.push([file, fixed]);
    }
}
results.sort((a, b) => b[1] - a[1]);
for (const [f, n] of results.slice(0, 30)) console.log(n, f);
console.log("files changed:", results.length, "runs fixed:", results.reduce((s, r) => s + r[1], 0));
