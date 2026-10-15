"""
Provision and fix all user accounts so that:
1. Every account (admin, hod, teacher, student, parent, librarian) has password 'admin123'.
2. Sample accounts referenced in the documentation and UI (st.001, teacher1..teacher8, parent1..parent5)
   exist, are active, and linked properly.
3. Every student in the database has a corresponding User account with username 'st.XXX' and their first name.
"""
import sys, os
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import SessionLocal
from app.models import User, Student, StudentGuardian
from app.security import hash_password, verify_password

def run():
    db = SessionLocal()
    pwd_hash = hash_password("admin123")

    # 1. Reset all existing users to admin123
    all_users = db.query(User).all()
    for u in all_users:
        u.password_hash = pwd_hash
        u.must_change_password = False
        u.status = "active"
    db.commit()
    print(f"1. Reset {len(all_users)} existing users to password 'admin123'.")

    # 2. Provision teacher1 .. teacher8
    teacher_configs = [
        ("teacher1", "Dr. C. Shumba", "Sciences"),
        ("teacher2", "Mrs M. Sibanda", "Languages"),
        ("teacher3", "Mr K. Ndlovu", "Humanities"),
        ("teacher4", "Mrs T. Chidzero", "Commercials"),
        ("teacher5", "Mr P. Moyo", "Sciences"),
        ("teacher6", "Mr J. Zvimba", "Practical Arts"),
        ("teacher7", "Mrs L. Gumbo", "Languages"),
        ("teacher8", "Mr N. Mpofu", "Commercials"),
    ]

    for uname, name, dept in teacher_configs:
        u = db.query(User).filter(User.username == uname).first()
        if not u:
            u = User(
                username=uname,
                full_name=name,
                role="teacher",
                department=dept,
                password_hash=pwd_hash,
                must_change_password=False,
                status="active"
            )
            db.add(u)
        else:
            u.full_name = name
            u.role = "teacher"
            u.department = dept
            u.password_hash = pwd_hash
            u.must_change_password = False
            u.status = "active"
    db.commit()
    print("2. Teacher accounts teacher1..teacher8 verified.")

    # 3. Provision Student accounts (st.001, st.002, ...)
    students = db.query(Student).filter(Student.status == "active").order_by(Student.admission_no).all()
    print(f"3. Active students in database: {len(students)}")

    for i, s in enumerate(students):
        st_num = i + 1
        st_uname = f"st.{st_num:03d}"  # e.g. st.001
        
        # Username by st.XXX
        u = db.query(User).filter(User.username == st_uname).first()
        if not u:
            u = User(
                username=st_uname,
                full_name=f"{s.first_name} {s.last_name}",
                role="student",
                password_hash=pwd_hash,
                must_change_password=False,
                status="active"
            )
            db.add(u)
            db.flush()
        else:
            u.full_name = f"{s.first_name} {s.last_name}"
            u.role = "student"
            u.password_hash = pwd_hash
            u.status = "active"

        # Explicitly link student record to user account
        s.user_id = u.id

        # Also create first-name username e.g. tinashe, chipo if not already taken
        fn_uname = s.first_name.lower().strip()
        fn_u = db.query(User).filter(User.username == fn_uname).first()
        if not fn_u:
            fn_u = User(
                username=fn_uname,
                full_name=f"{s.first_name} {s.last_name}",
                role="student",
                password_hash=pwd_hash,
                must_change_password=False,
                status="active"
            )
            db.add(fn_u)
            db.flush()

    db.commit()
    print("4. Student user accounts provisioned and synced.")

    # 4. Provision parent accounts parent1 .. parent5 linked to first 5 students
    for i in range(1, 6):
        p_uname = f"parent{i}"
        target_student = students[i - 1] if i <= len(students) else None
        target_surname = target_student.last_name if target_student else "Guardian"
        
        p_u = db.query(User).filter(User.username == p_uname).first()
        if not p_u:
            p_u = User(
                username=p_uname,
                full_name=f"Mr/Mrs {target_surname}",
                role="parent",
                phone=f"+26377100000{i}",
                password_hash=pwd_hash,
                must_change_password=False,
                status="active"
            )
            db.add(p_u)
            db.flush()
        else:
            p_u.full_name = f"Mr/Mrs {target_surname}"
            p_u.role = "parent"
            p_u.password_hash = pwd_hash
            p_u.status = "active"

        if target_student:
            link = db.query(StudentGuardian).filter(
                StudentGuardian.student_id == target_student.id,
                StudentGuardian.user_id == p_u.id
            ).first()
            if not link:
                db.add(StudentGuardian(student_id=target_student.id, user_id=p_u.id))

    db.commit()
    print("5. Parent accounts parent1..parent5 provisioned and linked.")
    db.close()
    print("\nPROVISIONING COMPLETE! All users have password 'admin123'.")

if __name__ == "__main__":
    run()
