"""Compute every number and chart series used in the report page.

Input:   data/plays.csv, data/games.csv   (run clean_data.py first)
Output:  data/findings.json               (read by js/report.js to draw the charts)
         Also prints each finding so the numbers in index.html can be checked.

All numbers use regular-season games only (season_type == "REG").

Definitions:
  4th-down go rate     = go attempts / (go + punts + field goal tries) on 4th down
  4th-down conversion  = a go attempt that gains at least the yards needed, or scores
  "choice" 4th down    = 4th and 2 or less, quarters 1-3, score within 7 points
                         (situations where the coach is not forced to go for it)
  pass rate            = pass plays / (pass + run plays)
  EPA per play         = average expected points added (nflverse model)
  success rate         = share of plays with positive EPA
  win %                = wins / games, a tie counts as half a win
  home win %           = home wins / games that did not end in a tie
  kickoff return rate  = kickoffs where a returner fielded the ball / all kickoffs

Usage:  python scripts/analyze.py
"""

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def pct(x, digits=1):
    return round(float(x) * 100, digits)


def by_season(series, digits=1, scale=100):
    return {int(k): round(float(v) * scale, digits) for k, v in series.items()}


def team_win_pct(games):
    rows = []
    for side in ["home", "away"]:
        t = games[["season", f"{side}_team", "winner"]].rename(columns={f"{side}_team": "team"})
        t["w"] = (t.winner == side) + 0.5 * (t.winner == "tie")
        rows.append(t)
    return pd.concat(rows).groupby(["season", "team"]).w.mean().rename("win_pct").reset_index()


def main():
    plays = pd.read_csv(DATA / "plays.csv", low_memory=False)
    games = pd.read_csv(DATA / "games.csv")
    reg = plays[plays.season_type == "REG"]
    reg_games = games[games.season_type == "REG"]
    seasons = sorted(reg.season.unique().tolist())
    out = {"seasons": [int(s) for s in seasons]}

    # 1. Coaches go for it more often
    fourth = reg[reg.fourth_down_decision.notna()]
    is_go = fourth.fourth_down_decision == "go"
    short = fourth[fourth.ydstogo <= 2]
    out["go_rate"] = {
        "all": by_season(is_go.groupby(fourth.season).mean()),
        "short": by_season((short.fourth_down_decision == "go").groupby(short.season).mean()),
        "attempts": {int(k): int(v) for k, v in is_go.groupby(fourth.season).sum().items()},
    }

    # 2. Going for it works more often than not
    go = fourth[is_go].copy()
    go["converted"] = ((go.yards_gained >= go.ydstogo) | (go.touchdown == 1)).astype(int)
    dist = pd.cut(go.ydstogo, [0, 1, 2, 5, 10, 99], labels=["1", "2", "3-5", "6-10", "11+"])
    conv_by_dist = go.groupby(dist, observed=True).converted.agg(["mean", "size"])
    out["conversion"] = {
        "overall": pct(go.converted.mean()),
        "by_season": by_season(go.groupby("season").converted.mean()),
        "by_distance": {k: {"rate": pct(v["mean"]), "attempts": int(v["size"])}
                        for k, v in conv_by_dist.iterrows()},
        "epa_by_decision": {k: round(float(v), 3) for k, v in
                            fourth.groupby("fourth_down_decision").epa.mean().items()},
    }

    # 3. The most aggressive teams
    team_season = (fourth.assign(go=is_go).groupby(["season", "offense"])
                   .agg(go_rate=("go", "mean"), attempts=("go", "sum")).reset_index())
    top = team_season.sort_values("go_rate", ascending=False).head(10)
    team_all = fourth.assign(go=is_go).groupby("offense").go.mean().sort_values(ascending=False)
    out["aggressive"] = {
        "top_team_seasons": [{"team": r.offense, "season": int(r.season),
                              "go_rate": pct(r.go_rate), "attempts": int(r.attempts)}
                             for r in top.itertuples()],
        "teams_all_years": {k: pct(v) for k, v in team_all.items()},
    }

    # 4. Does aggressiveness win? Raw vs. "choice" situations
    wins = team_win_pct(reg_games)
    raw = team_season.merge(wins, left_on=["season", "offense"], right_on=["season", "team"])
    choice = fourth[(fourth.ydstogo <= 2) & (fourth.qtr <= 3) & (fourth.score_differential.abs() <= 7)]
    choice_ts = (choice.assign(go=choice.fourth_down_decision == "go")
                 .groupby(["season", "offense"]).go.mean().rename("choice_go").reset_index())
    ch = choice_ts.merge(wins, left_on=["season", "offense"], right_on=["season", "team"])
    labels = ["Least aggressive", "2nd", "3rd", "Most aggressive"]
    raw["q"] = pd.qcut(raw.go_rate, 4, labels=labels)
    ch["q"] = pd.qcut(ch.choice_go, 4, labels=labels)
    out["win"] = {
        "labels": labels,
        "all_4th_downs": [pct(v) for v in raw.groupby("q", observed=True).win_pct.mean()],
        "choice_4th_downs": [pct(v) for v in ch.groupby("q", observed=True).win_pct.mean()],
        "choice_go_rate": [pct(v) for v in ch.groupby("q", observed=True).choice_go.mean()],
        "team_seasons": int(len(ch)),
    }

    # 5. Passing still pays more, but the gap is closing
    scrim = reg[reg.play_type.isin(["pass", "run"])]
    epa = scrim.groupby(["season", "play_type"]).epa.mean().unstack()
    succ = scrim.groupby(["season", "play_type"]).success.mean().unstack()
    out["pass_run"] = {
        "epa_pass": by_season(epa["pass"], 3, 1),
        "epa_run": by_season(epa["run"], 3, 1),
        "success_pass": by_season(succ["pass"]),
        "success_run": by_season(succ["run"]),
        "pass_rate": by_season((scrim.play_type == "pass").groupby(scrim.season).mean()),
    }

    # 6. Two-point tries vs. extra points
    two = reg[reg.play_type == "two_point"]
    xp = reg[reg.play_type == "extra_point"]
    two_rate = two.groupby("season").two_point_success.mean()
    xp_rate = xp.groupby("season").xp_made.mean()
    out["two_point"] = {
        "success": by_season(two_rate),
        "attempts": {int(k): int(v) for k, v in two.groupby("season").size().items()},
        "xp_made": by_season(xp_rate),
        "points_two": by_season(two_rate * 2, 2, 1),
        "points_xp": by_season(xp_rate, 2, 1),
        "overall_two": pct(two.two_point_success.mean()),
        "overall_xp": pct(xp.xp_made.mean()),
    }

    # 7. Kickers made long field goals a weapon
    fg = reg[reg.play_type == "field_goal"]
    long = fg[fg.kick_distance >= 50]
    out["kicking"] = {
        "long_attempts": {int(k): int(v) for k, v in long.groupby("season").size().items()},
        "long_made": by_season(long.groupby("season").fg_made.mean()),
        "under40_made": by_season(fg[fg.kick_distance < 40].groupby("season").fg_made.mean()),
        "40s_made": by_season(fg[fg.kick_distance.between(40, 49)].groupby("season").fg_made.mean()),
    }

    # 8. The kickoff came back to life
    ko = reg[reg.play_type == "kickoff"]
    out["kickoff"] = {
        "return_rate": by_season(ko.groupby("season").kickoff_returned.mean()),
        "touchback_rate": by_season(ko.groupby("season").touchback.mean()),
    }

    # 9. Home-field advantage is shrinking
    decided = reg_games[reg_games.winner != "tie"]
    out["home"] = {
        "win_pct": by_season((decided.winner == "home").groupby(decided.season).mean()),
        "margin": by_season(reg_games.groupby("season").home_margin.mean(), 2, 1),
        "first3": pct((decided[decided.season <= 2018].winner == "home").mean()),
        "last3": pct((decided[decided.season >= 2023].winner == "home").mean()),
    }

    # Headline numbers
    out["headline"] = {
        "plays": int(len(plays)),
        "reg_plays": int(len(reg)),
        "games": int(len(games)),
        "go_rate_first": out["go_rate"]["all"][seasons[0]],
        "go_rate_last": out["go_rate"]["all"][seasons[-1]],
        "short_go_last": out["go_rate"]["short"][seasons[-1]],
        "conversion": out["conversion"]["overall"],
        "return_rate_last": out["kickoff"]["return_rate"][seasons[-1]],
    }

    (DATA / "findings.json").write_text(json.dumps(out, indent=1))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
