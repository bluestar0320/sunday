"""Tests for the Hinge profile optimizer.

Run with:  python3 -m unittest discover -s tests -t .
"""

from __future__ import annotations

import contextlib
import io
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hinge_optimizer import (  # noqa: E402
    Photo,
    Profile,
    ProfileError,
    PromptAnswer,
    evaluate,
    load_profile,
    render_json,
    render_markdown,
    render_text,
)
from hinge_optimizer import text as T  # noqa: E402
from hinge_optimizer.cli import main  # noqa: E402
from hinge_optimizer.rules import all_rules  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES = os.path.join(ROOT, "examples")


def run_cli(argv) -> int:
    """Invoke the CLI with its output captured, so tests stay quiet."""
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        return main(argv)


def find(report, rule_id):
    for result in report.results:
        if result.rule_id == rule_id:
            return result
    raise AssertionError(f"no rule {rule_id!r} in report")


def strong_profile() -> Profile:
    return load_profile(os.path.join(EXAMPLES, "profile_strong.json"))


def weak_profile() -> Profile:
    return load_profile(os.path.join(EXAMPLES, "profile_weak.json"))


class TestModels(unittest.TestCase):
    def test_photo_from_bare_kind_string(self):
        photo = Photo.from_dict("full_body", 0)
        self.assertEqual(photo.kind, "full_body")
        self.assertFalse(photo.is_group)

    def test_photo_rejects_unknown_kind(self):
        with self.assertRaises(ProfileError):
            Photo(kind="glamour_shot")

    def test_photo_rejects_unknown_field(self):
        with self.assertRaises(ProfileError) as ctx:
            Photo.from_dict({"kind": "face", "colour": "blue"}, 0)
        self.assertIn("colour", str(ctx.exception))

    def test_group_detection(self):
        self.assertTrue(Photo(kind="social", people=3).is_group)
        self.assertFalse(Photo(kind="face", people=1).is_group)

    def test_blank_answer_is_not_answered(self):
        self.assertFalse(PromptAnswer(prompt="p", answer="   ").answered)
        self.assertTrue(PromptAnswer(prompt="p", answer="x").answered)

    def test_profile_rejects_non_object(self):
        with self.assertRaises(ProfileError):
            Profile.from_json("[1, 2, 3]")

    def test_profile_rejects_bad_json(self):
        with self.assertRaises(ProfileError):
            Profile.from_json("{not json")

    def test_profile_rejects_non_integer_age(self):
        with self.assertRaises(ProfileError):
            Profile.from_dict({"age": "twenty"})

    def test_vitals_are_stripped(self):
        profile = Profile.from_dict({"vitals": {"work": "  Baker  "}})
        self.assertEqual(profile.vital("work"), "Baker")
        self.assertEqual(profile.vital("missing"), "")


class TestTextHeuristics(unittest.TestCase):
    def test_cliches_are_detected(self):
        hits = T.matches("I love to laugh and I'm a total foodie", T.CLICHES)
        self.assertIn("love to laugh", hits)
        self.assertIn("foodie", hits)

    def test_curly_apostrophe_still_matches(self):
        self.assertTrue(T.matches("I’m an open book", T.CLICHES))

    def test_hook_from_question_mark(self):
        self.assertTrue(T.has_hook("What is the best gukbap in Seoul?"))

    def test_hook_from_invitation(self):
        self.assertTrue(T.has_hook("Convince me that mint chocolate is fine."))

    def test_closed_statement_has_no_hook(self):
        self.assertFalse(T.has_hook("I work in marketing and I like dogs."))

    def test_specificity_rejects_generic_answers(self):
        self.assertEqual(T.specificity("I love to laugh and have fun"), 0.0)

    def test_specificity_rewards_concrete_answers(self):
        self.assertEqual(
            T.specificity("I drove 400km to eat gukbap in Busan at 6am"), 1.0
        )

    def test_specificity_ignores_words_inside_cliches(self):
        # 'sarcasm' is only rare because the cliche puts it there.
        self.assertEqual(T.specificity("I'm fluent in sarcasm."), 0.0)

    def test_empty_text_has_no_specificity(self):
        self.assertEqual(T.specificity("   "), 0.0)

    def test_proper_nouns_skip_sentence_starts_and_pronouns(self):
        found = T.proper_nouns("Seoul is loud. I'll meet you in Busan.")
        self.assertIn("Busan", found)
        self.assertNotIn("Seoul", found)  # sentence-initial
        self.assertNotIn("I'll", found)

    def test_emoji_counting(self):
        self.assertEqual(T.emoji_count("hi \U0001F600 there \U0001F44D"), 2)
        self.assertEqual(T.emoji_count("plain text"), 0)

    def test_shouting_needs_length(self):
        self.assertTrue(T.shouting("I REALLY LOVE HIKING IN THE MOUNTAINS"))
        self.assertFalse(T.shouting("OK"))

    def test_prompt_type_classification(self):
        self.assertEqual(T.prompt_type("The last time I laughed way too hard"), "story")
        self.assertEqual(T.prompt_type("My most irrational fear"), "playful")
        self.assertEqual(T.prompt_type("I'm looking for"), "values")
        self.assertEqual(T.prompt_type("Together we could"), "invitation")
        self.assertEqual(T.prompt_type("Zxqv"), "other")

    def test_avg_sentence_length(self):
        self.assertAlmostEqual(T.avg_sentence_length("One two three. Four five."), 2.5)
        self.assertEqual(T.avg_sentence_length(""), 0.0)


class TestPhotoRules(unittest.TestCase):
    def test_full_grid_scores_full_marks(self):
        profile = Profile(photos=[Photo(kind="face") for _ in range(6)])
        self.assertEqual(find(evaluate(profile), "photo_count").earned, 8.0)

    def test_over_six_photos_is_penalised(self):
        profile = Profile(photos=[Photo(kind="face") for _ in range(8)])
        result = find(evaluate(profile), "photo_count")
        self.assertLess(result.earned, 8.0)
        self.assertIn("at most", result.fix)

    def test_group_lead_photo_loses_points(self):
        solo = Profile(photos=[Photo(kind="face", people=1)])
        group = Profile(photos=[Photo(kind="social", people=4)])
        self.assertEqual(find(evaluate(solo), "first_photo").earned, 8.0)
        self.assertLess(find(evaluate(group), "first_photo").earned, 4.0)

    def test_sunglasses_in_lead_photo_loses_points(self):
        shaded = Profile(photos=[Photo(kind="face", sunglasses=True)])
        self.assertEqual(find(evaluate(shaded), "first_photo").earned, 6.0)

    def test_no_photos_fails_lead_photo(self):
        result = find(evaluate(Profile()), "first_photo")
        self.assertEqual(result.earned, 0.0)
        self.assertEqual(result.status, "fail")

    def test_full_body_photo_detected(self):
        without = Profile(photos=[Photo(kind="face")])
        with_it = Profile(photos=[Photo(kind="face"), Photo(kind="full_body")])
        self.assertEqual(find(evaluate(without), "full_body_photo").earned, 0.0)
        self.assertEqual(find(evaluate(with_it), "full_body_photo").earned, 4.0)

    def test_social_proof_ignores_the_lead_photo(self):
        # A group lead photo alone must not satisfy social proof.
        profile = Profile(photos=[Photo(kind="social", people=4)])
        self.assertEqual(find(evaluate(profile), "social_proof").earned, 0.0)
        profile.photos.append(Photo(kind="social", people=3))
        self.assertEqual(find(evaluate(profile), "social_proof").earned, 3.0)

    def test_too_many_group_photos(self):
        profile = Profile(photos=[Photo(kind="social", people=4) for _ in range(5)])
        self.assertLess(find(evaluate(profile), "group_photo_overuse").earned, 3.0)

    def test_selfie_overuse(self):
        profile = Profile(photos=[Photo(kind="mirror", selfie=True) for _ in range(3)])
        self.assertEqual(find(evaluate(profile), "selfie_overuse").earned, 0.0)

    def test_photo_variety_needs_four_kinds(self):
        same = Profile(photos=[Photo(kind="face") for _ in range(6)])
        varied = Profile(photos=[
            Photo(kind="face"), Photo(kind="full_body"),
            Photo(kind="activity"), Photo(kind="social", people=3),
        ])
        self.assertLess(find(evaluate(same), "photo_variety").earned, 7.0)
        self.assertEqual(find(evaluate(varied), "photo_variety").earned, 7.0)


class TestPromptRules(unittest.TestCase):
    def test_prompt_count_requires_three(self):
        one = Profile(prompts=[PromptAnswer("p", "a")])
        three = Profile(prompts=[PromptAnswer(f"p{i}", "a") for i in range(3)])
        self.assertEqual(find(evaluate(one), "prompt_count").earned, 1.0)
        self.assertEqual(find(evaluate(three), "prompt_count").earned, 8.0)

    def test_blank_answers_do_not_count(self):
        profile = Profile(prompts=[PromptAnswer("p", ""), PromptAnswer("q", "  ")])
        self.assertEqual(find(evaluate(profile), "prompt_count").earned, 0.0)

    def test_answer_length_sweet_spot(self):
        good = "x" * 120
        profile = Profile(prompts=[PromptAnswer(f"p{i}", good) for i in range(3)])
        self.assertEqual(find(evaluate(profile), "answer_length").earned, 9.0)

    def test_answer_over_character_limit(self):
        profile = Profile(prompts=[PromptAnswer("p", "x" * 300)])
        report = evaluate(profile)
        self.assertIn("run long", find(report, "answer_length").fix)
        self.assertLess(find(report, "tone_and_formatting").earned, 4.0)

    def test_cliches_cost_points(self):
        clean = Profile(prompts=[PromptAnswer("p", "I restore old bicycles.")])
        stock = Profile(prompts=[PromptAnswer(
            "p", "I love to laugh, fluent in sarcasm, total foodie."
        )])
        self.assertEqual(find(evaluate(clean), "cliche_free").earned, 6.0)
        self.assertEqual(find(evaluate(stock), "cliche_free").earned, 0.0)

    def test_hooks_are_counted(self):
        hooked = Profile(prompts=[
            PromptAnswer("p1", "Convince me otherwise."),
            PromptAnswer("p2", "What would you order?"),
            PromptAnswer("p3", "Let's settle this over dinner."),
        ])
        flat = Profile(prompts=[PromptAnswer("p", "I am a quiet person.")])
        self.assertEqual(find(evaluate(hooked), "conversation_hooks").earned, 6.0)
        self.assertEqual(find(evaluate(flat), "conversation_hooks").earned, 0.0)

    def test_prompt_variety_rewards_different_families(self):
        same = Profile(prompts=[
            PromptAnswer("My most irrational fear", "a"),
            PromptAnswer("My weirdly specific guilty pleasure", "b"),
            PromptAnswer("My hot take", "c"),
        ])
        mixed = Profile(prompts=[
            PromptAnswer("The last time I laughed way too hard", "a"),
            PromptAnswer("My most irrational fear", "b"),
            PromptAnswer("Together we could", "c"),
        ])
        self.assertEqual(find(evaluate(same), "prompt_variety").earned, 1.0)
        self.assertEqual(find(evaluate(mixed), "prompt_variety").earned, 6.0)


class TestWritingRules(unittest.TestCase):
    def test_negative_framing_costs_points(self):
        profile = Profile(prompts=[PromptAnswer(
            "p", "No drama please. Swipe left if you are boring."
        )])
        self.assertEqual(find(evaluate(profile), "positivity").earned, 0.0)

    def test_positive_answer_keeps_points(self):
        profile = Profile(prompts=[PromptAnswer("p", "I bake bread on Sundays.")])
        self.assertEqual(find(evaluate(profile), "positivity").earned, 5.0)

    def test_emoji_flood_costs_points(self):
        profile = Profile(prompts=[PromptAnswer("p", "hi " + "\U0001F600" * 6)])
        self.assertLess(find(evaluate(profile), "tone_and_formatting").earned, 4.0)

    def test_shouting_costs_points(self):
        profile = Profile(prompts=[PromptAnswer("p", "I REALLY LOVE HIKING A LOT OK")])
        self.assertLess(find(evaluate(profile), "tone_and_formatting").earned, 4.0)

    def test_readability_penalises_run_on_sentences(self):
        profile = Profile(prompts=[PromptAnswer("p", "word " * 60)])
        self.assertLess(find(evaluate(profile), "readability").earned, 5.0)

    def test_readability_accepts_normal_sentences(self):
        profile = Profile(prompts=[PromptAnswer(
            "p", "I bake bread on Sundays. The starter is named Gerald."
        )])
        self.assertEqual(find(evaluate(profile), "readability").earned, 5.0)


class TestCompletenessRules(unittest.TestCase):
    def test_vitals_scale_with_how_many_are_filled(self):
        empty = evaluate(Profile())
        full = evaluate(Profile(vitals={
            "work": "Baker", "education": "Hongik", "hometown": "Daegu",
            "height": "5'9\"", "location": "Seoul",
        }))
        self.assertEqual(find(empty, "vitals_filled").earned, 0.0)
        self.assertEqual(find(full, "vitals_filled").earned, 6.0)

    def test_intentions_beat_relationship_type_alone(self):
        none = evaluate(Profile())
        partial = evaluate(Profile(vitals={"relationship_type": "Monogamy"}))
        full = evaluate(Profile(vitals={"dating_intentions": "Long-term"}))
        self.assertEqual(find(none, "stated_intentions").earned, 0.0)
        self.assertEqual(find(partial, "stated_intentions").earned, 2.0)
        self.assertEqual(find(full, "stated_intentions").earned, 4.0)


class TestScoring(unittest.TestCase):
    def test_total_possible_is_one_hundred(self):
        report = evaluate(Profile())
        self.assertEqual(sum(r.possible for r in report.results), 100.0)

    def test_category_weights(self):
        report = evaluate(Profile())
        weights = {c.key: c.possible for c in report.categories}
        self.assertEqual(
            weights, {"photos": 35.0, "prompts": 35.0, "writing": 20.0, "completeness": 10.0}
        )

    def test_every_rule_reports_its_own_id_once(self):
        ids = [r.rule_id for r in evaluate(Profile()).results]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(ids), len(all_rules()))

    def test_empty_profile_scores_zero(self):
        self.assertEqual(evaluate(Profile()).score, 0.0)

    def test_strong_profile_beats_weak_profile(self):
        strong = evaluate(strong_profile())
        weak = evaluate(weak_profile())
        self.assertGreater(strong.score, 85.0)
        self.assertLess(weak.score, 60.0)
        self.assertGreater(strong.score, weak.score + 25)

    def test_scoring_is_deterministic(self):
        first = evaluate(strong_profile()).to_dict()
        second = evaluate(strong_profile()).to_dict()
        self.assertEqual(first, second)

    def test_no_rule_can_score_outside_its_range(self):
        for profile in (Profile(), strong_profile(), weak_profile()):
            for result in evaluate(profile).results:
                self.assertGreaterEqual(result.earned, 0.0, result.rule_id)
                self.assertLessEqual(result.earned, result.possible, result.rule_id)

    def test_priorities_are_ordered_by_points_lost(self):
        priorities = evaluate(weak_profile()).priorities()
        losses = [r.lost for r in priorities]
        self.assertEqual(losses, sorted(losses, reverse=True))
        self.assertTrue(all(loss > 0 for loss in losses))

    def test_every_losing_rule_offers_advice(self):
        for profile in (Profile(), weak_profile()):
            for result in evaluate(profile).priorities():
                self.assertTrue(result.fix.strip(), f"{result.rule_id} has no fix text")

    def test_grade_bands(self):
        report = evaluate(Profile())
        for score, expected in ((95, "A"), (85, "B"), (75, "C"), (65, "D"), (10, "F")):
            report.score = score
            self.assertEqual(report.grade, expected)

    def test_status_labels(self):
        report = evaluate(weak_profile())
        statuses = {r.status for r in report.results}
        self.assertTrue(statuses <= {"pass", "warn", "fail"})


class TestRendering(unittest.TestCase):
    def test_text_report_contains_score_and_fixes(self):
        out = render_text(evaluate(weak_profile()))
        self.assertIn("HINGE PROFILE OPTIMIZER", out)
        self.assertIn("FIX THESE, IN THIS ORDER", out)
        self.assertIn("Lead photo", out)

    def test_markdown_report_is_valid_markdown_ish(self):
        out = render_markdown(evaluate(weak_profile()))
        self.assertTrue(out.startswith("# Hinge profile review"))
        self.assertIn("| Category | Score | Share |", out)

    def test_json_report_round_trips(self):
        data = json.loads(render_json(evaluate(strong_profile())))
        self.assertEqual(data["grade"], "A")
        self.assertEqual(len(data["rules"]), len(all_rules()))
        self.assertIn("categories", data)

    def test_strong_example_passes_every_check(self):
        report = evaluate(strong_profile())
        self.assertEqual(report.score, 100.0)
        self.assertEqual(report.priorities(), [])
        self.assertIn("Nothing to fix", render_text(report))
        self.assertIn("Nothing to fix", render_markdown(report))


class TestCli(unittest.TestCase):
    def test_runs_against_example_file(self):
        code = run_cli([os.path.join(EXAMPLES, "profile_strong.json")])
        self.assertEqual(code, 0)

    def test_missing_file_exits_two(self):
        self.assertEqual(run_cli(["/nonexistent/profile.json"]), 2)

    def test_malformed_file_exits_two(self):
        path = os.path.join(EXAMPLES, "..", "tests", "_tmp_bad.json")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("{ not json")
        try:
            self.assertEqual(run_cli([path]), 2)
        finally:
            os.remove(path)

    def test_example_flag_emits_parsable_template(self):
        from hinge_optimizer.cli import EXAMPLE
        profile = Profile.from_json(EXAMPLE)
        self.assertEqual(len(profile.photos), 6)
        self.assertEqual(len(profile.prompts), 3)

    def test_fail_under_returns_one(self):
        weak = os.path.join(EXAMPLES, "profile_weak.json")
        self.assertEqual(run_cli([weak, "--fail-under", "90"]), 1)
        self.assertEqual(run_cli([weak, "--fail-under", "10"]), 0)

    def test_all_formats_render(self):
        strong = os.path.join(EXAMPLES, "profile_strong.json")
        for fmt in ("text", "markdown", "json"):
            self.assertEqual(run_cli([strong, "--format", fmt]), 0)


if __name__ == "__main__":
    unittest.main()
