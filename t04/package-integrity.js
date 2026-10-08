(function (global) {
  "use strict";

  function isLowerHexSha256(value) {
    return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
  }

  function validateManifest(manifest) {
    if (!manifest || manifest.schema_version !== 1) {
      throw new Error("MANIFEST_SCHEMA");
    }
    if (!Array.isArray(manifest.files) || manifest.files.length !== 17) {
      throw new Error("MANIFEST_FILE_COUNT");
    }
    if (manifest.self_excluded !== "asset-manifest.json") {
      throw new Error("MANIFEST_SELF_EXCLUDED");
    }
    if (manifest.files.some((entry) => entry.path === manifest.self_excluded)) {
      throw new Error("MANIFEST_SELF_LISTED");
    }

    manifest.files.forEach((entry) => {
      if (!entry || typeof entry.path !== "string" || !entry.path) {
        throw new Error("MANIFEST_PATH");
      }
      if (!Number.isInteger(entry.bytes) || entry.bytes < 0) {
        throw new Error("MANIFEST_BYTES");
      }
      if (!isLowerHexSha256(entry.sha256)) {
        throw new Error("MANIFEST_SHA256");
      }
    });

    return manifest.files;
  }

  async function verifyPackage(manifest, loadAsset, digestSha256) {
    const entries = validateManifest(manifest);
    const results = [];

    for (const entry of entries) {
      try {
        const asset = await loadAsset(entry.path);
        const actualSha256 = await digestSha256(asset.bytes);
        const pass = actualSha256 === entry.sha256;

        results.push({
          path: entry.path,
          status: pass ? "PASS" : "SHA_MISMATCH",
          expected_bytes: entry.bytes,
          actual_bytes: asset.bytes.byteLength,
          expected_sha256: entry.sha256,
          actual_sha256: actualSha256
        });
      } catch (error) {
        // AI B handoff: distinguish MISSING vs FETCH_ERROR and add bytes mismatch status.
        results.push({
          path: entry.path,
          status: "ERROR",
          expected_bytes: entry.bytes,
          actual_bytes: null,
          expected_sha256: entry.sha256,
          actual_sha256: null
        });
      }
    }

    const passCount = results.filter((item) => item.status === "PASS").length;
    return {
      total: entries.length,
      pass_count: passCount,
      fail_count: entries.length - passCount,
      overall: passCount === entries.length ? "PASS" : "FAIL",
      results
    };
  }

  global.PackageIntegrity = {
    isLowerHexSha256,
    validateManifest,
    verifyPackage
  };
})(typeof window !== "undefined" ? window : globalThis);
