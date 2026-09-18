# Hinge Profile Optimizer

Scores a Hinge profile out of 100 and returns a **prioritised list of fixes**,
worst-first. Pure standard library — no numpy, no pandas, no network, no API
key. The same profile always produces the same score.

```bash
python3 -m hinge_optimizer examples/profile_weak.json
python3 -m hinge_optimizer profile.json --format markdown
python3 -m hinge_optimizer profile.json --format json
python3 -m hinge_optimizer --example > profile.json   # blank template
```

## Describing your profile

The tool reads a JSON file. Photos are *described*, not analysed — you say what
each shot is, and the rules reason about the grid as a whole.

```json
{
  "name": "Your name",
  "age": 29,
  "photos": [
    {"kind": "face", "people": 1},
    {"kind": "full_body", "people": 1},
    {"kind": "social", "people": 4, "sunglasses": false}
  ],
  "prompts": [
    {"prompt": "Together we could", "answer": "Hunt down the best gukbap within six blocks."}
  ],
  "vitals": {
    "work": "Ceramics studio manager",
    "education": "Hongik University",
    "hometown": "Daegu",
    "height": "5'9\"",
    "location": "Seoul",
    "dating_intentions": "Looking for a long-term relationship"
  }
}
```

**Photo fields** — `kind` (one of `face`, `full_body`, `activity`, `social`,
`travel`, `pet`, `mirror`, `candid`, `other`), `people` (how many are in
frame), `sunglasses`, `selfie`, `face_visible`, `note`. A bare string works as
shorthand for `kind`: `"photos": ["face", "full_body"]`.

Unknown fields and unknown photo kinds are rejected rather than ignored, so a
typo fails loudly instead of quietly costing you points.

## What it scores

| Category | Points | Checks |
| --- | --- | --- |
| Photos | 35 | count, lead photo, variety, full-body shot, social proof, group balance, selfie balance |
| Prompts | 35 | all three answered, answer length, cliché-free, conversation hooks, prompt variety |
| Writing | 20 | specificity, positive framing, tone and formatting, readability |
| Completeness | 10 | core vitals filled, stated dating intentions |

The checks encode the advice that gets repeated most about dating profiles:
lead with a clear solo face shot; include one full-body photo; keep group shots
to a couple so people can tell which one is you; answer all three prompts;
name particular things instead of categories; leave the reader something to
reply to; say what you want rather than listing what you will not tolerate.

Two of these deserve a note:

- **Specificity** counts proper nouns, numbers, and content words that are
  neither common English nor stock dating-app vocabulary. Words that appear
  only inside a detected cliché do not count — "fluent in sarcasm" scores zero,
  not full marks for the rare word *sarcasm*.
- **Conversation hooks** looks for a question mark or an invitation ("convince
  me", "let's", "tell me"). A closed statement earns a like; an opening earns a
  message.

## Output

`--format text` (default) prints a score, a per-category breakdown, every check
with its result, and the ordered fix list. `--format markdown` is the same
report for pasting into a doc or a PR. `--format json` is the machine-readable
form, including a `priorities` array of rule ids.

`--fail-under SCORE` exits `1` when the score is below `SCORE`, so the tool can
gate a script. A missing or malformed profile exits `2`.

## As a library

```python
from hinge_optimizer import Profile, evaluate, render_text

report = evaluate(Profile.from_json(raw_json))
print(report.score, report.grade)
for result in report.priorities(limit=3):
    print(f"+{result.lost} — {result.title}: {result.fix}")
print(render_text(report))
```

## Tests

```bash
python3 -m unittest discover -s tests -t .
```

69 tests, no third-party dependencies.

## Honest limits

These are lexicon and shape heuristics, not judgement. The tool reliably
catches structural mistakes — an empty photo slot, a group photo in slot 1,
three prompts in the same key, a profile that opens with rules. It cannot tell
whether a joke actually lands, and a genuinely original answer written in
ordinary words may read as generic to the specificity check. Treat a low score
as a real problem and a high score as "nothing obvious is broken" rather than
proof the profile is charming.
