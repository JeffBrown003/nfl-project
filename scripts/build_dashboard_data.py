"""Pack data/plays.csv into a compact file for the dashboard to load in the browser.

Input:   data/plays.csv
Output:  data/dashboard.json

The dashboard needs every play, but a 40 MB CSV is slow to download and parse.
This keeps only the columns the dashboard uses and stores them column by column,
with text values replaced by small integer codes (the code lists are saved in the
same file). No rows are removed, so dashboard numbers match the report exactly.

Usage:  python scripts/build_dashboard_data.py
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

PLAY_TYPES = ["pass", "run", "punt", "field_goal", "extra_point", "kickoff", "two_point"]
DECISIONS = ["go", "punt", "field_goal"]


def codes(series, values):
    lookup = {v: i for i, v in enumerate(values)}
    return series.map(lookup).fillna(-1).astype(int).tolist()


def main():
    p = pd.read_csv(DATA / "plays.csv", low_memory=False)
    teams = sorted(p.offense.unique().tolist())

    out = {
        "teams": teams,
        "play_types": PLAY_TYPES,
        "decisions": DECISIONS,
        "rows": len(p),
        "cols": {
            "season": p.season.tolist(),
            "post": (p.season_type == "POST").astype(int).tolist(),
            "team": codes(p.offense, teams),
            "home": (p.home_away == "home").astype(int).tolist(),
            "qtr": p.qtr.clip(upper=5).astype(int).tolist(),          # 5 = overtime
            "down": p.down.fillna(0).astype(int).tolist(),           # 0 = no down (kicks, 2-pt)
            "dist": p.ydstogo.fillna(0).astype(int).tolist(),
            "ptype": codes(p.play_type, PLAY_TYPES),
            "dec": codes(p.fourth_down_decision, DECISIONS),         # -1 = not a 4th-down decision
            "yds": p.yards_gained.fillna(0).astype(int).tolist(),
            "epa": (p.epa * 1000).round().astype(int).tolist(),      # EPA x 1000
            "succ": p.success.fillna(0).astype(int).tolist(),
            "td": p.touchdown.fillna(0).astype(int).tolist(),
            "to": p.turnover.fillna(0).astype(int).tolist(),
        },
    }
    path = DATA / "dashboard.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1e6:.1f} MB, {len(p):,} plays)")


if __name__ == "__main__":
    main()
