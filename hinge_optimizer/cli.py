"""Command line entry point.

    python -m hinge_optimizer examples/profile_weak.json
    python -m hinge_optimizer profile.json --format markdown
    python -m hinge_optimizer --example > profile.json
"""

from __future__ import annotations

import argparse
import sys

from .models import ProfileError, load_profile
from .report import RENDERERS
from .scoring import evaluate

EXAMPLE = """{
  "name": "Your name",
  "age": 29,
  "photos": [
    {"kind": "face", "people": 1},
    {"kind": "full_body", "people": 1},
    {"kind": "activity", "people": 1, "note": "bouldering"},
    {"kind": "social", "people": 4},
    {"kind": "travel", "people": 1},
    {"kind": "pet", "people": 1}
  ],
  "prompts": [
    {"prompt": "A shower thought I recently had", "answer": ""},
    {"prompt": "The way to win me over is", "answer": ""},
    {"prompt": "We'll get along if", "answer": ""}
  ],
  "vitals": {
    "work": "",
    "education": "",
    "hometown": "",
    "height": "",
    "location": "",
    "dating_intentions": ""
  }
}
"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hinge-profile-optimizer",
        description="Score a Hinge profile and return a prioritised list of fixes.",
    )
    parser.add_argument("profile", nargs="?", help="path to a profile JSON file")
    parser.add_argument(
        "-f", "--format", choices=sorted(RENDERERS), default="text",
        help="output format (default: text)",
    )
    parser.add_argument(
        "--example", action="store_true",
        help="print a blank profile template and exit",
    )
    parser.add_argument(
        "--fail-under", type=float, metavar="SCORE",
        help="exit with status 1 when the score is below SCORE",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.example:
        print(EXAMPLE, end="")
        return 0

    if not args.profile:
        parser.error("a profile path is required (or use --example)")

    try:
        profile = load_profile(args.profile)
    except FileNotFoundError:
        print(f"error: no such file: {args.profile}", file=sys.stderr)
        return 2
    except ProfileError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    report = evaluate(profile)
    print(RENDERERS[args.format](report))

    if args.fail_under is not None and report.score < args.fail_under:
        return 1
    return 0
