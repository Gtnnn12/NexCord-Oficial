// Utility (throwaway): repairs broken/empty junctions inside node_modules/.pnpm
// caused by an interrupted pnpm install. Not part of the build.
import fs from "fs";
import path from "path";

const base = path.resolve("node_modules/.pnpm");

function candidatesFor(e) {
    const dirForm = e.split("/").join("+");
    return fs.readdirSync(base).filter(d => d === dirForm || d.startsWith(dirForm + "@"));
}

let fixed = 0;
for (let round = 0; round < 10; round++) {
    let anyFix = false;
    for (const dir of fs.readdirSync(base)) {
        const nm = path.join(base, dir, "node_modules");
        let entries;
        try { entries = fs.readdirSync(nm, { withFileTypes: true }); } catch { continue; }
        for (const ent of entries) {
            // Paquete normal: node_modules/<pkg>  — o scoped: node_modules/@org/<pkg>
            const pkgPaths = ent.isDirectory() && ent.name.startsWith("@")
                ? fs.readdirSync(path.join(nm, ent.name), { withFileTypes: true }).map(inner => ({
                    scope: ent.name,
                    name: inner.name,
                    p: path.join(nm, ent.name, inner.name),
                    isDir: inner.isDirectory()
                }))
                : [{ scope: null, name: ent.name, p: path.join(nm, ent.name), isDir: ent.isDirectory() }];

            for (const pkg of pkgPaths) {
                let broken = false;
                try {
                    if (pkg.isDir && fs.readdirSync(pkg.p).length === 0) broken = true;
                } catch { broken = true; }
                if (!broken) continue;

                const relName = pkg.scope ? `${pkg.scope}/${pkg.name}` : pkg.name;
                const c = candidatesFor(relName);
                if (!c.length) continue;

                for (const cand of [...c].reverse()) {
                    const target = path.join(base, cand, "node_modules", relName);
                    try {
                        if (fs.readdirSync(target).length > 0) {
                            try { fs.rmSync(pkg.p, { recursive: true, force: true }); } catch {}
                            fs.symlinkSync(target, pkg.p, "junction");
                            fixed++; anyFix = true; break;
                        }
                    } catch {}
                }
            }
        }
    }
    if (!anyFix) break;
}
console.log("fixed total", fixed);
