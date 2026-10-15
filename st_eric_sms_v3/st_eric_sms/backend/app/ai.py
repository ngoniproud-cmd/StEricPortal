"""AI-assisted report comments. Always a DRAFT for the teacher to edit.
Works with no internet or API key (rule-based writer); uses Claude when ANTHROPIC_API_KEY is set.
Privacy: only the first name, subject names and marks are ever sent, never surnames or admission numbers."""
import logging
import httpx
from app.config import settings

log = logging.getLogger(__name__)


def rule_based(first: str, rows: list[dict], overall: int, position: int | None, size: int, attendance: int | None) -> str:
    if not rows:
        return f"No marks have been recorded for {first} this term yet."
    ranked = sorted(rows, key=lambda r: -r["percent"])
    best, worst = ranked[0], ranked[-1]
    if overall >= 75:
        s = f"{first} has had an outstanding term with an average of {overall}%, and is doing especially well in {best['subject']}."
    elif overall >= 60:
        s = f"{first} has worked well this term, averaging {overall}%, with {best['subject']} a clear strength."
    elif overall >= 50:
        s = f"{first} has achieved a fair {overall}% this term, and {best['subject']} is the strongest subject."
    else:
        s = f"{first} averaged {overall}% this term and needs to work harder and seek help early."
    if worst["percent"] < 50 and worst is not best:
        s += f" More effort is needed in {worst['subject']} ({worst['percent']}%)."
    if attendance is not None and attendance < 85:
        s += f" Attendance of {attendance}% is affecting progress and must improve."
    elif overall >= 60:
        s += " Keep up the good work."
    else:
        s += " With consistent revision and attendance, improvement is well within reach."
    return s


def draft_comment(first: str, level: str, rows: list[dict], overall: int, position: int | None, size: int, attendance: int | None) -> dict:
    fallback = rule_based(first, rows, overall, position, size, attendance)
    if not settings.ANTHROPIC_API_KEY or not rows:
        return {"draft": fallback, "source": "rules"}
    marks = "; ".join(f"{r['subject']} {r['percent']}% ({r['grade']})" for r in rows)
    prompt = (f"Write a class teacher's end-of-term report comment for a Zimbabwean {'A-Level' if level == 'A' else 'O-Level'} "
              f"student named {first}. Marks: {marks}. Overall {overall}%"
              + (f", position {position} of {size}" if position else "")
              + (f", attendance {attendance}%" if attendance is not None else "")
              + ". Two or three sentences, warm but honest, specific to the marks, plain English, no bullet points. Output only the comment.")
    try:
        r = httpx.post("https://api.anthropic.com/v1/messages", timeout=20,
                       headers={"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
                       json={"model": settings.ANTHROPIC_MODEL, "max_tokens": 220, "messages": [{"role": "user", "content": prompt}]})
        r.raise_for_status()
        text = "".join(b.get("text", "") for b in r.json()["content"]).strip()
        return {"draft": text or fallback, "source": "ai" if text else "rules"}
    except Exception as e:  # never block the teacher because the internet or the API is down
        log.warning("AI comment failed, using rule-based draft: %s", e)
        return {"draft": fallback, "source": "rules"}
