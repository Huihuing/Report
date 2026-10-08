(function (global) {
  "use strict";

  function isLowerHexSha256(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  }

  function validateManifest(manifest) {
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
      if (typeof item.sha256 !== "string" || !isLowerHexSha256(item.sha256)) {
        errors.push((index + 1) + "번째 sha256이 64자리 소문자 hex가 아닙니다.");
      }
    });
    return errors;
  }

  async function verifyPackage(manifest, loadAsset, digestSha256) {
    const manifestErrors = validateManifest(manifest);
    if (manifestErrors.length) {
      return {
        status: "MANIFEST_ERROR",
        overall: "MANIFEST_ERROR",
        total: Array.isArray(manifest && manifest.files) ? manifest.files.length : 0,
        pass: 0,
        fail: manifestErrors.length,
        pass_count: 0,
        fail_count: manifestErrors.length,
        manifest_errors: manifestErrors,
        results: []
      };
    }

    const entries = manifest.files;
    const results = [];

    for (const entry of entries) {
      try {
        const asset = await loadAsset(entry.path);
        const rawBytes = asset && Object.prototype.hasOwnProperty.call(asset, "bytes") ? asset.bytes : asset;
        const bytes = rawBytes instanceof Uint8Array ? rawBytes : new Uint8Array(rawBytes);
        const byteLength = bytes.byteLength;

        if (byteLength !== entry.bytes) {
          results.push({
            path: entry.path,
            status: "BYTES_MISMATCH",
            expected_bytes: entry.bytes,
            actual_bytes: byteLength,
            expected_sha256: entry.sha256,
            actual_sha256: null
          });
          continue;
        }

        const actualSha256 = await digestSha256(bytes);
        results.push({
          path: entry.path,
          status: actualSha256 === entry.sha256 ? "PASS" : "SHA_MISMATCH",
          expected_bytes: entry.bytes,
          actual_bytes: byteLength,
          expected_sha256: entry.sha256,
          actual_sha256: actualSha256
        });
      } catch (error) {
        results.push({
          path: entry.path,
          status: error && error.code === "MISSING" ? "MISSING" : "FETCH_ERROR",
          expected_bytes: entry.bytes,
          actual_bytes: null,
          expected_sha256: entry.sha256,
          actual_sha256: null
        });
      }
    }

    const passCount = results.filter((item) => item.status === "PASS").length;
    const failCount = results.length - passCount;
    return {
      status: failCount === 0 ? "PASS" : "FAIL",
      overall: failCount === 0 ? "PASS" : "FAIL",
      total: results.length,
      pass: passCount,
      fail: failCount,
      pass_count: passCount,
      fail_count: failCount,
      manifest_errors: [],
      results
    };
  }

  global.PackageIntegrity = {
    isLowerHexSha256,
    validateManifest,
    verifyPackage
  };
})(typeof window !== "undefined" ? window : globalThis);
