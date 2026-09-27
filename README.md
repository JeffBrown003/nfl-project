# Playing the Odds: How NFL Coaches Learned to Take Risks

A data website built from every NFL play from 2016 to 2025 (419,148 plays, 2,761 games).

- **Live site:** https://jeffbrown003.github.io/nfl-project/
- **Report** (`index.html`): nine findings on fourth downs, run vs. pass, two-point tries, kickers, kickoffs and home-field advantage, each with its numbers and a chart.
- **Dashboard** (`dashboard.html`): filter the plays by season, season type, team, play type, down, quarter and home/away, switch the measure and breakdown, and see the numbers, four charts and a table update.
- **Matchups** (`matchups.html`): head-to-head history for any two teams (record, win %, margins, every game) and a 32 x 32 grid of every team against every team.
- **Music**: an original stadium beat generated live in the browser with the Web Audio API (no audio files), switched on and off from the navigation bar.

Author: Jeff Brown, Financial Data Analytics.

## Data source

Play-by-play data comes from **nflverse** (https://github.com/nflverse/nflverse-data/releases/tag/pbp), a free public project that publishes official NFL play-by-play data along with expected points added (EPA) and other measures. One file per season was downloaded for 2016 through 2025 (484,254 rows, 372 columns in total).

One row in the cleaned data is **one play**. The cleaning script drops no-plays (penalties), non-plays (timeouts, end of quarter), kneel-downs and spikes, and a handful of rows with no offense or EPA value, leaving 419,148 plays. The report uses regular-season games only; the full definitions of every rate are on the report page under "About the data" and at the top of `scripts/analyze.py`.

## Files

| File | What it does |
|---|---|
| `index.html` | The report page: summary, headline numbers, nine findings with charts, and the data explanation. |
| `dashboard.html` | The dashboard page: filters, measure and breakdown switches, summary numbers, four charts, a data table and a reset button. |
| `matchups.html` | The matchups page: pick two teams to see their head-to-head record, win %, margin chart, season form and every game, plus the league-wide grid. |
| `css/style.css` | Shared fonts, colors, navigation bar, slide backgrounds and layout for all pages. |
| `js/common.js` | Shared chart colors, Chart.js defaults and number formatting. |
| `js/report.js` | Draws the report charts from `data/findings.json`. |
| `js/effects.js` | Shared page effects: scroll progress bar, reveal-on-scroll, count-up numbers, and drawing charts when they scroll into view. Turned off for readers who set "reduce motion". |
| `js/music.js` | The on/off stadium beat, synthesized with the Web Audio API (drums, bass and brass made from oscillators and noise). |
| `js/matchups.js` | Loads `data/matchups.json` and draws the matchups page. |
| `js/dashboard.js` | Loads `data/dashboard.json`, applies the filters in the browser and redraws the numbers, charts and table. |
| `scripts/download_data.py` | Downloads the raw nflverse play-by-play files (2016-2025) into `data/raw/`. |
| `scripts/clean_data.py` | Cleans the raw files into `data/plays.csv` and `data/games.csv`, and documents which rows are dropped and why. |
| `scripts/analyze.py` | Computes every number and chart series in the report and saves them to `data/findings.json`. |
| `scripts/build_dashboard_data.py` | Packs `data/plays.csv` into the compact `data/dashboard.json` the dashboard loads (no rows removed). |
| `scripts/build_matchup_data.py` | Builds `data/matchups.json` (every game plus team names, divisions and colors) for the matchups page. |
| `data/plays.csv` | Cleaned data set: one row per play, 419,148 rows, 28 columns. |
| `data/games.csv` | One row per game (2,761 games) with teams, coaches, final score and winner. |
| `data/findings.json` | Output of `analyze.py`: the report's numbers and chart data. |
| `data/dashboard.json` | Output of `build_dashboard_data.py`: the dashboard's data. |
| `data/teams.csv` | Team names, divisions and colors from nflverse. |
| `data/matchups.json` | Output of `build_matchup_data.py`: the matchups page's data. |
| `requirements.txt` | Python package needed to run the scripts (pandas). |
| `.gitignore` | Keeps the raw downloads (`data/raw/`, about 180 MB) and the Python environment out of the repository. |

## Reproducing the numbers

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/download_data.py
.venv/bin/python scripts/clean_data.py
.venv/bin/python scripts/analyze.py
.venv/bin/python scripts/build_dashboard_data.py
.venv/bin/python scripts/build_matchup_data.py
```

To view the site locally, run `python3 -m http.server` in this folder and open http://localhost:8000.

## Tools

The site is plain HTML, CSS and JavaScript with [Chart.js](https://www.chartjs.org/) for charts. It was built with the help of Claude Code.
