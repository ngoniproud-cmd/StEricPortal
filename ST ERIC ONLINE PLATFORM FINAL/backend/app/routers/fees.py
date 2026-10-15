"""Read-only fees. The school's existing fee system stays the source of truth; we mirror and display it.
Sources: (1) read-only SQL connection (FEE_SYSTEM_DB_URL + FEE_SYSTEM_QUERY), (2) CSV upload fallback."""
import csv
import io
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.deps import current_user, require_roles
from app.models import FeeRecord, Student, User
from app.routers.reports import children_of

router = APIRouter(prefix="/fees", tags=["fees"])
admin = require_roles("admin")
COLS = ("external_student_id", "external_fee_id", "fee_type", "currency", "amount_due", "amount_paid")


def upsert(db: Session, rows: list[dict]) -> dict:
    created = updated = 0
    errors = []
    for n, r in enumerate(rows, start=2):
        try:
            due, paid = round(float(r["amount_due"]), 2), round(float(r["amount_paid"] or 0), 2)
            cur = (r.get("currency") or "USD").strip().upper()
            if due < 0 or paid < 0 or cur not in ("USD", "ZWG"):
                raise ValueError
            sid, fid = str(r["external_student_id"]).strip(), str(r["external_fee_id"]).strip()
            if not sid or not fid:
                raise ValueError
        except (ValueError, KeyError, TypeError):
            errors.append({"row": n, "error": "Check the amounts, currency (USD or ZWG) and IDs."})
            continue
        bal = round(due - paid, 2)
        rec = db.scalar(select(FeeRecord).where(FeeRecord.external_fee_id == fid))
        if rec:
            updated += 1
        else:
            rec = FeeRecord(external_fee_id=fid); db.add(rec); created += 1
        rec.external_student_id, rec.fee_type, rec.currency = sid, str(r.get("fee_type") or "Fees").strip(), cur
        rec.amount_due, rec.amount_paid, rec.balance = due, paid, bal
        rec.status = "paid" if bal <= 0 else "part_paid" if paid > 0 else "unpaid"
        rec.last_synced_at = datetime.now(timezone.utc)
    db.commit()
    return {"created": created, "updated": updated, "errors": errors}


def read_source() -> list[dict]:
    """Pulls from the existing fee system. Read-only: only a SELECT is ever run."""
    if not settings.FEE_SYSTEM_DB_URL or not settings.FEE_SYSTEM_QUERY:
        raise HTTPException(400, "The fee system connection is not set up. Ask your administrator, or upload a CSV export instead.")
    if not settings.FEE_SYSTEM_QUERY.strip().lower().startswith("select"):
        raise HTTPException(500, "The fee query must be a SELECT.")
    eng = None
    try:
        eng = create_engine(settings.FEE_SYSTEM_DB_URL, pool_pre_ping=True)
        with eng.connect() as c:
            res = c.execute(text(settings.FEE_SYSTEM_QUERY))
            rows = [dict(zip(res.keys(), r)) for r in res]
    except Exception:
        raise HTTPException(502, "Could not reach the fee system. Please try again or upload a CSV export.")
    finally:
        if eng:
            eng.dispose()
    if rows and not set(COLS) <= set(rows[0]):
        raise HTTPException(500, f"The fee query must return these columns: {', '.join(COLS)}.")
    return rows


@router.post("/sync")
def sync(db: Session = Depends(get_db), _: User = Depends(admin)):
    return upsert(db, read_source())


@router.post("/import")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(admin)):
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    rd = csv.DictReader(io.StringIO(raw))
    if not rd.fieldnames or not set(COLS) <= {f.strip() for f in rd.fieldnames}:
        raise HTTPException(422, f"The CSV needs these columns: {', '.join(COLS)}.")
    return upsert(db, [{k.strip(): v for k, v in r.items()} for r in rd])


def _summary(db: Session, st: Student) -> dict:
    recs = list(db.scalars(select(FeeRecord).where(FeeRecord.external_student_id == st.admission_no).order_by(FeeRecord.created_at, FeeRecord.external_fee_id)))
    totals: dict[str, float] = {}
    total_billed = 0.0
    total_paid = 0.0
    last_payment_date = None

    raw_txns = []
    for r in recs:
        totals[r.currency] = round(totals.get(r.currency, 0) + float(r.balance), 2)
        due = float(r.amount_due)
        paid = float(r.amount_paid)
        cur = r.currency
        total_billed += due
        total_paid += paid

        # Billing / Debit date
        bill_date = r.created_at.strftime("%Y-%m-%d") if r.created_at else "2026-01-10"
        pay_date = r.last_synced_at.strftime("%Y-%m-%d") if r.last_synced_at else bill_date

        ref_suffix = r.external_fee_id.replace("FEE-", "")
        # 1. Invoice / Debit line
        raw_txns.append({
            "id": f"deb-{r.id}",
            "raw_date": r.created_at or datetime.now(timezone.utc),
            "date": bill_date,
            "date_paid": None,
            "ref": f"INV-{ref_suffix}",
            "description": r.fee_type,
            "type": "debit",
            "currency": cur,
            "debit": due,
            "credit": 0.0,
        })

        # 2. Payment / Credit line (if payment made)
        if paid > 0:
            if not last_payment_date or pay_date > last_payment_date:
                last_payment_date = pay_date
            raw_txns.append({
                "id": f"crd-{r.id}",
                "raw_date": r.last_synced_at or datetime.now(timezone.utc),
                "date": pay_date,
                "date_paid": pay_date,
                "ref": f"RCT-{ref_suffix}",
                "description": f"Payment Received: {r.fee_type}",
                "type": "credit",
                "currency": cur,
                "debit": 0.0,
                "credit": paid,
            })

    # Sort transactions chronologically
    raw_txns.sort(key=lambda x: (x["date"], 0 if x["type"] == "debit" else 1))

    # Calculate running balance
    running_balance = 0.0
    ledger = []
    for t in raw_txns:
        running_balance = round(running_balance + t["debit"] - t["credit"], 2)
        t_copy = dict(t)
        t_copy["running_balance"] = running_balance
        del t_copy["raw_date"]
        ledger.append(t_copy)

    return {
        "student": {"id": st.id, "name": st.full_name, "admission_no": st.admission_no},
        "records": [
            {
                "fee_type": r.fee_type,
                "currency": r.currency,
                "due": float(r.amount_due),
                "paid": float(r.amount_paid),
                "balance": float(r.balance),
                "status": r.status,
                "date_paid": r.last_synced_at.strftime("%Y-%m-%d") if (r.last_synced_at and float(r.amount_paid) > 0) else None,
            }
            for r in recs
        ],
        "ledger": ledger,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_paid, 2),
        "last_payment_date": last_payment_date,
        "balance": totals,
        "last_synced_at": max((r.last_synced_at for r in recs), default=None)
    }


@router.get("/mine")
def mine(db: Session = Depends(get_db), user: User = Depends(current_user)):
    if user.role not in ("student", "parent"):
        raise HTTPException(403, "Fees are shown to students and parents.")
    return [_summary(db, k) for k in children_of(db, user)]


@router.get("/student/{student_id}")
def student_fees(student_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(admin)):
    st = db.get(Student, student_id)
    if not st:
        raise HTTPException(404, "Student not found.")
    return _summary(db, st)
