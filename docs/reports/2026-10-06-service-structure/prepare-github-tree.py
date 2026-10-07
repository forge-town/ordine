"""Prepare a reviewed, committed Git tree for upload through the GitHub connector.

This helper does not contact GitHub or change refs. Generated payloads stay local.
"""
import json
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
report = root / "docs/reports/2026-10-06-service-structure"
payload = report / "github-tree-payload.json"

if len(sys.argv) > 1 and sys.argv[1] == "chunk":
    offset = int(sys.argv[2])
    print(json.dumps(payload.read_text()[offset:offset + 4000], ensure_ascii=False))
    raise SystemExit(0)

def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)

def tree(ref):
    entries = {}
    for record in git("ls-tree", "-r", "-z", ref).split(b"\0"):
        if not record:
            continue
        metadata, name = record.split(b"\t", 1)
        mode, kind, sha = metadata.decode().split()
        entries[name.decode()] = {"mode": mode, "type": kind, "sha": sha}
    return entries

base = json.loads((report / "baseline-inventory.json").read_text())["base"]
head = git("rev-parse", "HEAD").decode().strip()
before, after = tree(base), tree(head)
base_blobs = {entry["sha"] for entry in before.values() if entry["type"] == "blob"}
changed = [path.decode() for path in git("diff", "--name-only", "-z", base, head).split(b"\0") if path]
elements = []
for path in changed:
    if path not in after:
        elements.append({"path": path, "mode": before[path]["mode"], "type": before[path]["type"], "sha": None})
        continue
    entry = after[path]
    if entry["type"] != "blob":
        raise RuntimeError(f"Unexpected non-blob change: {path}")
    element = {"path": path, "mode": entry["mode"], "type": "blob"}
    if entry["sha"] in base_blobs:
        element["sha"] = entry["sha"]
    else:
        element["content"] = git("cat-file", "blob", entry["sha"]).decode("utf8")
    elements.append(element)

data = {"base": base, "head": head, "tree": git("rev-parse", "HEAD^{tree}").decode().strip(), "elements": elements}
encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
payload.write_text(encoded)
print(json.dumps({"base": base, "head": head, "tree": data["tree"], "elements": len(elements), "characters": len(encoded), "chunkSize": 4000}))
