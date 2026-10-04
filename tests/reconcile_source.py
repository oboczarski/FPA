"""Independently verify weekly arithmetic and direct FPFA/FPF field preservation."""
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
with (ROOT / "DH-FPA/data/FPAv2.csv").open(encoding="utf-8-sig", newline="") as file:
    rows = list(csv.DictReader(file))
with (ROOT / "DH-FPA/data/FPFA.csv").open(encoding="utf-8-sig", newline="") as file:
    supplied = list(csv.DictReader(file))
with (ROOT / "DH-FPA/data/FPF.csv").open(encoding="utf-8-sig", newline="") as file:
    offense_rows = [{key.upper(): value for key, value in row.items()} for row in csv.DictReader(file)]
offenses = {row["TM"]: row for row in offense_rows}
assert len(offenses) == 32
assert len(supplied) == len({row["TM"] for row in supplied}) == 32
summaries = {row["TM"]: row for row in supplied}
games = defaultdict(lambda: {"points": {}, "venue": None})
for row in rows:
    if row["VS"] == "NA":
        continue
    defense = row["VS"].split()[-1]
    key = (defense, int(row.get("WEEK", row.get("WK"))))
    game = games[key]
    game["offense"] = row["TM"]
    game["venue"] = "home" if row["VS"].startswith("@") else "away"
    game["points"][row["POS"]] = game["points"].get(row["POS"], 0) + int(Decimal(row["FPT_PPR"]) * 100)
for game in games.values():
    game["points"]["ALL"] = sum(game["points"].values()) if all(pos in game["points"] for pos in POSITIONS[:-1]) else None

scopes = [{"from": start, "to": end, "venue": venue} for start, end in [(1, 3), (2, 3), (1, 1), (2, 2), (3, 3), (1, 2)] for venue in ["all", "home", "away"]]
node = os.environ.get("FPA_NODE", "node")
program = """
const fs = require('node:fs'), D = require('./DH-FPA/data-model.js');
const m = D.readSource(fs.readFileSync('./DH-FPA/data/FPAv2.csv','utf8'));
const s = D.readFPFA(fs.readFileSync('./DH-FPA/data/FPFA.csv','utf8'));
const offenses = D.readOffenses(fs.readFileSync('./DH-FPA/data/FPF.csv','utf8'));
const scopes = JSON.parse(process.argv[1]);
console.log(JSON.stringify(scopes.map(scope => ({
  weekly: D.summarize(m, scope), comparison: D.matchupAnalysis(m, s, scope, offenses)
}))));
"""
outputs = json.loads(subprocess.check_output([node, "-e", program, json.dumps(scopes)], cwd=ROOT, text=True))
defenses = sorted({defense for defense, week in games})
checked = supplied_fields = opponent_links = 0
for scope, output in zip(scopes, outputs):
    selected = {(defense, week): game for (defense, week), game in games.items() if scope["from"] <= week <= scope["to"] and (scope["venue"] == "all" or game["venue"] == scope["venue"])}
    by_team = {row["team"]: row for row in output["weekly"]["rows"]}
    comparisons = {row["team"]: row for row in output["comparison"]["rows"]}
    full_season = scope == {"from": 1, "to": 3, "venue": "all"}
    assert output["comparison"]["summaryAvailable"] == full_season
    for pos in POSITIONS:
        expectations = {}
        for defense in defenses:
            eligible = [game["points"][pos] for (team, week), game in selected.items() if team == defense and game["points"].get(pos) is not None]
            expectations[defense] = (sum(eligible), len(eligible), Fraction(sum(eligible), 100 * len(eligible)) if eligible else None)
        ranked = sorted((avg, defense) for defense, (total, sample, avg) in expectations.items() if avg is not None)
        ranks = {defense: 1 + sum(other < avg for other, team in ranked) for avg, defense in ranked}
        for defense, (total, sample, avg) in expectations.items():
            result = by_team[defense]["metrics"][pos]
            assert result["games"] == sample and result["rank"] == ranks.get(defense), (scope, defense, pos)
            if avg is None:
                assert result["avg"] is None and result["total"] is None
            else:
                assert abs(result["avg"] - float(avg)) < 1e-9, (scope, defense, pos, "average")
                assert abs(result["total"] - total / 100) < 1e-9, (scope, defense, pos, "total")
            checked += 1
            comparison = comparisons[defense]["metrics"][pos]
            if full_season:
                raw = summaries[defense]
                fields = [(comparison["actual"]["total"], pos), (comparison["actual"]["avg"], pos + "x"),
                          (comparison["actualRank"], pos + "rk"), (comparison["expectedTotal"], pos + "vs"),
                          (comparison["expectedAvg"], pos + "vX"), (comparison["expectedRank"], pos + "vRK")]
                for value, field in fields:
                    assert value == float(Decimal(raw[field])), (defense, field, value, raw[field])
                    supplied_fields += 1
                assert abs(comparison["delta"] - float(Decimal(raw[pos]) - Decimal(raw[pos + "vs"]))) < 1e-9
                assert abs(Decimal(raw[pos]) - Decimal(total) / 100) <= Decimal(".05"), (defense, pos, "source rounding")
                assert comparison["actual"]["rankOrder"] == "descending"
            else:
                assert comparison["actual"] == result
                baselines = [Decimal(offenses[game["offense"]][pos + "X"]) for (team, week), game in selected.items() if team == defense and game["points"].get(pos) is not None]
                expected = float(sum(baselines)) if baselines else None
                assert comparison["expectedTotal"] == expected, (scope, defense, pos, "expected total")
                if expected is not None:
                    assert abs(comparison["expectedAvg"] - expected / sample) < 1e-9
                    delta = total / 100 - expected
                    assert abs(comparison["delta"] - delta) < 1e-9
                    assert abs(comparison["deltaPct"] - delta / abs(expected) * 100) < 1e-9 if expected else comparison["deltaPct"] is None
                    cohort = [row["metrics"][pos] for row in comparisons.values() if row["metrics"][pos]["expectedTotal"] is not None and row["metrics"][pos]["actual"]["total"] is not None]
                    assert comparison["expectedRank"] == 1 + sum(other["expectedTotal"] > expected for other in cohort)
                    assert comparison["actualRank"] == 1 + sum(other["actual"]["total"] > total / 100 for other in cohort)
                else:
                    assert comparison["expectedAvg"] is None and comparison["delta"] is None
            for entry in comparison["entries"]:
                original = selected[(defense, entry["week"])]
                assert entry["offense"] == original["offense"] and entry["venue"] == original["venue"]
                assert entry["actual"] == original["points"][pos] / 100
                assert entry["expected"] == float(Decimal(offenses[entry["offense"]][pos + "X"]))
                assert entry["offenseRank"] == int(offenses[entry["offense"]][pos + "RK"])
        league_games = sum(sample for total, sample, avg in expectations.values())
        league_total = sum(total for total, sample, avg in expectations.values())
        assert output["weekly"]["league"][pos]["games"] == league_games
        expected_avg = league_total / 100 / league_games if league_games else None
        assert expected_avg is None and output["weekly"]["league"][pos]["avg"] is None or expected_avg is not None and abs(output["weekly"]["league"][pos]["avg"] - expected_avg) < 1e-9
        assert output["weekly"]["pools"][pos] == len(ranked)
for team, row in summaries.items():
    for week in [1, 2, 3]:
        assert games[(team, week)]["offense"] == row[f"w{week}"]
        opponent_links += 1
print(f"Reconciled {checked:,} weekly defense-position cases across {len(scopes)} scopes, {supplied_fields} supplied FPFA values, and {opponent_links} opponent links. All season totals agree within FPFA rounding; every game baseline and offense rank matches FPF, including filtered comparisons.")
