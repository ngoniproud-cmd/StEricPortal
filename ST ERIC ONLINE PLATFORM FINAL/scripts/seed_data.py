"""Seed data for development. Creates admin + sample school structure.
Run with: cd backend && python -m scripts.seed_data"""
import sys, os
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import settings
from app.db import engine, SessionLocal
from app.models import Base, User, ClassGroup, Subject, TeacherAssignment
from app.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(User).first():
    print("Database already has data. Skipping seed.")
    sys.exit(0)

# admin
admin = User(username="admin", full_name="Headmaster", role="admin",
             password_hash=hash_password("admin123"), must_change_password=True)
db.add(admin)

# teachers
teachers = []
for name in ["Mr Moyo", "Mrs Ncube", "Mr Dube", "Ms Chikwanha", "Mr Zvimba"]:
    t = User(username=name.lower().replace(" ", ".").replace(".", ""),
             full_name=name, role="teacher",
             password_hash=hash_password("teacher123"), must_change_password=True)
    db.add(t)
    teachers.append(t)
db.flush()

# subjects
subjects = {}
for name, level in [("English Language", "O"), ("Mathematics", "O"), ("Shona", "O"),
                    ("Combined Science", "O"), ("Geography", "O"), ("History", "O"),
                    ("Commerce", "O"), ("Agriculture", "O")]:
    s = Subject(name=name, level=level)
    db.add(s)
    subjects[name] = s
db.flush()

# classes: Form 1-4 streams A to H, Form 5 & 6 Sciences, Commercials, Arts
year = 2026
classes = []
for form in (1, 2, 3, 4):
    for stream in ("A", "B", "C", "D", "E", "F", "G", "H"):
        c = ClassGroup(name=f"{form}{stream}", form=form, year=year, class_teacher_id=teachers[len(classes) % len(teachers)].id)
        db.add(c)
        classes.append(c)

for form in (5, 6):
    for stream in ("Sciences A", "Sciences B", "Commercials A", "Commercials B", "Arts"):
        c = ClassGroup(name=f"{form} {stream}", form=form, year=year, class_teacher_id=teachers[len(classes) % len(teachers)].id)
        db.add(c)
        classes.append(c)
db.flush()

# assign teachers to subjects in classes
for c in classes:
    for i, sname in enumerate(subjects):
        ta = TeacherAssignment(teacher_id=teachers[i % len(teachers)].id,
                               class_id=c.id, subject_id=subjects[sname].id)
        db.add(ta)

# librarian
lib = User(username="librarian", full_name="Mrs Marufu", role="librarian",
           password_hash=hash_password("librarian123"), must_change_password=True)
db.add(lib)

# sample students for Form 1 and Form 4
from app.models import Student
students = []
first_names = ["Kudzai", "Tariro", "Farai", "Nyasha", "Tendai", "Tinashe", "Ruvimbo", "Chipo"]
last_names = ["Moyo", "Ncube", "Sibanda", "Gumbo", "Chidzero", "Mutasa", "Mpofu", "Zhou"]

for i in range(8):
    c = classes[0] if i < 4 else classes[-1]  # 1 Blue or 4 Gold
    st = Student(
        admission_no=f"ST2026{i+1:03d}",
        first_name=first_names[i],
        last_name=last_names[i],
        gender="M" if i % 2 == 0 else "F",
        class_id=c.id,
        status="active"
    )
    db.add(st)
    students.append(st)

db.commit()
print(f"Seeded: 1 admin, 1 librarian, {len(teachers)} teachers, {len(subjects)} subjects, {len(classes)} classes, {len(students)} learners.")
print("Logins: admin / admin123 | librarian / librarian123 | mr.moyo / teacher123 (all passwords must change on first sign-in)")
db.close()
