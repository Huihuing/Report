#!/usr/bin/env python3
"""BR-B source-integrity checks, standard library only. Author: limheejae."""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
BRB = ROOT / "brb"
analysis = json.loads((ROOT / "t10/data/analysis.json").read_text(encoding="utf-8"))
script = (BRB / "data/research.js").read_text(encoding="utf-8")
match = re.search(r"window\.BRB_STUDY\s*=\s*(\{.*\});\s*\Z", script, flags=re.S)
assert match, "Research data JS object missing"
study = json.loads(match.group(1))
assert study["author"] == "limheejae"
assert study["raw_row_count"] == analysis["raw_row_count"] == 540
assert study["per_condition_n"] == analysis["per_condition_n"] == 30
assert len(study["cases"]) == len(analysis["cases"]) == 9

for row, expected in zip(study["cases"], analysis["cases"]):
    assert row == expected, (row.get("size"), row.get("position"))
assert {(x["size"], x["position"]) for x in study["cases"]} == {
    (size, position) for size in (100, 1000, 10000) for position in ("absent", "first", "last")
}
assert all(
    (next(c for c in study["cases"] if c["size"] == size and c["position"] == "absent")["list_median_ns"] >
     next(c for c in study["cases"] if c["size"] == size and c["position"] == "absent")["set_median_ns"])
    for size in (100, 1000, 10000)
)

html = (BRB / "index.html").read_text(encoding="utf-8")
app = (BRB / "app.js").read_text(encoding="utf-8")
portfolio = (ROOT / "bra/index.html").read_text(encoding="utf-8")
hub = (ROOT / "index.html").read_text(encoding="utf-8")
assert study["title"] in html, "Exact T10 paper title must appear above fold"
for path in ("./styles.css", "./data/research.js", "./app.js"):
    assert path in html
    assert (BRB / path).is_file()
for key in ("experiment-form", "value-form", "size-select", "position-select", "order-check", "value-input"):
    assert ('id="' + key + '"') in html
assert "../brb/" in portfolio, "BR-A representative link missing"
assert "./brb/" in hub, "T01 hub link missing"
assert "textContent" in app and "Number.isSafeInteger" in app
assert "innerHTML" not in app
assert all(not re.search(pattern, html + app + script, re.I) for pattern in (
    r"sk-[A-Za-z0-9_-]{20,}", r"sb_secret_[A-Za-z0-9_-]{8,}",
    r"AKIA[0-9A-Z]{16}", r"gh[pousr]_[A-Za-z0-9_]{20,}",
))
print("BRB_VERIFY_OK 9 cases; 540 raw blocks; original statistics and app/portfolio links match")
