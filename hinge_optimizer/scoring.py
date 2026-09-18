"""Run every rule over a profile and collect the results."""

from __future__ import annotations

from dataclasses import dataclass, field

from .models import Profile
from .rules import CATEGORY_ORDER, RuleResult, all_rules

CATEGORY_LABELS = {
    "photos": "Photos",
    "prompts": "Prompts",
    "writing": "Writing",
    "completeness": "Completeness",
}

GRADE_BANDS = (
    (90, "A", "Ready to run. Tune, do not rebuild."),
    (80, "B", "Strong. A couple of fixes away from very strong."),
    (70, "C", "Works, but it is doing less than it could."),
    (60, "D", "The profile is hiding you rather than showing you."),
    (0, "F", "Start over with the fixes below, in order."),
)


@dataclass
class CategoryScore:
    key: str
    label: str
    earned: float
    possible: float
    results: list[RuleResult] = field(default_factory=list)

    @property
    def percent(self) -> float:
        if self.possible == 0:
            return 0.0
        return self.earned / self.possible * 100.0


@dataclass
class Report:
    profile: Profile
    results: list[RuleResult]
    categories: list[CategoryScore]
    score: float

    @property
    def grade(self) -> str:
        return self._band()[1]

    @property
    def verdict(self) -> str:
        return self._band()[2]

    def _band(self) -> tuple[int, str, str]:
        for threshold, grade, verdict in GRADE_BANDS:
            if self.score >= threshold:
                return threshold, grade, verdict
        return GRADE_BANDS[-1]

    def priorities(self, limit: int | None = None) -> list[RuleResult]:
        """Rules that lost points, worst first — the actual to-do list."""
        losing = [r for r in self.results if r.lost > 0]
        losing.sort(key=lambda r: (-r.lost, r.category, r.rule_id))
        return losing[:limit] if limit else losing

    def to_dict(self) -> dict:
        return {
            "name": self.profile.name,
            "score": self.score,
            "grade": self.grade,
            "verdict": self.verdict,
            "categories": [
                {
                    "key": c.key,
                    "label": c.label,
                    "earned": round(c.earned, 2),
                    "possible": round(c.possible, 2),
                    "percent": round(c.percent, 1),
                }
                for c in self.categories
            ],
            "rules": [
                {
                    "id": r.rule_id,
                    "category": r.category,
                    "title": r.title,
                    "status": r.status,
                    "earned": round(r.earned, 2),
                    "possible": round(r.possible, 2),
                    "detail": r.detail,
                    "fix": r.fix,
                }
                for r in self.results
            ],
            "priorities": [r.rule_id for r in self.priorities()],
        }


def evaluate(profile: Profile) -> Report:
    results = [rule(profile) for rule in all_rules()]

    categories: list[CategoryScore] = []
    for key in CATEGORY_ORDER:
        subset = [r for r in results if r.category == key]
        categories.append(
            CategoryScore(
                key=key,
                label=CATEGORY_LABELS.get(key, key.title()),
                earned=sum(r.earned for r in subset),
                possible=sum(r.possible for r in subset),
                results=subset,
            )
        )

    possible = sum(c.possible for c in categories)
    earned = sum(c.earned for c in categories)
    score = round(earned / possible * 100.0, 1) if possible else 0.0
    return Report(profile=profile, results=results, categories=categories, score=score)
