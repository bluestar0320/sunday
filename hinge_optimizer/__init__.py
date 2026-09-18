"""Score a Hinge dating profile and say what to fix first.

Pure standard library, fully deterministic: the same profile always produces
the same score and the same ordered list of fixes.

    from hinge_optimizer import Profile, evaluate, render_text

    profile = Profile.from_json(raw_json)
    print(render_text(evaluate(profile)))
"""

from .models import Photo, Profile, ProfileError, PromptAnswer, load_profile
from .report import render_json, render_markdown, render_text
from .rules import RuleResult, all_rules
from .scoring import Report, evaluate

__version__ = "1.0.0"

__all__ = [
    "Photo",
    "Profile",
    "ProfileError",
    "PromptAnswer",
    "Report",
    "RuleResult",
    "all_rules",
    "evaluate",
    "load_profile",
    "render_json",
    "render_markdown",
    "render_text",
    "__version__",
]
