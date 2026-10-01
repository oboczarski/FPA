"""Compare every supplied-data summary with independent CSV/Fraction calculations."""
import csv
import json
import os
import subprocess
from collections import defaultdict
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSITIONS = ["QB", "RB", "WR", "TE", "ALL"]
rows = list(csv.DictReader((ROOT / "DH-FPA/data/2026-Wkly - FPA.csv").open(encoding="utf-8-sig", newline="")))
games = defaultdict(lambda: {"points": {}, "venue": None})
for row in rows:
    if row["VS"] == "NA":
        continue
    defense = row["VS"].split()[-1]
    key = (defense, int(row["WEEK"]))
    game = games[key]
    game["venue"] = "home" if row["VS"].startswith("@") else "away"
    game["points"][row["POS"]] = game["points"].get(row["POS"], 0) + int(Decimal(row["FPT_PPR"]) * 100)
for game in games.values():
    game["points"]["ALL"] = sum(game["points"].values()) if all(pos in game["points"] for pos in POSITIONS[:-1]) else None

scopes = [{"from": start, "to": end, "venue": venue} for start, end in [(1, 3), (2, 3), (1, 1), (2, 2), (3, 3), (1, 2)] for venue in ["all", "home", "away"]]
node = os.environ.get("FPA_NODE", "node")
program = "const fs=require('node:fs');const D=require('./DH-FPA/data-model.js');const m=D.readSource(fs.readFileSync('./DH-FPA/data/2026-Wkly - FPA.csv','utf8'));const scopes=JSON.parse(process.argv[1]);console.log(JSON.stringify(scopes.map(s=>{const a=D.summarize(m,s);return {rows:a.rows,league:a.league,pools:a.pools}})));"
actual = json.loads(subprocess.check_output([node, "-e", program, json.dumps(scopes)], cwd=ROOT, text=True))
defenses = sorted({defense for defense, week in games})
checked = 0
for scope, output in zip(scopes, actual):
    selected = {(defense, week): game for (defense, week), game in games.items() if scope["from"] <= week <= scope["to"] and (scope["venue"] == "all" or game["venue"] == scope["venue"])}
    by_team = {row["team"]: row for row in output["rows"]}
    for pos in POSITIONS:
        expectations = {}
        for defense in defenses:
            eligible = [game["points"][pos] for (team, week), game in selected.items() if team == defense and game["points"].get(pos) is not None]
            expectations[defense] = (sum(eligible), len(eligible), Fraction(sum(eligible), 100 * len(eligible)) if eligible else None)
        ranked = sorted((avg, defense) for defense, (total, sample, avg) in expectations.items() if avg is not None)
        ranks = {defense: 1 + sum(other < avg for other, team in ranked) for avg, defense in ranked}
        for defense, (total, sample, avg) in expectations.items():
            result = by_team[defense]["metrics"][pos]
            assert result["games"] == sample, (scope, defense, pos, "games")
            assert result["rank"] == ranks.get(defense), (scope, defense, pos, "rank")
            if avg is None:
                assert result["avg"] is None and result["total"] is None
            else:
                assert abs(result["avg"] - float(avg)) < 1e-9, (scope, defense, pos, "average")
                assert abs(result["total"] - total / 100) < 1e-9, (scope, defense, pos, "total")
            checked += 1
        league_games = sum(sample for total, sample, avg in expectations.values())
        league_total = sum(total for total, sample, avg in expectations.values())
        assert output["league"][pos]["games"] == league_games
        expected_avg = league_total / 100 / league_games if league_games else None
        assert expected_avg is None and output["league"][pos]["avg"] is None or expected_avg is not None and abs(output["league"][pos]["avg"] - expected_avg) < 1e-9
        assert output["pools"][pos] == len(ranked)
print(f"Reconciled {checked:,} defense-position summaries across {len(scopes)} week/venue scopes, including every total, game count, unrounded average, rank, and weighted league average.")
