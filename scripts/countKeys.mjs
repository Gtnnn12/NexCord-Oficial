import { readFileSync } from "fs";

const content = readFileSync("src/nightcordplugins/autoTranslateNightcord/index.ts", "utf8");
const matches = content.match(/"en":/g) || [];
console.log(`Total valid translated keys in autoTranslateNightcord: ${matches.length}`);
