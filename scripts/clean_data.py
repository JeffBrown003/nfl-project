"""Clean the raw nflverse play-by-play files into two tidy CSVs.

Input:   data/raw/play_by_play_<season>.csv.gz   (run download_data.py first)
Outputs: data/plays.csv   one row per play (the main data set)
         data/games.csv   one row per game (used for home-field and win numbers)

Which rows are dropped and why:
  * play_type "no_play"  - a penalty wiped the play out, so nothing counted
  * play_type missing    - timeouts, end of quarter, two-minute warning (not plays)
  * qb_kneel / qb_spike  - clock-management snaps, not real attempts to gain yards
  * rows with no offense team or no EPA value (a handful of broken rows)

Usage:  python scripts/clean_data.py
"""

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data"

SEASONS = range(2016, 2026)
KEEP_PLAY_TYPES = ["pass", "run", "punt", "field_goal", "extra_point", "kickoff"]

RAW_COLUMNS = [
    "game_id", "season", "season_type", "week", "home_team", "away_team",
    "posteam", "defteam", "home_coach", "away_coach", "roof",
    "qtr", "down", "ydstogo", "yardline_100", "score_differential",
    "play_type", "yards_gained", "epa", "success", "touchdown",
    "interception", "fumble_lost", "sack", "two_point_attempt",
    "two_point_conv_result", "field_goal_result", "extra_point_result",
    "kick_distance", "touchback", "kickoff_returner_player_id",
    "home_score", "away_score", "result",
]


def load_raw():
    frames = []
    for season in SEASONS:
        path = RAW_DIR / f"play_by_play_{season}.csv.gz"
        print(f"reading {path.name}")
        frames.append(pd.read_csv(path, usecols=RAW_COLUMNS, low_memory=False))
    return pd.concat(frames, ignore_index=True)


def build_games(raw):
    games = (
        raw.drop_duplicates("game_id")
        [["game_id", "season", "season_type", "week", "home_team", "away_team",
          "home_coach", "away_coach", "roof", "home_score", "away_score", "result"]]
        .rename(columns={"result": "home_margin"})
        .sort_values(["season", "week", "game_id"])
    )
    games["winner"] = "tie"
    games.loc[games.home_margin > 0, "winner"] = "home"
    games.loc[games.home_margin < 0, "winner"] = "away"
    return games


def build_plays(raw):
    n_start = len(raw)
    plays = raw[raw.play_type.isin(KEEP_PLAY_TYPES)]
    plays = plays.dropna(subset=["posteam", "epa"]).copy()
    print(f"kept {len(plays):,} of {n_start:,} rows ({n_start - len(plays):,} dropped)")

    plays["home_away"] = (plays.posteam == plays.home_team).map({True: "home", False: "away"})
    plays["coach"] = plays.home_coach.where(plays.home_away == "home", plays.away_coach)
    plays["turnover"] = ((plays.interception == 1) | (plays.fumble_lost == 1)).astype(int)
    plays["roof"] = plays.roof.map(
        {"outdoors": "outdoor", "open": "outdoor", "dome": "indoor", "closed": "indoor"}
    )

    # Two-point tries are logged as pass/run with no down; give them their own type.
    is_two_point = plays.two_point_attempt == 1
    plays.loc[is_two_point, "play_type"] = "two_point"
    plays["two_point_success"] = (plays.two_point_conv_result == "success").astype(int)
    plays.loc[~is_two_point, "two_point_success"] = pd.NA

    # 4th-down decision: went for it (pass/run), punted, or kicked a field goal.
    fourth = plays.down == 4
    plays["fourth_down_decision"] = pd.NA
    plays.loc[fourth & plays.play_type.isin(["pass", "run"]), "fourth_down_decision"] = "go"
    plays.loc[fourth & (plays.play_type == "punt"), "fourth_down_decision"] = "punt"
    plays.loc[fourth & (plays.play_type == "field_goal"), "fourth_down_decision"] = "field_goal"

    plays["fg_made"] = pd.NA
    fg = plays.play_type == "field_goal"
    plays.loc[fg, "fg_made"] = (plays.loc[fg, "field_goal_result"] == "made").astype(int)
    plays.loc[~fg, "kick_distance"] = pd.NA

    ko = plays.play_type == "kickoff"
    plays["kickoff_returned"] = pd.NA
    plays.loc[ko, "kickoff_returned"] = plays.loc[ko, "kickoff_returner_player_id"].notna().astype(int)
    plays.loc[~ko, "touchback"] = pd.NA

    plays["epa"] = plays.epa.round(3)

    columns = [
        "game_id", "season", "season_type", "week", "posteam", "defteam",
        "home_away", "coach", "roof", "qtr", "down", "ydstogo", "yardline_100",
        "score_differential", "play_type", "fourth_down_decision", "yards_gained",
        "epa", "success", "touchdown", "turnover", "sack", "two_point_success",
        "kick_distance", "fg_made", "kickoff_returned", "touchback",
    ]
    plays = plays[columns]
    int_cols = ["qtr", "down", "ydstogo", "yardline_100", "score_differential",
                "yards_gained", "success", "touchdown", "sack", "two_point_success",
                "kick_distance", "fg_made", "kickoff_returned", "touchback"]
    plays[int_cols] = plays[int_cols].astype("Int64")
    return plays.rename(columns={"posteam": "offense", "defteam": "defense"})


def main():
    raw = load_raw()
    games = build_games(raw)
    plays = build_plays(raw)
    games.to_csv(OUT_DIR / "games.csv", index=False)
    plays.to_csv(OUT_DIR / "plays.csv", index=False)
    print(f"wrote data/games.csv ({len(games):,} rows)")
    print(f"wrote data/plays.csv ({len(plays):,} rows, {plays.shape[1]} columns)")


if __name__ == "__main__":
    main()
