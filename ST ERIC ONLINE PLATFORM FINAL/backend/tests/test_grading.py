import pytest
from app.grading import grade_for, is_pass, level_for_form, percentage


@pytest.mark.parametrize("pct,grade", [(100, "A"), (70, "A"), (69, "B"), (60, "B"), (59, "C"), (50, "C"),
                                       (49, "D"), (40, "D"), (39, "E"), (30, "E"), (29, "U"), (0, "U")])
def test_o_level(pct, grade):
    assert grade_for(pct, "O") == grade


@pytest.mark.parametrize("pct,grade", [(100, "A"), (70, "A"), (69, "B"), (60, "B"), (59, "C"), (50, "C"),
                                       (49, "D"), (45, "D"), (44, "E"), (40, "E"), (39, "U"), (0, "U")])
def test_a_level(pct, grade):
    assert grade_for(pct, "A") == grade


def test_form_to_level():
    assert [level_for_form(f) for f in range(1, 7)] == ["O"] * 4 + ["A"] * 2


def test_rounding_half_up():
    assert grade_for(69.5, "O") == "A"
    assert grade_for(69.4, "O") == "B"


def test_pass_rules():
    assert is_pass("C", "O") and not is_pass("D", "O")
    assert is_pass("E", "A") and not is_pass("U", "A")


def test_percentage_validation():
    assert percentage(45, 60) == 75
    with pytest.raises(ValueError):
        percentage(61, 60)
