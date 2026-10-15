"""ZIMSEC grading. Pure functions, no database, easy to test.

Bands are DEFAULTS. ZIMSEC boundaries can shift per subject/session, so the
`grading_bands` table (admin-editable) overrides these when populated.
Levels: "O" = Forms 1-4 (O-Level), "A" = Forms 5-6 (A-Level).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Band:
    grade: str
    min_pct: int
    max_pct: int
    points: int
    remark: str


DEFAULT_BANDS: dict[str, list[Band]] = {
    "O": [
        Band("A", 70, 100, 0, "Excellent"),
        Band("B", 60, 69, 0, "Very Good"),
        Band("C", 50, 59, 0, "Good (Pass)"),
        Band("D", 40, 49, 0, "Fair"),
        Band("E", 30, 39, 0, "Weak"),
        Band("U", 0, 29, 0, "Ungraded"),
    ],
    "A": [
        Band("A", 70, 100, 5, "Excellent"),
        Band("B", 60, 69, 4, "Very Good"),
        Band("C", 50, 59, 3, "Good"),
        Band("D", 45, 49, 2, "Satisfactory"),
        Band("E", 40, 44, 1, "Pass"),
        Band("O", 26, 39, 0, "Subsidiary Pass"),
        Band("F", 0, 25, 0, "Fail"),
    ],
}
PASS_GRADE = {"O": "C", "A": "E"}


def level_for_form(form: int) -> str:
    """Forms 1-4 -> O-Level scale, Forms 5-6 -> A-Level scale."""
    return "A" if form >= 5 else "O"


def percentage(obtained: float, max_marks: float) -> float:
    if max_marks <= 0:
        raise ValueError("max_marks must be greater than 0")
    if obtained < 0 or obtained > max_marks:
        raise ValueError("marks must be between 0 and max_marks")
    return obtained / max_marks * 100


def band_for(pct: float, level: str, bands: list[Band] | None = None) -> Band:
    """Round half-up to a whole percent, then find the band."""
    whole = int(pct + 0.5)
    for b in bands or DEFAULT_BANDS[level]:
        if b.min_pct <= whole <= b.max_pct:
            return b
    raise ValueError(f"No band for {pct}")


def grade_for(pct: float, level: str, bands: list[Band] | None = None) -> str:
    return band_for(pct, level, bands).grade


def is_pass(grade: str, level: str) -> bool:
    if level == "A":
        return grade in ("A", "B", "C", "D", "E")
    return grade in ("A", "B", "C")
