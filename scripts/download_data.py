"""Download NFL play-by-play data (2016-2025) from nflverse.

Source: https://github.com/nflverse/nflverse-data/releases/tag/pbp
Each season is one gzipped CSV with one row per play and about 370 columns.
Files are saved to data/raw/ (not committed to git because of their size).

Usage:  python scripts/download_data.py
"""

from pathlib import Path
from urllib.request import urlretrieve

SEASONS = range(2016, 2026)
URL = "https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{season}.csv.gz"
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for season in SEASONS:
        path = RAW_DIR / f"play_by_play_{season}.csv.gz"
        if path.exists():
            print(f"{season}: already downloaded")
            continue
        print(f"{season}: downloading...")
        urlretrieve(URL.format(season=season), path)
    print("Done.")


if __name__ == "__main__":
    main()
