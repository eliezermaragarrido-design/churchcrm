import { createHash } from "node:crypto";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";

// PPTXGenJS repeats the same background file for every slide. Share identical
// package media through relationships, without changing a single image pixel.
export function deduplicatePresentationMedia(presentation: Uint8Array) {
  const files = unzipSync(presentation);
  const seen = new Map<string, string>();
  const replacements = new Map<string, string>();
  for (const [name, bytes] of Object.entries(files)) {
    if (!/^ppt\/media\/[^/]+$/.test(name)) continue;
    const digest = createHash("sha256").update(bytes).digest("hex");
    const original = seen.get(digest);
    if (original) replacements.set(name.slice("ppt/media/".length), original.slice("ppt/media/".length));
    else seen.set(digest, name);
  }
  for (const name of Object.keys(files)) {
    if (!name.endsWith(".rels")) continue;
    const xml = strFromU8(files[name]).replace(/Target="((?:\.\.\/)*media\/|\/ppt\/media\/)([^"/]+)"/g, (match, prefix: string, filename: string) => replacements.has(filename) ? `Target="${prefix}${replacements.get(filename)}"` : match);
    files[name] = strToU8(xml);
  }
  for (const duplicate of replacements.keys()) delete files["ppt/media/" + duplicate];
  // Remove any per-file content-type declarations for the removed duplicates.
  files["[Content_Types].xml"] = strToU8(strFromU8(files["[Content_Types].xml"]).replace(/<Override\b[^>]*PartName="\/ppt\/media\/([^"/]+)"[^>]*\/>/g, (match, filename: string) => replacements.has(filename) ? "" : match));
  return Buffer.from(zipSync(files, { level: 6 }));
}
