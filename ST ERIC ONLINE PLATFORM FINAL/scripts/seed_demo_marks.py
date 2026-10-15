"""Seed sample assessment marks so top performers and reports show data in dev."""
import os, sys
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import SessionLocal
from app.models import Assessment, Mark, Student, Subject, ClassGroup, User
from app.grading import grade_for

db = SessionLocal()
teacher = db.query(User).filter(User.role == "teacher").first()
subjects = db.query(Subject).all()
students = db.query(Student).filter(Student.status == "active", Student.class_id.isnot(None)).all()

if not students or not subjects or not teacher:
    print("Missing prerequisites for seeding marks.")
    db.close()
    sys.exit(0)

existing_assessments = db.query(Assessment).count()
if existing_assessments > 0:
    print(f"Assessments already exist ({existing_assessments}).")
else:
    print(f"Creating sample assessments and marks for {len(students)} students across subjects...")
    classes_with_students = set(s.class_id for s in students)
    
    for cid in classes_with_students:
        c_students = [s for s in students if s.class_id == cid]
        cg = db.get(ClassGroup, cid)
        level = "A" if (cg and cg.form >= 5) else "O"

        for subj in subjects[:4]:
            asm = Assessment(
                class_id=cid,
                subject_id=subj.id,
                title=f"{subj.name} Mid-Term Test 1",
                kind="test",
                term=1,
                year=2026,
                max_marks=100.0,
                weight=1.0,
            )
            db.add(asm)
            db.flush()

            base_score = 65
            for idx, st in enumerate(c_students):
                score = min(96.0, max(42.0, base_score + (idx * 8) - 10))
                g = grade_for(score, level)
                mark = Mark(
                    assessment_id=asm.id,
                    student_id=st.id,
                    marks_obtained=float(score),
                    grade=g,
                    entered_by=teacher.id,
                )
                db.add(mark)

    db.commit()
    print("Sample assessments and marks created successfully!")

db.close()
