"""Universal File Import Engine for St Eric High School.
Parses Spreadsheet (.xlsx, .xls, .csv), Word Document (.docx), and PDF (.pdf) files
to bulk-enrol students, staff, and automatically create linked user accounts:

Account Rules:
- Student:
    username: first_name (lowercase, unique)
    initial password: SURNAME (in ALL CAPS)
    must_change_password: True
- Guardian:
    username: child's surname (lowercase, e.g. moyo)
    initial password: SURNAME (in ALL CAPS)
    must_change_password: True
    multi-child support: parents with more than 1 child are linked to both children
- Staff:
    username: first_name (lowercase, unique)
    initial password: SURNAME (in ALL CAPS)
    must_change_password: True
"""
import io
import re
import uuid
from typing import Any, Dict, List, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ClassGroup, Student, StudentGuardian, User
from app.security import hash_password


def clean_str(val: Any) -> str:
    if val is None:
        return ""
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none", "null") else s


def normalize_col(name: str) -> str:
    s = re.sub(r"[^a-z0-9]", "", clean_str(name).lower())
    if s in ("firstname", "fname", "first"):
        return "first_name"
    if s in ("lastname", "surname", "sname", "last"):
        return "last_name"
    if s in ("fullname", "studentname", "learnername", "name"):
        return "full_name"
    if s in ("gender", "sex"):
        return "gender"
    if s in ("admissionno", "admno", "admission", "studentno", "regno"):
        return "admission_no"
    if s in ("class", "classname", "form", "grade", "stream"):
        return "class_name"
    if s in ("guardianname", "parentname", "guardian", "parent", "nextofkin"):
        return "guardian_name"
    if s in ("guardianphone", "parentphone", "phone", "contact", "cell", "guardiancell"):
        return "guardian_phone"
    if s in ("role", "designation", "position"):
        return "role"
    return s


def parse_names(first: str, last: str, full: str) -> Tuple[str, str]:
    first = clean_str(first)
    last = clean_str(last)
    if first and last:
        return first, last
    full = clean_str(full)
    if not full:
        return "", ""
    # Check if format is "SURNAME, Firstname"
    if "," in full:
        parts = [p.strip() for p in full.split(",", 1)]
        return parts[1], parts[0]
    parts = full.split()
    if len(parts) == 1:
        return parts[0], parts[0]
    return parts[0], " ".join(parts[1:])


def extract_rows_from_spreadsheet(raw_bytes: bytes, filename: str) -> List[Dict[str, str]]:
    import pandas as pd
    is_csv = filename.lower().endswith(".csv")
    if is_csv:
        df = pd.read_csv(io.BytesIO(raw_bytes), dtype=str)
    else:
        df = pd.read_excel(io.BytesIO(raw_bytes), dtype=str)
    df.fillna("", inplace=True)
    col_map = {col: normalize_col(col) for col in df.columns}
    df.rename(columns=col_map, inplace=True)
    records = []
    for r in df.to_dict("records"):
        first, last = parse_names(r.get("first_name", ""), r.get("last_name", ""), r.get("full_name", ""))
        if not first and not last:
            continue
        records.append({
            "first_name": first,
            "last_name": last,
            "gender": clean_str(r.get("gender", ""))[:1].upper(),
            "admission_no": clean_str(r.get("admission_no", "")).upper(),
            "class_name": clean_str(r.get("class_name", "")),
            "guardian_name": clean_str(r.get("guardian_name", "")),
            "guardian_phone": clean_str(r.get("guardian_phone", "")),
            "role": clean_str(r.get("role", "")).lower() or "student",
        })
    return records


def extract_rows_from_docx(raw_bytes: bytes) -> List[Dict[str, str]]:
    import docx
    doc = docx.Document(io.BytesIO(raw_bytes))
    records = []

    # Strategy 1: Check document tables
    for table in doc.tables:
        if len(table.rows) < 2:
            continue
        headers = [normalize_col(cell.text) for cell in table.rows[0].cells]
        for row in table.rows[1:]:
            values = [clean_str(cell.text) for cell in row.cells]
            r = dict(zip(headers, values))
            first, last = parse_names(r.get("first_name", ""), r.get("last_name", ""), r.get("full_name", ""))
            if not first and not last:
                continue
            records.append({
                "first_name": first,
                "last_name": last,
                "gender": clean_str(r.get("gender", ""))[:1].upper(),
                "admission_no": clean_str(r.get("admission_no", "")).upper(),
                "class_name": clean_str(r.get("class_name", "")),
                "guardian_name": clean_str(r.get("guardian_name", "")),
                "guardian_phone": clean_str(r.get("guardian_phone", "")),
                "role": clean_str(r.get("role", "")).lower() or "student",
            })

    # Strategy 2: If no tables found, parse lines of text
    if not records:
        for p in doc.paragraphs:
            line = p.text.strip()
            if not line or line.lower().startswith(("class", "st eric", "page", "form")):
                continue
            parts = re.split(r"[\t,|;]+", line)
            if len(parts) >= 2:
                first, last = parse_names(parts[0], parts[1], "")
                records.append({
                    "first_name": first,
                    "last_name": last,
                    "gender": parts[2][:1].upper() if len(parts) > 2 and parts[2][:1].upper() in ("M", "F") else "",
                    "admission_no": "",
                    "class_name": "",
                    "guardian_name": parts[3] if len(parts) > 3 else "",
                    "guardian_phone": parts[4] if len(parts) > 4 else "",
                    "role": "student",
                })
    return records


def extract_rows_from_pdf(raw_bytes: bytes) -> List[Dict[str, str]]:
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
    records = []
    for page in reader.pages:
        text = page.extract_text() or ""
        for line in text.split("\n"):
            line = line.strip()
            if not line or len(line) < 3:
                continue
            if any(k in line.lower() for k in ("st eric", "class list", "admission", "page", "signature")):
                continue
            # Try splitting by multiple spaces or tabs
            parts = [p.strip() for p in re.split(r"\s{2,}|\t|\|", line) if p.strip()]
            if len(parts) >= 2:
                # Format could be: [AdmNo, FullName, Gender, ...] or [Surname, Firstname, ...]
                first, last = parse_names(parts[0], parts[1], "")
                records.append({
                    "first_name": first,
                    "last_name": last,
                    "gender": parts[2][:1].upper() if len(parts) > 2 and parts[2][:1].upper() in ("M", "F") else "",
                    "admission_no": parts[0].upper() if re.match(r"^SE-|^[A-Z0-9]{3,}$", parts[0]) else "",
                    "class_name": "",
                    "guardian_name": parts[3] if len(parts) > 3 else "",
                    "guardian_phone": parts[4] if len(parts) > 4 else "",
                    "role": "student",
                })
    return records


def make_unique_username(db: Session, base: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]", "", base.lower()) or "user"
    candidate = cleaned
    count = 1
    while db.scalar(select(User.id).where(User.username == candidate)):
        count += 1
        candidate = f"{cleaned}{count}"
    return candidate


def process_bulk_import(
    db: Session,
    raw_bytes: bytes,
    filename: str,
    target_class_id: uuid.UUID | None = None,
    import_type: str = "students",  # "students" or "staff"
) -> Dict[str, Any]:
    fn = filename.lower()
    if fn.endswith((".xlsx", ".xls", ".csv")):
        rows = extract_rows_from_spreadsheet(raw_bytes, filename)
    elif fn.endswith((".docx", ".doc")):
        rows = extract_rows_from_docx(raw_bytes)
    elif fn.endswith(".pdf"):
        rows = extract_rows_from_pdf(raw_bytes)
    else:
        raise ValueError("Unsupported file format. Please upload .xlsx, .csv, .docx, or .pdf")

    if not rows:
        raise ValueError("No valid rows could be extracted from the file. Please check column format.")

    # Cache classes for easy lookup
    classes_by_name = {c.name.strip().lower(): c for c in db.scalars(select(ClassGroup).where(ClassGroup.status == "active"))}
    default_class = db.get(ClassGroup, target_class_id) if target_class_id else None

    # Track results
    created_users = []
    created_students = []
    linked_guardians = []
    errors = []

    for idx, r in enumerate(rows, start=1):
        first = r["first_name"].strip()
        last = r["last_name"].strip()
        if not first or not last:
            errors.append(f"Row {idx}: Missing first name or surname.")
            continue

        if import_type == "staff":
            # Create Staff Account
            uname = make_unique_username(db, first)
            initial_pw = last.upper()
            staff_user = User(
                username=uname,
                full_name=f"{first} {last}",
                role=r.get("role") if r.get("role") in ("teacher", "admin", "librarian") else "teacher",
                password_hash=hash_password(initial_pw),
                must_change_password=True,
                status="active",
            )
            db.add(staff_user)
            db.flush()
            created_users.append({
                "name": staff_user.full_name,
                "username": uname,
                "initial_password": initial_pw,
                "role": staff_user.role,
            })
            continue

        # ── 1. Create Student User Account ──
        student_uname = make_unique_username(db, first)
        student_initial_pw = last.upper()
        student_user = User(
            username=student_uname,
            full_name=f"{first} {last}",
            role="student",
            password_hash=hash_password(student_initial_pw),
            must_change_password=True,
            status="active",
        )
        db.add(student_user)
        db.flush()

        # ── 2. Create Student Record ──
        # Determine class
        cls_obj = default_class
        if r.get("class_name"):
            cls_obj = classes_by_name.get(r["class_name"].strip().lower(), default_class)

        # Determine admission number
        adm_no = r.get("admission_no")
        if not adm_no or db.scalar(select(Student.id).where(Student.admission_no == adm_no)):
            seq = (db.scalar(select(func.count(Student.id))) or 0) + idx
            adm_no = f"SE-2026-{seq:04d}"

        student = Student(
            user_id=student_user.id,
            admission_no=adm_no,
            first_name=first,
            last_name=last,
            gender=r.get("gender") if r.get("gender") in ("M", "F") else None,
            class_id=cls_obj.id if cls_obj else None,
            status="active",
        )
        db.add(student)
        db.flush()

        created_students.append({
            "name": student.full_name,
            "admission_no": student.admission_no,
            "class": cls_obj.name if cls_obj else "Unassigned",
            "username": student_uname,
            "initial_password": student_initial_pw,
        })

        # ── 3. Create or Link Guardian Account (Multi-child support) ──
        # Guardian username rule: child's surname lowercase (e.g. moyo)
        guardian_surname = last.strip().lower()
        guardian_phone = r.get("guardian_phone", "").strip() or None
        guardian_name = r.get("guardian_name", "").strip() or f"Guardian of {first} {last}"

        # Check if guardian with this surname or phone already exists
        existing_guardian = None
        if guardian_phone:
            existing_guardian = db.scalar(select(User).where(User.phone == guardian_phone, User.role == "parent"))
        if not existing_guardian:
            existing_guardian = db.scalar(select(User).where(User.username == guardian_surname, User.role == "parent"))

        if existing_guardian:
            # Reuse existing guardian account (multi-child linking!)
            if not db.scalar(select(StudentGuardian.id).where(
                StudentGuardian.student_id == student.id, StudentGuardian.user_id == existing_guardian.id
            )):
                db.add(StudentGuardian(
                    student_id=student.id,
                    user_id=existing_guardian.id,
                    relationship_type="parent",
                ))
            linked_guardians.append({
                "guardian_name": existing_guardian.full_name,
                "username": existing_guardian.username,
                "student": student.full_name,
                "reused": True,
            })
        else:
            # Create new guardian account
            guardian_uname = make_unique_username(db, guardian_surname)
            guardian_initial_pw = last.upper()
            guardian_user = User(
                username=guardian_uname,
                full_name=guardian_name,
                role="parent",
                phone=guardian_phone,
                password_hash=hash_password(guardian_initial_pw),
                must_change_password=True,
                status="active",
            )
            db.add(guardian_user)
            db.flush()

            db.add(StudentGuardian(
                student_id=student.id,
                user_id=guardian_user.id,
                relationship_type="parent",
            ))
            linked_guardians.append({
                "guardian_name": guardian_user.full_name,
                "username": guardian_uname,
                "initial_password": guardian_initial_pw,
                "student": student.full_name,
                "reused": False,
            })

    db.commit()
    return {
        "success": True,
        "import_type": import_type,
        "students_created": len(created_students),
        "users_created": len(created_users),
        "guardians_linked": len(linked_guardians),
        "errors": errors,
        "sample_accounts": created_students[:15] or created_users[:15],
    }
