import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateManifest, verifyManifestPackage } from "../t04/package-integrity.mjs";

const fixed = JSON.parse(await readFile(new URL("./fixed-tests.json", import.meta.url), "utf8"));
if (fixed.tests.length !== 10) throw new Error("고정 검사가 10개가 아닙니다.");

const baseManifest = {
  self_excluded: "asset-manifest.json",
  files: [
    { path: "README.md", bytes: 3, sha256: createHash("sha256").update("abc").digest("hex") },
    { path: "public-contract.json", bytes: 3, sha256: createHash("sha256").update("xyz").digest("hex") }
  ]
};
const bytes = {
  "README.md": new TextEncoder().encode("abc"),
  "public-contract.json": new TextEncoder().encode("xyz")
};
const hashBytes = async (input) => createHash("sha256").update(input).digest("hex");

const results = [];
function result(id, pass, note) { results.push({ id, pass, note }); }

result("T05-F01", fixed.improvement.includes("무결성 검사"), "package 검사 기능이 고정됨");
result("T05-F02", fixed.tests.length === 10 && fixed.source_start_sha.length === 40, "고정 테스트 파일 확인");

const manifest17 = {
  self_excluded: "asset-manifest.json",
  files: Array.from({ length: 17 }, (_, i) => ({
    path: "f" + i,
    bytes: 1,
    sha256: createHash("sha256").update(String.fromCharCode(65 + i)).digest("hex")
  }))
};
const fetch17 = async (path) => new TextEncoder().encode(String.fromCharCode(65 + Number(path.slice(1))));
const all17 = await verifyManifestPackage(manifest17, { fetchFile: fetch17, hashBytes });
result("T05-F03", all17.total === 17 && all17.pass === 17 && all17.fail === 0 && all17.status === "PASS", JSON.stringify(all17));

const changed = await verifyManifestPackage(baseManifest, {
  fetchFile: async (path) => path === "README.md" ? new TextEncoder().encode("abd") : bytes[path],
  hashBytes
});
result("T05-F04", changed.results.find(x => x.path === "README.md")?.status === "SHA_MISMATCH", JSON.stringify(changed));

const missing = await verifyManifestPackage(baseManifest, {
  fetchFile: async (path) => {
    if (path === "README.md") { const e = new Error("404"); e.code = "MISSING"; throw e; }
    return bytes[path];
  },
  hashBytes
});
result("T05-F05", missing.results.find(x => x.path === "README.md")?.status === "MISSING" && missing.status === "FAIL", JSON.stringify(missing));

const wrongBytes = await verifyManifestPackage(baseManifest, {
  fetchFile: async (path) => path === "README.md" ? new TextEncoder().encode("abcd") : bytes[path],
  hashBytes
});
result("T05-F06", wrongBytes.results.find(x => x.path === "README.md")?.status === "BYTES_MISMATCH", JSON.stringify(wrongBytes));

result("T05-F07", validateManifest(baseManifest).length === 0 && !baseManifest.files.some(x => x.path === baseManifest.self_excluded), "self_excluded 미포함");

const badHash = structuredClone(baseManifest);
badHash.files[0].sha256 = "ABC";
result("T05-F08", validateManifest(badHash).some(x => x.includes("64자리 소문자 hex")), JSON.stringify(validateManifest(badHash)));

const fetchError = await verifyManifestPackage(baseManifest, {
  fetchFile: async (path) => {
    if (path === "README.md") throw new Error("network");
    return bytes[path];
  },
  hashBytes
});
result("T05-F09",
  fetchError.results.find(x => x.path === "README.md")?.status === "FETCH_ERROR" &&
  fetchError.results.find(x => x.path === "public-contract.json")?.status === "PASS",
  JSON.stringify(fetchError)
);

const failed17 = await verifyManifestPackage(manifest17, {
  fetchFile: async (path) => path === "f0" ? new TextEncoder().encode("Z") : fetch17(path),
  hashBytes
});
const recovered17 = await verifyManifestPackage(manifest17, { fetchFile: fetch17, hashBytes });
const browserScript = await readFile(new URL("../t04/script.js", import.meta.url), "utf8");
const resetIndex = browserScript.indexOf("hashList.replaceChildren();");
const verificationIndex = browserScript.indexOf("const manifestResponse = await fetch", resetIndex);
result("T05-F10",
  failed17.status === "FAIL" &&
  failed17.results.some(x => x.status !== "PASS") &&
  recovered17.total === 17 &&
  recovered17.pass === 17 &&
  recovered17.fail === 0 &&
  recovered17.status === "PASS" &&
  recovered17.results.every(x => x.status === "PASS") &&
  resetIndex >= 0 &&
  verificationIndex > resetIndex,
  JSON.stringify({ failed: { pass: failed17.pass, fail: failed17.fail }, recovered: { pass: recovered17.pass, fail: recovered17.fail }, ui_reset_before_fetch: resetIndex >= 0 && verificationIndex > resetIndex })
);

for (const item of results) {
  console.log((item.pass ? "PASS" : "FAIL") + " " + item.id + " - " + item.note);
}
const pass = results.filter(x => x.pass).length;
console.log("SUMMARY " + pass + "/10 PASS");
process.exitCode = pass === 10 ? 0 : 1;
