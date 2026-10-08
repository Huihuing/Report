export const SHA256_HEX = /^[0-9a-f]{64}$/;

export function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object") {
    return ["manifest가 객체가 아닙니다."];
  }
  if (!Array.isArray(manifest.files)) {
    return ["manifest.files 배열이 없습니다."];
  }
  if (manifest.self_excluded && manifest.files.some((item) => item && typeof item === "object" && item.path === manifest.self_excluded)) {
    errors.push("self_excluded 파일이 files 목록에 포함되어 있습니다.");
  }

  manifest.files.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push((index + 1) + "번째 파일 항목이 객체가 아닙니다.");
      return;
    }
    if (!item || typeof item.path !== "string" || !item.path) {
      errors.push((index + 1) + "번째 path가 잘못되었습니다.");
    }
    if (!Number.isInteger(item.bytes) || item.bytes < 0) {
      errors.push((index + 1) + "번째 bytes가 잘못되었습니다.");
    }
    if (typeof item.sha256 !== "string" || !SHA256_HEX.test(item.sha256)) {
      errors.push((index + 1) + "번째 sha256이 64자리 소문자 hex가 아닙니다.");
    }
  });
  return errors;
}

export async function sha256Bytes(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function browserFetchBytes(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    const error = new Error("HTTP " + response.status);
    error.code = response.status === 404 ? "MISSING" : "FETCH_ERROR";
    throw error;
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function verifyManifestPackage(manifest, options = {}) {
  const manifestErrors = validateManifest(manifest);
  if (manifestErrors.length) {
    return {
      status: "MANIFEST_ERROR",
      total: Array.isArray(manifest && manifest.files) ? manifest.files.length : 0,
      pass: 0,
      fail: manifestErrors.length,
      manifest_errors: manifestErrors,
      results: []
    };
  }

  const fetchFile = options.fetchFile || browserFetchBytes;
  const hashBytes = options.hashBytes || sha256Bytes;
  const baseUrl = options.baseUrl || "";
  const results = [];

  for (const item of manifest.files) {
    try {
      const bytes = await fetchFile(baseUrl + item.path, item);
      const byteLength = bytes.byteLength;
      if (byteLength !== item.bytes) {
        results.push({
          path: item.path,
          status: "BYTES_MISMATCH",
          expected_bytes: item.bytes,
          actual_bytes: byteLength,
          expected_sha256: item.sha256,
          actual_sha256: null
        });
        continue;
      }

      const actualHash = await hashBytes(bytes);
      results.push({
        path: item.path,
        status: actualHash === item.sha256 ? "PASS" : "SHA_MISMATCH",
        expected_bytes: item.bytes,
        actual_bytes: byteLength,
        expected_sha256: item.sha256,
        actual_sha256: actualHash
      });
    } catch (error) {
      results.push({
        path: item.path,
        status: error && error.code === "MISSING" ? "MISSING" : "FETCH_ERROR",
        expected_bytes: item.bytes,
        actual_bytes: null,
        expected_sha256: item.sha256,
        actual_sha256: null
      });
    }
  }

  const pass = results.filter((item) => item.status === "PASS").length;
  const fail = results.length - pass;
  return {
    status: fail === 0 ? "PASS" : "FAIL",
    total: results.length,
    pass,
    fail,
    manifest_errors: [],
    results
  };
}
