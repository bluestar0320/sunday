"""Render a Report as plain text or Markdown."""

from __future__ import annotations

import json

from .scoring import Report

_STATUS_TEXT = {"pass": "OK  ", "warn": "WARN", "fail": "FAIL"}
_STATUS_MD = {"pass": "✅", "warn": "⚠️", "fail": "❌"}

WIDTH = 74


def _bar(percent: float, width: int = 24) -> str:
    filled = int(round(percent / 100.0 * width))
    return "█" * filled + "░" * (width - filled)


def render_text(report: Report) -> str:
    profile = report.profile
    who = profile.name or "This profile"
    lines: list[str] = []
    lines.append("=" * WIDTH)
    lines.append(f"  HINGE PROFILE OPTIMIZER — {who}")
    lines.append("=" * WIDTH)
    lines.append("")
    lines.append(f"  Score: {report.score:.1f}/100   Grade: {report.grade}")
    lines.append(f"  {report.verdict}")
    lines.append("")

    lines.append("-" * WIDTH)
    lines.append("  BREAKDOWN")
    lines.append("-" * WIDTH)
    for category in report.categories:
        lines.append(
            f"  {category.label:<14}{_bar(category.percent)} "
            f"{category.earned:>5.1f}/{category.possible:<5.0f}"
        )
    lines.append("")

    lines.append("-" * WIDTH)
    lines.append("  CHECKS")
    lines.append("-" * WIDTH)
    for category in report.categories:
        lines.append(f"  [{category.label}]")
        for result in category.results:
            lines.append(
                f"    {_STATUS_TEXT[result.status]}  {result.title} "
                f"({result.earned:g}/{result.possible:g})"
            )
            lines.append(f"          {result.detail}")
        lines.append("")

    priorities = report.priorities()
    lines.append("-" * WIDTH)
    lines.append("  FIX THESE, IN THIS ORDER")
    lines.append("-" * WIDTH)
    if not priorities:
        lines.append("  Nothing to fix. Every check is at full marks.")
    else:
        for index, result in enumerate(priorities, start=1):
            advice = result.fix or result.detail
            lines.append(f"  {index}. {result.title}  (+{result.lost:g} points)")
            for chunk in _wrap(advice, WIDTH - 6):
                lines.append(f"     {chunk}")
            lines.append("")
    lines.append("=" * WIDTH)
    return "\n".join(lines)


def render_markdown(report: Report) -> str:
    profile = report.profile
    who = profile.name or "This profile"
    lines: list[str] = []
    lines.append(f"# Hinge profile review — {who}")
    lines.append("")
    lines.append(f"**Score: {report.score:.1f}/100 (grade {report.grade})** — {report.verdict}")
    lines.append("")
    lines.append("| Category | Score | Share |")
    lines.append("| --- | --- | --- |")
    for category in report.categories:
        lines.append(
            f"| {category.label} | {category.earned:.1f}/{category.possible:.0f} "
            f"| {category.percent:.0f}% |"
        )
    lines.append("")

    lines.append("## Checks")
    lines.append("")
    for category in report.categories:
        lines.append(f"### {category.label}")
        lines.append("")
        for result in category.results:
            lines.append(
                f"- {_STATUS_MD[result.status]} **{result.title}** "
                f"({result.earned:g}/{result.possible:g}) — {result.detail}"
            )
        lines.append("")

    lines.append("## Fix these, in this order")
    lines.append("")
    priorities = report.priorities()
    if not priorities:
        lines.append("Nothing to fix. Every check is at full marks.")
    else:
        for index, result in enumerate(priorities, start=1):
            lines.append(f"{index}. **{result.title}** (+{result.lost:g} points) — {result.fix or result.detail}")
    lines.append("")
    return "\n".join(lines)


def render_json(report: Report) -> str:
    return json.dumps(report.to_dict(), indent=2, ensure_ascii=False)


def _wrap(value: str, width: int) -> list[str]:
    out: list[str] = []
    line = ""
    for word in value.split():
        if len(line) + len(word) + 1 > width:
            out.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    if line:
        out.append(line)
    return out or [""]


RENDERERS = {"text": render_text, "markdown": render_markdown, "json": render_json}
