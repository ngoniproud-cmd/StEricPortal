"""Populate complete ZIMSEC subjects (including report card list),
HOD user accounts, teachers by department, and at least 20 students."""
import os, sys, uuid
from datetime import date
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db import SessionLocal
from app.models import User, Subject, Student, StudentGuardian, ClassGroup, TeacherAssignment, Assessment, Mark
from app.security import hash_password
from app.grading import grade_for

db = SessionLocal()

print("1. Seeding / Updating Subjects from Report Card & Common ZIMSEC syllabus...")
SUBJECTS_DATA = [
    # O-Level Languages
    ("English Language", "4005", "O", "Languages"),
    ("Literature in English", "2013", "O", "Humanities"),
    ("Shona", "3159", "O", "Languages"),
    ("Ndebele", "3155", "O", "Languages"),

    # O-Level Sciences & Math
    ("Mathematics", "4004", "O", "Sciences"),
    ("Additional Mathematics", "4034", "O", "Sciences"),
    ("Combined Science", "4003", "O", "Sciences"),
    ("Physical Science / Physics", "5054", "O", "Sciences"),
    ("Chemistry", "5070", "O", "Sciences"),
    ("Biology", "5090", "O", "Sciences"),
    ("Computer Science", "7014", "O", "Sciences"),

    # O-Level Humanities
    ("Geography", "2248", "O", "Humanities"),
    ("History", "2167", "O", "Humanities"),
    ("Family & Religious Studies", "2046", "O", "Humanities"),
    ("Heritage Studies", "4006", "O", "Humanities"),

    # O-Level Commercials
    ("Commerce", "7103", "O", "Commercials"),
    ("Principles of Accounting", "7112", "O", "Commercials"),
    ("Economics", "2281", "O", "Commercials"),
    ("Business Enterprise Skills", "4048", "O", "Commercials"),

    # O-Level Practical / Voc Tech
    ("Agriculture", "5038", "O", "Practical Arts"),
    ("Building Technology & Design", "6043", "O", "Practical Arts"),
    ("Technical Graphics & Design", "6042", "O", "Practical Arts"),
    ("Textile Technology & Design", "6050", "O", "Practical Arts"),
    ("Food Technology & Design", "6064", "O", "Practical Arts"),
    ("Metal Technology & Design", "6040", "O", "Practical Arts"),
    ("Wood Technology & Design", "6045", "O", "Practical Arts"),
    ("Music", "6020", "O", "Practical Arts"),
    ("Art & Design", "6015", "O", "Practical Arts"),
    ("Physical Education", "6080", "O", "Practical Arts"),

    # A-Level Sciences
    ("Pure Mathematics", "6042", "A", "Sciences"),
    ("Statistics", "9165", "A", "Sciences"),
    ("Physics", "6032", "A", "Sciences"),
    ("Chemistry", "6028", "A", "Sciences"),
    ("Biology", "6030", "A", "Sciences"),
    ("Computer Science", "6023", "A", "Sciences"),

    # A-Level Commercials
    ("Accounting", "6001", "A", "Commercials"),
    ("Economics", "6003", "A", "Commercials"),
    ("Management of Business", "6002", "A", "Commercials"),

    # A-Level Humanities & Languages
    ("Geography", "6004", "A", "Humanities"),
    ("History", "6006", "A", "Humanities"),
    ("Literature in English", "6014", "A", "Humanities"),
    ("Divinity", "6016", "A", "Humanities"),
    ("Shona", "6010", "A", "Languages"),

    # A-Level Practical
    ("Crop Science", "6026", "A", "Practical Arts"),
    ("Animal Science", "6027", "A", "Practical Arts"),
]

for name, code, lvl, dept in SUBJECTS_DATA:
    existing = db.query(Subject).filter(Subject.name == name, Subject.level == lvl).first()
    if existing:
        existing.zimsec_code = code
        existing.department = dept
        existing.status = "active"
    else:
        db.add(Subject(name=name, zimsec_code=code, level=lvl, department=dept, status="active"))

db.commit()
print("Subjects seeded successfully.")

print("2. Seeding HOD Accounts & Teachers by Department...")
HODS_DATA = [
    ("hod.sciences", "Dr. C. Shumba", "hod", "Sciences", "+263771000101"),
    ("hod.commercials", "Mrs. T. Mutasa", "hod", "Commercials", "+263771000102"),
    ("hod.humanities", "Mr. K. Marufu", "hod", "Humanities", "+263771000103"),
    ("hod.languages", "Mrs. R. Chikwanha", "hod", "Languages", "+263771000104"),
    ("hod.voctech", "Mr. B. Zvimba", "hod", "Practical Arts", "+263771000105"),
]

for uname, fname, role, dept, phone in HODS_DATA:
    u = db.query(User).filter(User.username == uname).first()
    if not u:
        u = User(
            username=uname,
            full_name=fname,
            role=role,
            department=dept,
            phone=phone,
            password_hash=hash_password("admin123"),
            must_change_password=False,
            status="active",
        )
        db.add(u)
    else:
        u.role = role
        u.department = dept
        u.full_name = fname
        u.must_change_password = False

TEACHERS_DEPT = [
    ("mrmoyo", "Mr P. Moyo", "Sciences"),
    ("mrsncube", "Mrs S. Ncube", "Commercials"),
    ("mrdube", "Mr T. Dube", "Humanities"),
    ("mschikwanha", "Ms A. Chikwanha", "Languages"),
    ("mrzvimba", "Mr J. Zvimba", "Practical Arts"),
    ("mrshumba", "Mr E. Shumba", "Sciences"),
    ("mrsgumbo", "Mrs L. Gumbo", "Languages"),
    ("mrmpofu", "Mr N. Mpofu", "Commercials"),
]

for uname, fname, dept in TEACHERS_DEPT:
    u = db.query(User).filter(User.username == uname).first()
    if not u:
        u = User(
            username=uname,
            full_name=fname,
            role="teacher",
            department=dept,
            password_hash=hash_password("teacher123"),
            must_change_password=False,
            status="active",
        )
        db.add(u)
    else:
        u.department = dept
        u.role = "teacher"

db.commit()
print("HOD and Teacher accounts provisioned.")

print("3. Ensuring at least 20 students in the database...")
# Find active classes
c1A = db.query(ClassGroup).filter(ClassGroup.name == "1A", ClassGroup.year == 2026).first()
c1B = db.query(ClassGroup).filter(ClassGroup.name == "1B", ClassGroup.year == 2026).first()
c2A = db.query(ClassGroup).filter(ClassGroup.name == "2A", ClassGroup.year == 2026).first()
c2B = db.query(ClassGroup).filter(ClassGroup.name == "2B", ClassGroup.year == 2026).first()
c3A = db.query(ClassGroup).filter(ClassGroup.name == "3A", ClassGroup.year == 2026).first()
c4A = db.query(ClassGroup).filter(ClassGroup.name == "4A", ClassGroup.year == 2026).first()
c5Sci = db.query(ClassGroup).filter(ClassGroup.name.like("%5 Sciences%"), ClassGroup.year == 2026).first()
c6Sci = db.query(ClassGroup).filter(ClassGroup.name.like("%6 Sciences%"), ClassGroup.year == 2026).first()

if not c1A or not c2A:
    print("Warning: classes 1A or 2A missing, using any available classes.")
    all_c = db.query(ClassGroup).filter(ClassGroup.status == "active").all()
    c_pool = all_c[:8] if len(all_c) >= 8 else all_c
else:
    c_pool = [c1A, c1B, c2A, c2B, c3A, c4A, c5Sci or c1A, c6Sci or c1B]

STUDENTS_DATA = [
    # Form 1
    ("ST2026001", "Tinashe", "Moyo", "M", date(2012, 3, 14), c_pool[0].id),
    ("ST2026002", "Chipo", "Sibanda", "F", date(2012, 7, 21), c_pool[0].id),
    ("ST2026003", "Farai", "Ncube", "M", date(2012, 1, 9), c_pool[0].id),
    ("ST2026004", "Nyasha", "Gumbo", "F", date(2012, 11, 30), c_pool[1].id),
    ("ST2026005", "Kudzai", "Mutasa", "M", date(2012, 5, 18), c_pool[1].id),
    # Form 2
    ("ST2026006", "Ruvimbo", "Chidzero", "F", date(2011, 4, 12), c_pool[2].id),
    ("ST2026007", "Tendai", "Mpofu", "M", date(2011, 8, 25), c_pool[2].id),
    ("ST2026008", "Tafadzwa", "Zhou", "M", date(2011, 2, 14), c_pool[2].id),
    ("ST2026009", "Anesu", "Chikwanha", "F", date(2011, 9, 3), c_pool[3].id),
    ("ST2026010", "Simbarashe", "Dube", "M", date(2011, 12, 19), c_pool[3].id),
    # Form 3
    ("ST2026011", "Blessing", "Moyo", "M", date(2010, 6, 22), c_pool[4].id),
    ("ST2026012", "Tanatswa", "Marufu", "F", date(2010, 10, 11), c_pool[4].id),
    ("ST2026013", "Munashe", "Zvimba", "M", date(2010, 3, 5), c_pool[4].id),
    ("ST2026014", "Vimbai", "Shumba", "F", date(2010, 7, 17), c_pool[4].id),
    # Form 4
    ("ST2026015", "Panashe", "Ncube", "M", date(2009, 5, 29), c_pool[5].id),
    ("ST2026016", "Tatenda", "Sibanda", "F", date(2009, 9, 14), c_pool[5].id),
    ("ST2026017", "Takudzwa", "Gumbo", "M", date(2009, 1, 20), c_pool[5].id),
    ("ST2026018", "Natsai", "Chidzero", "F", date(2009, 11, 8), c_pool[5].id),
    # Form 5 (A-Level)
    ("ST2026019", "Rutendo", "Mutasa", "F", date(2008, 4, 16), c_pool[6].id),
    ("ST2026020", "Chengetai", "Mpofu", "M", date(2008, 8, 23), c_pool[6].id),
    ("ST2026021", "Gamuchirai", "Zhou", "F", date(2008, 12, 1), c_pool[6].id),
    # Form 6 (A-Level)
    ("ST2026022", "Kudakwashe", "Dube", "M", date(2007, 2, 28), c_pool[7].id),
    ("ST2026023", "Shingirai", "Moyo", "M", date(2007, 6, 15), c_pool[7].id),
    ("ST2026024", "Tariro", "Shumba", "F", date(2007, 10, 9), c_pool[7].id),
]

for adm, fname, lname, gender, dob, cid in STUDENTS_DATA:
    st = db.query(Student).filter(Student.admission_no == adm).first()
    if not st:
        st = Student(
            admission_no=adm,
            first_name=fname,
            last_name=lname,
            gender=gender,
            date_of_birth=dob,
            class_id=cid,
            status="active"
        )
        db.add(st)
        db.flush()

        # Link a parent account
        p_uname = f"parent_{lname.lower()}_{adm[-3:]}"
        parent = db.query(User).filter(User.username == p_uname).first()
        if not parent:
            parent = User(
                username=p_uname,
                full_name=f"Mr/Mrs {lname}",
                role="parent",
                phone=f"+26377{adm[-3:]}1234",
                password_hash=hash_password(lname.upper()),
                must_change_password=True,
                status="active"
            )
            db.add(parent)
            db.flush()
        db.add(StudentGuardian(student_id=st.id, user_id=parent.id))
    else:
        st.class_id = cid
        st.status = "active"

db.commit()

total_students = db.query(Student).filter(Student.status == "active").count()
print(f"Total active students in database: {total_students}")

print("4. Setting up initial Teacher Assignments across departments...")
# Assign science teachers to subjects
sci_teacher = db.query(User).filter(User.username == "mrmoyo").first()
com_teacher = db.query(User).filter(User.username == "mrsncube").first()
hum_teacher = db.query(User).filter(User.username == "mrdube").first()
lang_teacher = db.query(User).filter(User.username == "mschikwanha").first()

math_s = db.query(Subject).filter(Subject.name == "Mathematics", Subject.level == "O").first()
eng_s = db.query(Subject).filter(Subject.name == "English Language", Subject.level == "O").first()
sci_s = db.query(Subject).filter(Subject.name == "Combined Science", Subject.level == "O").first()
acc_s = db.query(Subject).filter(Subject.name == "Principles of Accounting", Subject.level == "O").first()
geo_s = db.query(Subject).filter(Subject.name == "Geography", Subject.level == "O").first()

sample_tas = [
    (sci_teacher, c_pool[0], math_s),
    (sci_teacher, c_pool[0], sci_s),
    (lang_teacher, c_pool[0], eng_s),
    (com_teacher, c_pool[0], acc_s),
    (hum_teacher, c_pool[0], geo_s),
    (sci_teacher, c_pool[1], math_s),
    (lang_teacher, c_pool[1], eng_s),
    (sci_teacher, c_pool[2], math_s),
    (com_teacher, c_pool[2], acc_s),
]

for t, c, s in sample_tas:
    if t and c and s:
        existing_ta = db.query(TeacherAssignment).filter(
            TeacherAssignment.teacher_id == t.id,
            TeacherAssignment.class_id == c.id,
            TeacherAssignment.subject_id == s.id
        ).first()
        if not existing_ta:
            db.add(TeacherAssignment(teacher_id=t.id, class_id=c.id, subject_id=s.id))

db.commit()
print("Teacher assignments updated.")
db.close()
print("Done!")
