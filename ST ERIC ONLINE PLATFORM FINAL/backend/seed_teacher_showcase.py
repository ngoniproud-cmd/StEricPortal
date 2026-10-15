"""
Seed showcase data for Mr Moyo (and teacher1) so the teacher dashboard,
My Class tab, mark entry, timetable, register, and rankings are 100% complete and populated.
"""
import uuid
from datetime import date, timedelta
from app.db import SessionLocal
from app.models import (
    User, ClassGroup, Subject, TeacherAssignment, Student, StudentGuardian,
    Assessment, Mark, TimetableSlot, Attendance, ReportComment
)
from app.grading import level_for_form, grade_for, percentage
from app.routers.marks import bands_for
from app.security import hash_password

def seed():
    db = SessionLocal()
    try:
        # Find mrmoyo and teacher1
        mrmoyo = db.query(User).filter(User.username == "mrmoyo").first()
        if not mrmoyo:
            print("mrmoyo user not found!")
            return

        # 1. Assign mrmoyo as Class Teacher of Form 1A
        c1a = db.query(ClassGroup).filter(ClassGroup.name == "1A").first()
        if not c1a:
            c1a = ClassGroup(name="1A", form=1, year=2026, status="active")
            db.add(c1a)
            db.flush()
        c1a.class_teacher_id = mrmoyo.id
        c1a.status = "active"

        # Also assign teacher1 as Class Teacher of 2A
        teacher1 = db.query(User).filter(User.username == "teacher1").first()
        c2a = db.query(ClassGroup).filter(ClassGroup.name == "2A").first()
        if teacher1 and c2a:
            c2a.class_teacher_id = teacher1.id
            c2a.status = "active"

        db.commit()
        print(f"Assigned mrmoyo as Class Teacher of {c1a.name}")

        # 2. Ensure Class 1A has a full, realistic roster (10 students)
        sample_students_1a = [
            ("SE-2026-0001", "Tinashe", "Moyo", "M", "Mr. P. Moyo", "+263771234567"),
            ("SE-2026-0002", "Chipo", "Sibanda", "F", "Mrs. R. Sibanda", "+263772345678"),
            ("SE-2026-0003", "Farai", "Ncube", "M", "Mr. K. Ncube", "+263773456789"),
            ("SE-2026-0004", "Ruvimbo", "Chidzero", "F", "Mrs. T. Chidzero", "+263774567890"),
            ("SE-2026-0005", "Tendai", "Gumbo", "M", "Mr. L. Gumbo", "+263775678901"),
            ("SE-2026-0006", "Nyasha", "Mhlanga", "F", "Mrs. E. Mhlanga", "+263776789012"),
            ("SE-2026-0007", "Kudzai", "Mutasa", "M", "Mr. D. Mutasa", "+263777890123"),
            ("SE-2026-0008", "Tariro", "Dube", "F", "Mrs. S. Dube", "+263778901234"),
            ("SE-2026-0009", "Simbarashe", "Zvimba", "M", "Mr. J. Zvimba", "+263779012345"),
            ("SE-2026-0010", "Anesu", "Chikwanha", "F", "Ms. M. Chikwanha", "+263770123456"),
        ]

        students_1a_objs = []
        for adm, fn, ln, g, g_name, g_phone in sample_students_1a:
            s = db.query(Student).filter(Student.admission_no == adm).first()
            if not s:
                s = Student(
                    admission_no=adm,
                    first_name=fn,
                    last_name=ln,
                    gender=g,
                    class_id=c1a.id,
                    status="active"
                )
                db.add(s)
                db.flush()
            else:
                s.class_id = c1a.id
                s.status = "active"
                db.flush()
            students_1a_objs.append(s)

            # Link guardian
            if not db.query(StudentGuardian).filter(StudentGuardian.student_id == s.id).first():
                g_user = db.query(User).filter(User.phone == g_phone).first()
                if not g_user:
                    g_user = User(
                        username=f"parent.{adm.lower().replace('-', '.')}",
                        password_hash=hash_password("admin123"),
                        full_name=g_name,
                        role="parent",
                        phone=g_phone,
                        status="active"
                    )
                    db.add(g_user)
                    db.flush()
                db.add(StudentGuardian(student_id=s.id, user_id=g_user.id, relationship_type="Guardian"))

        db.commit()
        print(f"Ensured {len(students_1a_objs)} active students in 1A")

        # 3. Ensure Teaching Assignments for mrmoyo:
        # - 1A: Mathematics & Combined Science
        # - 2A: Mathematics
        # - 3A: Mathematics
        # - 4A: Mathematics
        subj_math = db.query(Subject).filter(Subject.name == "Mathematics").first()
        subj_sci = db.query(Subject).filter(Subject.name == "Combined Science").first()
        subj_eng = db.query(Subject).filter(Subject.name == "English Language").first()
        subj_shona = db.query(Subject).filter(Subject.name == "Shona").first()
        subj_geo = db.query(Subject).filter(Subject.name == "Geography").first()
        subj_hist = db.query(Subject).filter(Subject.name == "History").first()

        classes_target = [
            (c1a, subj_math, mrmoyo),
            (c1a, subj_sci, mrmoyo),
            (db.query(ClassGroup).filter(ClassGroup.name == "2A").first(), subj_math, mrmoyo),
            (db.query(ClassGroup).filter(ClassGroup.name == "3A").first(), subj_math, mrmoyo),
            (db.query(ClassGroup).filter(ClassGroup.name == "4A").first(), subj_math, mrmoyo),
        ]

        # Other teachers teaching 1A
        other_teachers = db.query(User).filter(User.role == "teacher", User.id != mrmoyo.id).all()
        t_eng = other_teachers[0] if other_teachers else mrmoyo
        t_shona = other_teachers[1] if len(other_teachers) > 1 else mrmoyo
        t_geo = other_teachers[2] if len(other_teachers) > 2 else mrmoyo

        if subj_eng: classes_target.append((c1a, subj_eng, t_eng))
        if subj_shona: classes_target.append((c1a, subj_shona, t_shona))
        if subj_geo: classes_target.append((c1a, subj_geo, t_geo))

        for k, s, t in classes_target:
            if k and s and t:
                exists = db.query(TeacherAssignment).filter(
                    TeacherAssignment.teacher_id == t.id,
                    TeacherAssignment.class_id == k.id,
                    TeacherAssignment.subject_id == s.id
                ).first()
                if not exists:
                    db.add(TeacherAssignment(teacher_id=t.id, class_id=k.id, subject_id=s.id))

        db.commit()
        print("Updated teaching assignments for mrmoyo and 1A")

        # 4. Create Assessments and Marks for 1A across subjects:
        # Mathematics: Weekly Revision Test 1 (max 50), Weekly Revision Test 2 (max 50), End of Term Exam (Paper 1, max 100)
        # Science: Revision Test 1 (max 40), End of Term Exam (Paper 1, max 100)
        # English: End of Term Exam (Paper 1, max 100)
        # Shona: End of Term Exam (Paper 1, max 100)
        # Geography: End of Term Exam (Paper 1, max 100)
        assessments_to_create = [
            (c1a, subj_math, "Weekly Revision Test 1", "test", 1, 2026, 50, 1.0),
            (c1a, subj_math, "Weekly Revision Test 2", "test", 1, 2026, 50, 1.0),
            (c1a, subj_math, "End of Term Exam (Paper 1)", "exam", 1, 2026, 100, 2.0),
            (c1a, subj_sci, "Weekly Revision Test 1", "test", 1, 2026, 40, 1.0),
            (c1a, subj_sci, "End of Term Exam (Paper 1)", "exam", 1, 2026, 100, 2.0),
            (c1a, subj_eng, "End of Term Exam (Paper 1)", "exam", 1, 2026, 100, 2.0),
            (c1a, subj_shona, "End of Term Exam (Paper 1)", "exam", 1, 2026, 100, 2.0),
            (c1a, subj_geo, "End of Term Exam (Paper 1)", "exam", 1, 2026, 100, 2.0),
        ]

        # Preset student scores so ranking looks realistic and distinct
        sample_scores = [
            # Tinashe Moyo
            [46, 48, 92, 38, 95, 88, 85, 90],
            # Chipo Sibanda
            [44, 45, 89, 36, 91, 92, 89, 87],
            # Farai Ncube
            [42, 40, 84, 34, 86, 78, 80, 82],
            # Ruvimbo Chidzero
            [39, 41, 79, 32, 80, 85, 82, 84],
            # Tendai Gumbo
            [36, 38, 74, 30, 75, 72, 75, 78],
            # Nyasha Mhlanga
            [35, 34, 70, 28, 72, 76, 74, 70],
            # Kudzai Mutasa
            [32, 30, 65, 25, 68, 65, 70, 66],
            # Tariro Dube
            [30, 28, 60, 24, 62, 60, 65, 62],
            # Simbarashe Zvimba
            [28, 25, 55, 20, 58, 55, 60, 54],
            # Anesu Chikwanha
            [24, 22, 48, 18, 50, 52, 55, 48],
        ]

        created_assessments = []
        for klass, subj, title, kind, term, year, max_m, weight in assessments_to_create:
            if not subj: continue
            a = db.query(Assessment).filter(
                Assessment.class_id == klass.id,
                Assessment.subject_id == subj.id,
                Assessment.title == title,
                Assessment.term == term,
                Assessment.year == year
            ).first()
            if not a:
                a = Assessment(
                    class_id=klass.id,
                    subject_id=subj.id,
                    title=title,
                    kind=kind,
                    term=term,
                    year=year,
                    max_marks=max_m,
                    weight=weight
                )
                db.add(a)
                db.flush()
            created_assessments.append(a)

        db.commit()

        # Insert marks for each student
        bands = bands_for(db, "O")
        for s_idx, student in enumerate(students_1a_objs):
            for a_idx, assessment in enumerate(created_assessments):
                mark_val = sample_scores[s_idx][a_idx]
                pct = percentage(mark_val, assessment.max_marks)
                g = grade_for(pct, "O", bands)
                m = db.query(Mark).filter(
                    Mark.assessment_id == assessment.id,
                    Mark.student_id == student.id
                ).first()
                if not m:
                    m = Mark(
                        assessment_id=assessment.id,
                        student_id=student.id,
                        marks_obtained=mark_val,
                        grade=g,
                        absent=False,
                        entered_by=mrmoyo.id
                    )
                    db.add(m)
                else:
                    m.marks_obtained = mark_val
                    m.grade = g
                    m.absent = False

        db.commit()
        print("Seeded marks for all 10 students across all 8 assessments in 1A")

        # 5. Seed Attendance Register for 1A for this week (Monday to Friday)
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        for day_offset in range(5):
            cur_day = monday + timedelta(days=day_offset)
            for s_idx, student in enumerate(students_1a_objs):
                # Anesu absent on Thursday, Kudzai late on Tuesday
                status = "present"
                if day_offset == 3 and s_idx == 9:
                    status = "absent"
                elif day_offset == 1 and s_idx == 6:
                    status = "late"

                att = db.query(Attendance).filter(
                    Attendance.student_id == student.id,
                    Attendance.day == cur_day
                ).first()
                if not att:
                    att = Attendance(
                        student_id=student.id,
                        day=cur_day,
                        status=status,
                        marked_by=mrmoyo.id
                    )
                    db.add(att)

        db.commit()
        print("Seeded weekly attendance register for 1A")

        # 6. Seed Timetable for 1A (Mon-Fri, periods 1-7)
        periods_spec = [
            # Monday
            (1, 1, subj_math, mrmoyo, "08:00 - 08:45"),
            (1, 2, subj_math, mrmoyo, "08:45 - 09:30"),
            (1, 3, subj_eng, t_eng, "09:45 - 10:30"),
            (1, 4, subj_sci, mrmoyo, "10:30 - 11:15"),
            (1, 5, subj_shona, t_shona, "11:30 - 12:15"),
            (1, 6, subj_geo, t_geo, "12:15 - 13:00"),
            (1, 7, subj_hist, mrmoyo, "14:00 - 14:45"),
            # Tuesday
            (2, 1, subj_eng, t_eng, "08:00 - 08:45"),
            (2, 2, subj_sci, mrmoyo, "08:45 - 09:30"),
            (2, 3, subj_math, mrmoyo, "09:45 - 10:30"),
            (2, 4, subj_geo, t_geo, "10:30 - 11:15"),
            (2, 5, subj_shona, t_shona, "11:30 - 12:15"),
            (2, 6, subj_sci, mrmoyo, "12:15 - 13:00"),
            # Wednesday
            (3, 1, subj_math, mrmoyo, "08:00 - 08:45"),
            (3, 2, subj_math, mrmoyo, "08:45 - 09:30"),
            (3, 3, subj_sci, mrmoyo, "09:45 - 10:30"),
            (3, 4, subj_eng, t_eng, "10:30 - 11:15"),
            (3, 5, subj_hist, mrmoyo, "11:30 - 12:15"),
            (3, 6, subj_shona, t_shona, "12:15 - 13:00"),
            # Thursday
            (4, 1, subj_sci, mrmoyo, "08:00 - 08:45"),
            (4, 2, subj_geo, t_geo, "08:45 - 09:30"),
            (4, 3, subj_eng, t_eng, "09:45 - 10:30"),
            (4, 4, subj_math, mrmoyo, "10:30 - 11:15"),
            (4, 5, subj_shona, t_shona, "11:30 - 12:15"),
            # Friday
            (5, 1, subj_math, mrmoyo, "08:00 - 08:45"),
            (5, 2, subj_sci, mrmoyo, "08:45 - 09:30"),
            (5, 3, subj_eng, t_eng, "09:45 - 10:30"),
            (5, 4, subj_hist, mrmoyo, "10:30 - 11:15"),
            (5, 5, subj_geo, t_geo, "11:30 - 12:15"),
        ]

        for day_num, period_num, subj_obj, teacher_obj, time_str in periods_spec:
            if not subj_obj: continue
            slot = db.query(TimetableSlot).filter(
                TimetableSlot.class_id == c1a.id,
                TimetableSlot.day == day_num,
                TimetableSlot.period == period_num
            ).first()
            if not slot:
                slot = TimetableSlot(
                    class_id=c1a.id,
                    subject_id=subj_obj.id,
                    teacher_id=teacher_obj.id if teacher_obj else None,
                    day=day_num,
                    period=period_num,
                    time_range=time_str
                )
                db.add(slot)
            else:
                slot.subject_id = subj_obj.id
                slot.teacher_id = teacher_obj.id if teacher_obj else None
                slot.time_range = time_str

        db.commit()
        print("Seeded full weekly timetable for 1A")

        # 7. Add Report Comments for 1A
        for s in students_1a_objs:
            rc = db.query(ReportComment).filter(
                ReportComment.student_id == s.id,
                ReportComment.term == 1,
                ReportComment.year == 2026
            ).first()
            if not rc:
                db.add(ReportComment(
                    student_id=s.id,
                    term=1,
                    year=2026,
                    class_teacher_comment="A very disciplined and hardworking learner who shows great enthusiasm for school.",
                    head_comment="Commendable academic effort. Keep aiming higher.",
                    published=False # So the class teacher can publish!
                ))

        db.commit()
        print("Seeded report comments for 1A")
        print("ALL SHOWCASE DATA SUCCESSFULLY SEEDED!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
