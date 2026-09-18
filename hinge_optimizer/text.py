"""Text heuristics used by the scoring rules.

Everything here is lexicon- and shape-based: no model, no network, and the
same input always produces the same output. The trade-off is that these are
approximations of taste, not measurements of it — see the README.
"""

from __future__ import annotations

import re

# Phrases that appear on a large share of profiles and therefore carry no
# information about the person writing them.
CLICHES = (
    "love to laugh",
    "fluent in sarcasm",
    "sarcasm is my love language",
    "work hard play hard",
    "partner in crime",
    "live laugh love",
    "living my best life",
    "foodie",
    "wanderlust",
    "adventure buddy",
    "looking for my person",
    "i'm an open book",
    "ask me anything",
    "just ask",
    "netflix and chill",
    "dog mom",
    "dog dad",
    "gym rat",
    "coffee addict",
    "down to earth",
    "easy going",
    "easygoing",
    "go with the flow",
    "i like to have fun",
    "here for a good time",
    "love trying new things",
    "obsessed with travel",
    "old soul",
    "type b personality",
    "professional overthinker",
    "i don't bite",
    "bad at these",
    "bad at bios",
    "hate writing these",
    "6'2 since apparently that matters",
)

# Phrases that turn a profile into a list of demands or complaints.
NEGATIVE_MARKERS = (
    "swipe left",
    "no drama",
    "not looking for",
    "don't message me",
    "do not message me",
    "please don't",
    "tired of",
    "sick of",
    "i hate",
    "can't stand",
    "no hookups",
    "not here for hookups",
    "if you can't",
    "deal breaker",
    "dealbreaker",
    "must be",
    "no games",
    "waste my time",
)

# Openings that hand the reader something to reply to.
HOOK_MARKERS = (
    "convince me",
    "change my mind",
    "your turn",
    "tell me",
    "let's",
    "lets ",
    "we should",
    "bet you",
    "prove me wrong",
    "fight me",
    "first round",
    "i'll go first",
    "ill go first",
    "come with",
    "teach me",
    "recommend me",
    "settle this",
    "hot take",
    "unpopular opinion",
    "open to",
)

# Vocabulary that is common in English generally or generic on dating apps.
# A content word outside this set is treated as a specificity signal.
GENERIC_VOCAB = frozenset(
    """
    a an the and or but so if then than that this these those there here
    i me my mine myself you your yours we us our ours they them their he she
    him her his hers it its who whom what which when where why how
    is am are was were be been being do does did doing have has had having
    will would shall should can could may might must let lets
    not no nor yes very really just also too much many more most some any
    all both each few other another same such own only own even still
    of in on at by for with about into over under between from to up down
    out off again once during before after above below through
    good great best better nice cool fun funny happy love loves loved like
    likes liked new old big small long short high low
    thing things stuff time times day days week weeks month year years night
    life live living people person friend friends family guy girl man woman
    someone something anyone anything everyone everything nothing
    work working job home house city town place places world
    food eat eating drink drinking coffee beer wine dinner lunch brunch
    music movie movies show shows book books travel traveling trip
    dog dogs cat cats pet pets gym workout run running hike hiking beach
    weekend weekends summer winter outdoors nature
    talk talking say says said tell telling ask asking know knows knew think
    thinks thought want wants wanted need needs get gets got go goes going
    come comes came make makes made take takes took give gives gave find
    finds found look looks looking feel feels felt try trying use using
    spend spending enjoy enjoys enjoying laugh laughing laughs smile
    always never sometimes usually often probably maybe definitely honestly
    pretty kind sort bit lot lots little super
    looking meet meeting date dating relationship partner
    conversation conversations chat text texting message messages banter
    drama vibe vibes energy sarcasm humor humour sense honest honesty
    loyalty kindness chill relax relaxing spontaneous positive negative
    hold sense real genuine
    every around without together anywhere somewhere everywhere please
    thanks sorry right wrong true sure okay well keep leave start stop
    help plan plans pick picking choose actually basically literally
    currently recently anyone else stuff kinda gonna wanna
    """.split()
)

_WORD_RE = re.compile(r"[A-Za-z']+")
_DIGIT_RE = re.compile(r"\d+")
_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+\s*")


def words(text: str) -> list[str]:
    return _WORD_RE.findall(text)


def sentences(text: str) -> list[str]:
    parts = [s.strip() for s in _SENTENCE_SPLIT_RE.split(text)]
    return [s for s in parts if s]


def normalise(text: str) -> str:
    """Lowercase and collapse whitespace, for phrase matching."""
    return re.sub(r"\s+", " ", text.lower().replace("’", "'")).strip()


def matches(text: str, phrases: tuple[str, ...]) -> list[str]:
    """Return every phrase from `phrases` that appears in `text`."""
    haystack = normalise(text)
    return [phrase for phrase in phrases if phrase in haystack]


def emoji_count(text: str) -> int:
    count = 0
    for char in text:
        code = ord(char)
        if (
            0x1F300 <= code <= 0x1FAFF
            or 0x2600 <= code <= 0x27BF
            or code in (0x2764, 0x2B50, 0x2728)
        ):
            count += 1
    return count


def shouting(text: str) -> bool:
    """True when a long-enough answer is mostly uppercase."""
    letters = [c for c in text if c.isalpha()]
    if len(letters) < 20:
        return False
    upper = sum(1 for c in letters if c.isupper())
    return upper / len(letters) > 0.6


def proper_nouns(text: str) -> list[str]:
    """Capitalised words that are not simply starting a sentence."""
    found: list[str] = []
    for sentence in sentences(text):
        tokens = words(sentence)
        for token in tokens[1:]:
            # "I", "I'm", "I'll" are capitalised by grammar, not by meaning.
            if token.split("'")[0] == "I":
                continue
            if len(token) > 2 and token[0].isupper():
                found.append(token)
    return found


def strip_stock_phrases(text: str) -> str:
    """Remove cliches and list-of-demands phrasing from `text`.

    Those phrases are generic by definition, so the words inside them must
    not be counted as evidence that an answer says something particular.
    """
    out = text
    for phrase in CLICHES + NEGATIVE_MARKERS:
        pattern = re.compile(re.escape(phrase).replace("\\'", "['\u2019]"), re.IGNORECASE)
        out = pattern.sub(" ", out)
    return out


def specific_tokens(text: str) -> list[str]:
    """Signals that an answer names something in particular.

    Three kinds count: proper nouns, numbers, and content words that are
    neither common English nor stock dating-app vocabulary. Words that only
    appear inside a stock phrase do not count.
    """
    text = strip_stock_phrases(text)
    signals: list[str] = list(proper_nouns(text))
    signals.extend(_DIGIT_RE.findall(text))
    for token in words(text):
        # Compare the stem, so "friend's" is judged as "friend" and the
        # contractions "i'll" / "i've" collapse to a too-short "i".
        stem = token.lower().strip("'").split("'")[0]
        if len(stem) >= 4 and stem not in GENERIC_VOCAB:
            signals.append(stem)
    # Preserve order while removing duplicates so counts are not inflated.
    seen: set[str] = set()
    unique: list[str] = []
    for signal in signals:
        key = signal.lower()
        if key not in seen:
            seen.add(key)
            unique.append(signal)
    return unique


def specificity(text: str) -> float:
    """0.0 (entirely generic) to 1.0 (names at least two particular things)."""
    if not text.strip():
        return 0.0
    return min(1.0, len(specific_tokens(text)) / 2.0)


def has_hook(text: str) -> bool:
    """True when the answer gives the reader an obvious way in."""
    stripped = text.strip()
    if not stripped:
        return False
    if "?" in stripped:
        return True
    return bool(matches(stripped, HOOK_MARKERS))


def avg_sentence_length(text: str) -> float:
    parts = sentences(text)
    if not parts:
        return 0.0
    return sum(len(words(s)) for s in parts) / len(parts)


# Prompt families. A profile that answers three prompts of the same family
# reads flat, however good each individual answer is.
PROMPT_TYPES: dict[str, tuple[str, ...]] = {
    "story": (
        "story", "happened", "moment", "last time", "biggest", "greatest",
        "worst", "best trip", "craziest", "once", "memory", "growing up",
    ),
    "playful": (
        "irrational", "weirdly", "unusual", "won't shut up", "wont shut up",
        "hot take", "unpopular opinion", "guilty pleasure", "confession",
        "toughest", "worst idea", "irrationally", "petty", "hill",
    ),
    "values": (
        "looking for", "believe", "important", "care about", "love language",
        "green flag", "family", "value", "matters", "non-negotiable",
        "makes a relationship", "i want someone",
    ),
    "invitation": (
        "together", "let's", "lets ", "we'll", "well get along", "first round",
        "date", "teach me", "convince me", "dating me is like", "we're the same",
        "you should", "typical sunday", "perfect first",
    ),
}


def prompt_type(prompt: str) -> str:
    """Classify a prompt into a family, or 'other' when nothing matches."""
    lowered = normalise(prompt)
    best = "other"
    best_hit = 0
    for name, markers in PROMPT_TYPES.items():
        hits = sum(1 for marker in markers if marker in lowered)
        if hits > best_hit:
            best, best_hit = name, hits
    return best
