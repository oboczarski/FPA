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
rows = list(csv.DictReader((ROOT / "DH-FPA/data/FPAv2.csv").open(encoding="utf-8-sig", newline="")))
offenses = {row['TM']: {pos: Decimal(row[pos + 'x']) if row[pos + 'x'] else None for pos in POSITIONS}
            for row in csv.DictReader((ROOT / "DH-FPA/data/TSUMS.csv").open(encoding="utf-8-sig", newline=""))}
games = defaultdict(lambda: {"points": {}, "venue": None})
for row in rows:
    if row["VS"] == "NA":
        continue
    defense = row["VS"].split()[-1]
    key = (defense, int(row["WEEK"]))
    game = games[key]
    game["offense"] = row["TM"]
    game["venue"] = "home" if row["VS"].startswith("@") else "away"
    game["points"][row["POS"]] = game["points"].get(row["POS"], 0) + int(Decimal(row["FPT_PPR"]) * 100)
for game in games.values():
    game["points"]["ALL"] = sum(game["points"].values()) if all(pos in game["points"] for pos in POSITIONS[:-1]) else None

scopes = [{"from": start, "to": end, "venue": venue} for start, end in [(1, 3), (2, 3), (1, 1), (2, 2), (3, 3), (1, 2)] for venue in ["all", "home", "away"]]
node = os.environ.get("FPA_NODE", "node")
program = "const fs=require('node:fs');const D=require('./DH-FPA/data-model.js');const m=D.readSource(fs.readFileSync('./DH-FPA/data/FPAv2.csv','utf8'));const o=D.readOffenses(fs.readFileSync('./DH-FPA/data/TSUMS.csv','utf8'));const scopes=JSON.parse(process.argv[1]);console.log(JSON.stringify(scopes.map(s=>{const c=D.expectedMatchups(m,o,s),a=c.actual;return {rows:a.rows,league:a.league,pools:a.pools,expected:c.rows}})));"
actual = json.loads(subprocess.check_output([node, "-e", program, json.dumps(scopes)], cwd=ROOT, text=True))
defenses = sorted({defense for defense, week in games})
checked = 0
for scope, output in zip(scopes, actual):
    selected = {(defense, week): game for (defense, week), game in games.items() if scope["from"] <= week <= scope["to"] and (scope["venue"] == "all" or game["venue"] == scope["venue"])}
    by_team = {row["team"]: row for row in output["rows"]}
    comparisons = {row["team"]: row for row in output["expected"]}
    for pos in POSITIONS:
        expectations = {}
        for defense in defenses:
            eligible = [game["points"][pos] for (team, week), game in selected.items() if team == defense and game["points"].get(pos) is not None]
            expectations[defense] = (sum(eligible), len(eligible), Fraction(sum(eligible), 100 * len(eligible)) if eligible else None)
        ranked = sorted((avg, defense) for defense, (total, sample, avg) in expectations.items() if avg is not None)
        ranks = {defense: 1 + sum(other < avg for other, team in ranked) for avg, defense in ranked}
        expected_totals = {}
        for defense in defenses:
            eligible = [game for (team, week), game in selected.items() if team == defense and game["points"].get(pos) is not None]
            baselines = [offenses.get(game['offense'], {}).get(pos) for game in eligible]
            expected_totals[defense] = sum(baselines, Decimal(0)) if baselines and all(value is not None for value in baselines) else None
        comparable = {team: total for team, total in expected_totals.items() if total is not None}
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
            comparison = comparisons[defense]["metrics"][pos]
            expected_total = expected_totals[defense]
            assert comparison['games'] == sample
            if expected_total is None:
                assert comparison['expectedTotal'] is None and comparison['expectedRank'] is None and comparison['actualRank'] is None
            else:
                assert abs(comparison['expectedTotal'] - float(expected_total)) < 1e-9
                assert abs(comparison['expectedAvg'] - float(expected_total) / sample) < 1e-9
                assert abs(comparison['delta'] - float(Decimal(total) / 100 - expected_total)) < 1e-9
                assert comparison['expectedRank'] == 1 + sum(other < expected_total for other in comparable.values())
                assert comparison['actualRank'] == 1 + sum(expectations[team][0] < total for team in comparable)
                assert comparison['pool'] == len(comparable)
        league_games = sum(sample for total, sample, avg in expectations.values())
        league_total = sum(total for total, sample, avg in expectations.values())
        assert output["league"][pos]["games"] == league_games
        expected_avg = league_total / 100 / league_games if league_games else None
        assert expected_avg is None and output["league"][pos]["avg"] is None or expected_avg is not None and abs(output["league"][pos]["avg"] - expected_avg) < 1e-9
        assert output["pools"][pos] == len(ranked)
print(f"Reconciled {checked:,} defense-position cases across {len(scopes)} scopes: actual totals/averages/ranks, expected totals/averages/ranks, comparison deltas, common rank cohorts, and weighted league averages.")
