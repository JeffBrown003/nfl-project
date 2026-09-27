"""Build the data file for the Matchups page (team vs. team history).

Input:   data/games.csv, data/teams.csv
Output:  data/matchups.json

Keeps every game from 2016-2025 (regular season and playoffs) with the two teams,
the final score and the week, plus each team's name, division and colors.
Old team codes (OAK, SD, STL) do not appear: nflverse already uses the current
codes (LV, LAC, LA) for every season.

Usage:  python scripts/build_matchup_data.py
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def main():
    games = pd.read_csv(DATA / "games.csv")
    teams = pd.read_csv(DATA / "teams.csv")
    used = sorted(set(games.home_team) | set(games.away_team))
    teams = teams[teams.team_abbr.isin(used)].set_index("team_abbr").loc[used]

    out = {
        "teams": [
            {"abbr": abbr, "name": r.team_name, "nick": r.team_nick, "conf": r.team_conf,
             "div": r.team_division, "color": r.team_color, "color2": r.team_color2}
            for abbr, r in teams.iterrows()
        ],
        # one row per game: [season, week, post (0/1), home, away, home_score, away_score]
        "fields": ["season", "week", "post", "home", "away", "home_score", "away_score"],
        "games": [
            [int(g.season), int(g.week), int(g.season_type == "POST"), g.home_team, g.away_team,
             int(g.home_score), int(g.away_score)]
            for g in games.itertuples()
        ],
    }
    path = DATA / "matchups.json"
    path.write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote {path.relative_to(ROOT)} ({len(out['games']):,} games, {len(out['teams'])} teams)")


if __name__ == "__main__":
    main()
