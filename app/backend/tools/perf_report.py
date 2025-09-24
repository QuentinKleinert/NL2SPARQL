import json, sys, statistics
from collections import defaultdict

f = sys.argv[1] if len(sys.argv) > 1 else "app/backend/logs/perf.jsonl"
rows = []
with open(f, "r", encoding="utf-8") as fh:
    for line in fh:
        try:
            rows.append(json.loads(line))
        except Exception:
            pass

groups = defaultdict(list)
for r in rows:
    key = (r.get("kind"), r.get("path") or r.get("op"))
    if "dur_ms" in r:
        groups[key].append(r["dur_ms"])

def pct(a, p):
    a = sorted(a)
    k = int(round((p/100.0)*(len(a)-1)))
    return a[k]

for (kind, name), vals in sorted(groups.items()):
    if not vals: continue
    print(f"{kind:6s} {str(name):30s} n={len(vals):4d}  "
          f"p50={pct(vals,50):6.1f}ms  p95={pct(vals,95):6.1f}ms  max={max(vals):6.1f}ms")
