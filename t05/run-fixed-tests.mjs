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
const fetchGood = async (path) => bytes[path];

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

// A 단계에서는 공개 UI의 이전 결과 제거/재실행 연결을 아직 구현하지 않는다.
result("T05-F10", false, "AI B가 공개 UI 재실행 시 이전 실패 결과 초기화까지 완성해야 함");

for (const item of results) {
  console.log((item.pass ? "PASS" : "FAIL") + " " + item.id + " - " + item.note);
}
const pass = results.filter(x => x.pass).length;
console.log("SUMMARY " + pass + "/10 PASS");
process.exitCode = pass === 10 ? 0 : 1;
