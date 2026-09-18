"""The scoring rules.

Each rule inspects a Profile and returns a RuleResult worth some share of the
100 available points. Rules are pure functions: no I/O, no randomness.

Weights by category: photos 35, prompts 35, writing 20, completeness 10.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .models import (
    CORE_VITALS,
    MAX_ANSWER_CHARS,
    MAX_PHOTOS,
    REQUIRED_PROMPTS,
    Profile,
)
from . import text as T

PHOTOS = "photos"
PROMPTS = "prompts"
WRITING = "writing"
COMPLETENESS = "completeness"

CATEGORY_ORDER = (PHOTOS, PROMPTS, WRITING, COMPLETENESS)


@dataclass
class RuleResult:
    rule_id: str
    category: str
    title: str
    earned: float
    possible: float
    detail: str
    fix: str = ""

    @property
    def lost(self) -> float:
        return round(self.possible - self.earned, 2)

    @property
    def status(self) -> str:
        if self.earned >= self.possible - 1e-9:
            return "pass"
        if self.earned <= 1e-9:
            return "fail"
        return "warn"


Rule = Callable[[Profile], RuleResult]
_REGISTRY: list[Rule] = []


def rule(func: Rule) -> Rule:
    _REGISTRY.append(func)
    return func


def all_rules() -> list[Rule]:
    return list(_REGISTRY)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


# --------------------------------------------------------------------------
# Photos (35 points)
# --------------------------------------------------------------------------

@rule
def photo_count(profile: Profile) -> RuleResult:
    count = len(profile.photos)
    table = {0: 0.0, 1: 0.0, 2: 1.0, 3: 2.0, 4: 4.0, 5: 6.0}
    earned = table.get(count, 8.0)
    detail = f"{count} photo(s) in the grid."
    fix = ""
    if count > MAX_PHOTOS:
        earned = 6.0
        fix = f"Hinge shows at most {MAX_PHOTOS} photos — trim the weakest ones."
    elif count < MAX_PHOTOS:
        fix = (
            f"Fill all {MAX_PHOTOS} slots. Each empty slot is a question about you "
            "that goes unanswered."
        )
    return RuleResult("photo_count", PHOTOS, "Photo count", earned, 8.0, detail, fix)


@rule
def first_photo(profile: Profile) -> RuleResult:
    possible = 8.0
    if not profile.photos:
        return RuleResult(
            "first_photo", PHOTOS, "Lead photo", 0.0, possible,
            "No photos, so there is no lead photo.",
            "Lead with a clear, well-lit solo shot where your face fills the frame.",
        )
    first = profile.photos[0]
    earned = possible
    problems: list[str] = []
    if first.is_group:
        earned -= 4.0
        problems.append("it has other people in it")
    if not first.face_visible:
        earned -= 3.0
        problems.append("your face is not clearly visible")
    if first.sunglasses:
        earned -= 2.0
        problems.append("you are wearing sunglasses")
    if first.selfie:
        earned -= 1.0
        problems.append("it is a selfie")
    if first.kind not in ("face", "candid", "full_body"):
        earned -= 1.0
        problems.append(f"it is a '{first.kind}' shot rather than a clear portrait")

    earned = _clamp(earned, 0.0, possible)
    if problems:
        detail = "Lead photo: " + ", ".join(problems) + "."
        fix = (
            "Swap slot 1 for a solo, face-forward photo taken by someone else. "
            "It is the only photo most people will actually look at."
        )
    else:
        detail = "Lead photo is a clear solo shot with your face visible."
        fix = ""
    return RuleResult("first_photo", PHOTOS, "Lead photo", earned, possible, detail, fix)


@rule
def photo_variety(profile: Profile) -> RuleResult:
    possible = 7.0
    kinds = {p.kind for p in profile.photos}
    distinct = len(kinds)
    earned = _clamp(distinct / 4.0 * possible, 0.0, possible)
    detail = f"{distinct} distinct photo type(s): {', '.join(sorted(kinds)) or 'none'}."
    fix = ""
    if distinct < 4:
        fix = (
            "Aim for four different kinds of shot (portrait, full body, doing "
            "something, with people). Six versions of the same pose says one thing."
        )
    return RuleResult("photo_variety", PHOTOS, "Photo variety", earned, possible, detail, fix)


@rule
def full_body_photo(profile: Profile) -> RuleResult:
    possible = 4.0
    present = any(p.kind == "full_body" for p in profile.photos)
    return RuleResult(
        "full_body_photo", PHOTOS, "Full-body shot",
        possible if present else 0.0, possible,
        "Full-body photo present." if present else "No full-body photo.",
        "" if present else (
            "Add one full-body photo. Leaving it out is read as hiding something, "
            "and it is the single most common complaint about profiles."
        ),
    )


@rule
def social_proof(profile: Profile) -> RuleResult:
    possible = 3.0
    present = any(p.is_group for p in profile.photos[1:])
    return RuleResult(
        "social_proof", PHOTOS, "Social proof",
        possible if present else 0.0, possible,
        "At least one photo with other people." if present else "Every photo is solo.",
        "" if present else (
            "Add one photo with friends or family (not in slot 1). It shows you "
            "exist in a world with other people in it."
        ),
    )


@rule
def group_photo_overuse(profile: Profile) -> RuleResult:
    possible = 3.0
    if not profile.photos:
        return RuleResult(
            "group_photo_overuse", PHOTOS, "Group photo balance", 0.0, possible,
            "No photos to judge.", "Add photos before this can be scored.",
        )
    groups = [p for p in profile.photos if p.is_group]
    count = len(groups)
    earned = possible if count <= 2 else _clamp(possible - (count - 2) * 1.5, 0.0, possible)
    detail = f"{count} group photo(s)."
    fix = ""
    if count > 2:
        fix = (
            "Keep group photos to two at most. Beyond that, nobody can work out "
            "which person is you, and they will not try."
        )
    return RuleResult(
        "group_photo_overuse", PHOTOS, "Group photo balance", earned, possible, detail, fix
    )


@rule
def selfie_overuse(profile: Profile) -> RuleResult:
    possible = 2.0
    if not profile.photos:
        return RuleResult(
            "selfie_overuse", PHOTOS, "Selfie balance", 0.0, possible,
            "No photos to judge.", "Add photos before this can be scored.",
        )
    count = sum(1 for p in profile.photos if p.selfie or p.kind == "mirror")
    earned = possible if count <= 1 else _clamp(possible - (count - 1), 0.0, possible)
    detail = f"{count} selfie or mirror shot(s)."
    fix = "" if count <= 1 else (
        "Cut down to one selfie or mirror shot. The rest should look like someone "
        "else was there."
    )
    return RuleResult("selfie_overuse", PHOTOS, "Selfie balance", earned, possible, detail, fix)


# --------------------------------------------------------------------------
# Prompts (35 points)
# --------------------------------------------------------------------------

@rule
def prompt_count(profile: Profile) -> RuleResult:
    possible = 8.0
    answered = len(profile.answered_prompts)
    table = {0: 0.0, 1: 1.0, 2: 4.0}
    earned = table.get(answered, possible)
    detail = f"{answered} of {REQUIRED_PROMPTS} prompts answered."
    fix = "" if answered >= REQUIRED_PROMPTS else (
        f"Answer all {REQUIRED_PROMPTS} prompts. Prompts are where replies come "
        "from — photos only get you looked at."
    )
    return RuleResult("prompt_count", PROMPTS, "Prompts answered", earned, possible, detail, fix)


@rule
def answer_length(profile: Profile) -> RuleResult:
    possible = 9.0
    answers = profile.answers
    if not answers:
        return RuleResult(
            "answer_length", PROMPTS, "Answer length", 0.0, possible,
            "No answers to measure.", "Write three answers of roughly 60-200 characters.",
        )
    per_answer = possible / REQUIRED_PROMPTS
    earned = 0.0
    too_short: list[int] = []
    too_long: list[int] = []
    for index, answer in enumerate(answers[:REQUIRED_PROMPTS], start=1):
        length = len(answer)
        if 60 <= length <= 200:
            earned += per_answer
        elif 30 <= length < 60 or 200 < length <= MAX_ANSWER_CHARS:
            earned += per_answer / 2
            (too_short if length < 60 else too_long).append(index)
        else:
            (too_short if length < 30 else too_long).append(index)
    lengths = ", ".join(str(len(a)) for a in answers)
    detail = f"Answer lengths (characters): {lengths}."
    notes: list[str] = []
    if too_short:
        notes.append(
            "Answer(s) " + ", ".join(map(str, too_short)) + " are too short to say "
            "anything specific — one concrete detail is worth more than one clever word."
        )
    if too_long:
        notes.append(
            "Answer(s) " + ", ".join(map(str, too_long)) + " run long; the cap is "
            f"{MAX_ANSWER_CHARS} characters and attention runs out well before that."
        )
    return RuleResult(
        "answer_length", PROMPTS, "Answer length",
        round(earned, 2), possible, detail, " ".join(notes),
    )


@rule
def cliche_free(profile: Profile) -> RuleResult:
    possible = 6.0
    if not profile.answers:
        return RuleResult(
            "cliche_free", PROMPTS, "Free of cliches", 0.0, possible,
            "No answers to judge.", "Write your answers first; then keep them stock-free.",
        )
    joined = " ".join(profile.answers)
    hits = T.matches(joined, T.CLICHES)
    earned = _clamp(possible - 2.0 * len(hits), 0.0, possible)
    detail = (
        "No stock phrases found." if not hits
        else f"Stock phrases found: {', '.join(repr(h) for h in hits)}."
    )
    fix = "" if not hits else (
        "Replace each stock phrase with the specific thing behind it. "
        "'Foodie' is a category; 'I have opinions about tteokbokki' is a person."
    )
    return RuleResult("cliche_free", PROMPTS, "Free of cliches", earned, possible, detail, fix)


@rule
def conversation_hooks(profile: Profile) -> RuleResult:
    possible = 6.0
    answers = profile.answers
    if not answers:
        return RuleResult(
            "conversation_hooks", PROMPTS, "Conversation hooks", 0.0, possible,
            "No answers to check.", "Give at least two answers something to reply to.",
        )
    hooked = [i for i, a in enumerate(answers, start=1) if T.has_hook(a)]
    table = {0: 0.0, 1: 3.0, 2: 5.0}
    earned = table.get(len(hooked), possible)
    detail = f"{len(hooked)} of {len(answers)} answer(s) offer an opening."
    fix = "" if len(hooked) >= 3 else (
        "End at least two answers with something replyable: a question, a claim to "
        "argue with, or an invitation. A closed statement gets a like and no message."
    )
    return RuleResult(
        "conversation_hooks", PROMPTS, "Conversation hooks", earned, possible, detail, fix
    )


@rule
def prompt_variety(profile: Profile) -> RuleResult:
    possible = 6.0
    types = {T.prompt_type(p.prompt) for p in profile.answered_prompts}
    distinct = len(types)
    table = {0: 0.0, 1: 1.0, 2: 4.0}
    earned = table.get(distinct, possible)
    detail = f"Prompt families used: {', '.join(sorted(types)) or 'none'}."
    fix = "" if distinct >= 3 else (
        "Pick prompts from different families — one story, one playful, one that "
        "invites a plan. Three jokes in a row reads as one note held too long."
    )
    return RuleResult("prompt_variety", PROMPTS, "Prompt variety", earned, possible, detail, fix)


# --------------------------------------------------------------------------
# Writing (20 points)
# --------------------------------------------------------------------------

@rule
def specificity(profile: Profile) -> RuleResult:
    possible = 6.0
    answers = profile.answers
    if not answers:
        return RuleResult(
            "specificity", WRITING, "Specificity", 0.0, possible,
            "No answers to check.", "Name particular things: places, titles, numbers.",
        )
    scores = [T.specificity(a) for a in answers]
    mean = sum(scores) / len(scores)
    earned = round(mean * possible, 2)
    vague = [i for i, s in enumerate(scores, start=1) if s < 0.5]
    detail = f"Specificity by answer: {', '.join(f'{s:.1f}' for s in scores)}."
    fix = "" if not vague else (
        "Answer(s) " + ", ".join(map(str, vague)) + " name nothing in particular. "
        "Swap one abstraction for one concrete noun — a dish, a street, a band, a number."
    )
    return RuleResult("specificity", WRITING, "Specificity", earned, possible, detail, fix)


@rule
def positivity(profile: Profile) -> RuleResult:
    possible = 5.0
    if not profile.answers:
        return RuleResult(
            "positivity", WRITING, "Positive framing", 0.0, possible,
            "No answers to judge.", "Write your answers first; then say what you do want.",
        )
    joined = " ".join(profile.answers)
    hits = T.matches(joined, T.NEGATIVE_MARKERS)
    earned = _clamp(possible - 2.5 * len(hits), 0.0, possible)
    detail = (
        "No list-of-demands phrasing." if not hits
        else f"Negative framing found: {', '.join(repr(h) for h in hits)}."
    )
    fix = "" if not hits else (
        "Say what you do want instead of what you will not tolerate. A profile "
        "that opens with rules is answering an argument nobody started."
    )
    return RuleResult("positivity", WRITING, "Positive framing", earned, possible, detail, fix)


@rule
def tone_and_formatting(profile: Profile) -> RuleResult:
    possible = 4.0
    answers = profile.answers
    if not answers:
        return RuleResult(
            "tone_and_formatting", WRITING, "Tone and formatting", 0.0, possible,
            "No answers to judge.", "Write your answers first; then keep the tone plain.",
        )
    joined = " ".join(answers)
    earned = possible
    problems: list[str] = []

    emojis = T.emoji_count(joined)
    if emojis > 4:
        earned -= 1.5
        problems.append(f"{emojis} emoji across the profile")
    if any(T.shouting(a) for a in answers):
        earned -= 1.5
        problems.append("an answer is mostly uppercase")
    exclamations = joined.count("!")
    if exclamations > 3:
        earned -= 1.0
        problems.append(f"{exclamations} exclamation marks")
    over_limit = [i for i, a in enumerate(answers, start=1) if len(a) > MAX_ANSWER_CHARS]
    if over_limit:
        earned -= 1.0
        problems.append(
            "answer(s) " + ", ".join(map(str, over_limit)) + " exceed the character limit"
        )

    earned = _clamp(earned, 0.0, possible)
    detail = "Tone and formatting look clean." if not problems else "Found: " + ", ".join(problems) + "."
    fix = "" if not problems else (
        "Let the words carry the tone. Emoji and exclamation marks are volume, not content."
    )
    return RuleResult(
        "tone_and_formatting", WRITING, "Tone and formatting", earned, possible, detail, fix
    )


@rule
def readability(profile: Profile) -> RuleResult:
    possible = 5.0
    answers = profile.answers
    if not answers:
        return RuleResult(
            "readability", WRITING, "Readability", 0.0, possible,
            "No answers to check.", "Write in short, plain sentences.",
        )
    lengths = [T.avg_sentence_length(a) for a in answers if a]
    mean = sum(lengths) / len(lengths) if lengths else 0.0
    if 5 <= mean <= 20:
        earned = possible
    elif 20 < mean <= 30 or 3 <= mean < 5:
        earned = 3.0
    else:
        earned = 1.0
    detail = f"Average sentence length: {mean:.1f} words."
    fix = "" if earned == possible else (
        "Aim for sentences of roughly 5-20 words. Long ones get skimmed; "
        "three-word fragments give the reader nothing to hold."
    )
    return RuleResult("readability", WRITING, "Readability", earned, possible, detail, fix)


# --------------------------------------------------------------------------
# Completeness (10 points)
# --------------------------------------------------------------------------

@rule
def vitals_filled(profile: Profile) -> RuleResult:
    possible = 6.0
    filled = [key for key in CORE_VITALS if profile.vital(key)]
    missing = [key for key in CORE_VITALS if not profile.vital(key)]
    earned = round(len(filled) / len(CORE_VITALS) * possible, 2)
    detail = f"{len(filled)} of {len(CORE_VITALS)} core vitals filled."
    fix = "" if not missing else (
        "Fill in: " + ", ".join(missing) + ". Blank vitals get read as "
        "evasion, and they are free to fill."
    )
    return RuleResult("vitals_filled", COMPLETENESS, "Vitals", earned, possible, detail, fix)


@rule
def stated_intentions(profile: Profile) -> RuleResult:
    possible = 4.0
    has_intent = bool(profile.vital("dating_intentions"))
    has_type = bool(profile.vital("relationship_type"))
    earned = 4.0 if has_intent else (2.0 if has_type else 0.0)
    if has_intent:
        detail = f"Dating intentions stated: {profile.vital('dating_intentions')}."
    elif has_type:
        detail = "Relationship type stated, but dating intentions are blank."
    else:
        detail = "No stated intentions."
    fix = "" if has_intent else (
        "Set your dating intentions. Saying what you are here for filters out the "
        "conversations you did not want anyway."
    )
    return RuleResult(
        "stated_intentions", COMPLETENESS, "Stated intentions", earned, possible, detail, fix
    )
