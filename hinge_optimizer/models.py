"""Data model for a Hinge profile.

A Hinge profile is deliberately narrow: up to six photos, exactly three
answered prompts (255 characters each), and a set of "vitals". There is no
free-form bio, so this model does not have one either.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

MAX_PHOTOS = 6
REQUIRED_PROMPTS = 3
MAX_ANSWER_CHARS = 255

PHOTO_KINDS = (
    "face",       # clear head-and-shoulders shot
    "full_body",  # shows your whole frame
    "activity",   # doing something: climbing, cooking, playing
    "social",     # with friends or family
    "travel",     # somewhere recognisably elsewhere
    "pet",        # with an animal
    "mirror",     # mirror shot
    "candid",     # taken by someone else, unposed
    "other",
)

CORE_VITALS = ("work", "education", "hometown", "height", "location")
INTENT_VITALS = ("dating_intentions", "relationship_type")


class ProfileError(ValueError):
    """Raised when profile input cannot be parsed."""


def _check_keys(data: dict[str, Any], allowed: tuple[str, ...], where: str) -> None:
    unknown = sorted(set(data) - set(allowed))
    if unknown:
        raise ProfileError(
            f"{where}: unknown field(s) {', '.join(unknown)}; "
            f"allowed fields are {', '.join(allowed)}"
        )


@dataclass
class Photo:
    """One slot in the photo grid, described rather than pixel-analysed."""

    kind: str = "other"
    people: int = 1
    sunglasses: bool = False
    selfie: bool = False
    face_visible: bool = True
    note: str = ""

    _FIELDS = ("kind", "people", "sunglasses", "selfie", "face_visible", "note")

    def __post_init__(self) -> None:
        if self.kind not in PHOTO_KINDS:
            raise ProfileError(
                f"photo kind {self.kind!r} is not one of: {', '.join(PHOTO_KINDS)}"
            )
        if self.people < 0:
            raise ProfileError("photo 'people' cannot be negative")

    @property
    def is_group(self) -> bool:
        return self.people > 1

    @classmethod
    def from_dict(cls, data: Any, index: int) -> "Photo":
        where = f"photo {index + 1}"
        if isinstance(data, str):
            return cls(kind=data)
        if not isinstance(data, dict):
            raise ProfileError(f"{where}: expected an object or a kind string")
        _check_keys(data, cls._FIELDS, where)
        try:
            return cls(**data)
        except TypeError as exc:  # pragma: no cover - guarded by _check_keys
            raise ProfileError(f"{where}: {exc}") from exc


@dataclass
class PromptAnswer:
    """A Hinge prompt and the answer written under it."""

    prompt: str = ""
    answer: str = ""

    _FIELDS = ("prompt", "answer")

    @property
    def answered(self) -> bool:
        return bool(self.answer.strip())

    @classmethod
    def from_dict(cls, data: Any, index: int) -> "PromptAnswer":
        where = f"prompt {index + 1}"
        if not isinstance(data, dict):
            raise ProfileError(f"{where}: expected an object with 'prompt' and 'answer'")
        _check_keys(data, cls._FIELDS, where)
        return cls(prompt=str(data.get("prompt", "")), answer=str(data.get("answer", "")))


@dataclass
class Profile:
    name: str = ""
    age: int | None = None
    photos: list[Photo] = field(default_factory=list)
    prompts: list[PromptAnswer] = field(default_factory=list)
    vitals: dict[str, str] = field(default_factory=dict)

    _FIELDS = ("name", "age", "photos", "prompts", "vitals")

    @property
    def answered_prompts(self) -> list[PromptAnswer]:
        return [p for p in self.prompts if p.answered]

    @property
    def answers(self) -> list[str]:
        return [p.answer.strip() for p in self.answered_prompts]

    def vital(self, key: str) -> str:
        return str(self.vitals.get(key, "")).strip()

    @classmethod
    def from_dict(cls, data: Any) -> "Profile":
        if not isinstance(data, dict):
            raise ProfileError("profile: expected a JSON object at the top level")
        _check_keys(data, cls._FIELDS, "profile")

        photos_raw = data.get("photos", []) or []
        prompts_raw = data.get("prompts", []) or []
        if not isinstance(photos_raw, list):
            raise ProfileError("profile: 'photos' must be a list")
        if not isinstance(prompts_raw, list):
            raise ProfileError("profile: 'prompts' must be a list")

        vitals_raw = data.get("vitals", {}) or {}
        if not isinstance(vitals_raw, dict):
            raise ProfileError("profile: 'vitals' must be an object")

        age = data.get("age")
        if age is not None and not isinstance(age, int):
            raise ProfileError("profile: 'age' must be an integer")

        return cls(
            name=str(data.get("name", "")),
            age=age,
            photos=[Photo.from_dict(p, i) for i, p in enumerate(photos_raw)],
            prompts=[PromptAnswer.from_dict(p, i) for i, p in enumerate(prompts_raw)],
            vitals={str(k): str(v) for k, v in vitals_raw.items()},
        )

    @classmethod
    def from_json(cls, text: str) -> "Profile":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ProfileError(f"profile is not valid JSON: {exc}") from exc
        return cls.from_dict(data)


def load_profile(path: str) -> Profile:
    with open(path, encoding="utf-8") as handle:
        return Profile.from_json(handle.read())
