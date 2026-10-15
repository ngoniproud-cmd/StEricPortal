"""
Seed additional students, assessments, and marks for other classes taught by Mr Moyo (1B, 2A, 3A, 4A)
so the 'Other Classes I Teach' tab has rich data ready to view and edit.
"""
from app.db import SessionLocal
from app.models import User, ClassGroup, Subject, TeacherAssignment, Student, Assessment, Mark
from app.grading import level_for_form, grade_for, percentage
from app.routers.marks import bands_for

def seed():
    db = SessionLocal()
    try:
        mrmoyo = db.query(User).filter(User.username == "mrmoyo").first()
        subj_math = db.query(Subject).filter(Subject.name == "Mathematics").first()
        subj_sci = db.query(Subject).filter(Subject.name == "Combined Science").first()

        classes_spec = [
            ("1B", 1, [
                ("SE-2026-0021", "Blessing", "Ncube", "M"),
                ("SE-2026-0022", "Grace", "Mathe", "F"),
                ("SE-2026-0023", "Takudzwa", "Sithole", "M"),
                ("SE-2026-0024", "Praise", "Tsvangirai", "F"),
                ("SE-2026-0025", "Vimbai", "Mpofu", "F"),
                ("SE-2026-0026", "Munyaradzi", "Shumba", "M"),
            ]),
            ("2A", 2, [
                ("SE-2026-0031", "Panashe", "Ndlovu", "M"),
                ("SE-2026-0032", "Thandeka", "Khumalo", "F"),
                ("SE-2026-0033", "Tinotenda", "Chigumba", "M"),
                ("SE-2026-0034", "Rudo", "Maphosa", "F"),
                ("SE-2026-0035", "Tafadzwa", "Banda", "M"),
                ("SE-2026-0036", "Nomsa", "Moyo", "F"),
            ]),
            ("3A", 3, [
                ("SE-2026-0041", "Simbarashe", "Chirwa", "M"),
                ("SE-2026-0042", "Fungai", "Mutizwa", "F"),
                ("SE-2026-0043", "Kelvin", "Mupfumi", "M"),
                ("SE-2026-0044", "Danai", "Chitepo", "F"),
                ("SE-2026-0045", "Prosper", "Hove", "M"),
                ("SE-2026-0046", "Rutendo", "Makuwaza", "F"),
            ]),
            ("4A", 4, [
                ("SE-2026-0051", "Tatenda", "Gava", "M"),
                ("SE-2026-0052", "Sithembiso", "Mahlangu", "F"),
                ("SE-2026-0053", "Nqobani", "Sibanda", "M"),
                ("SE-2026-0054", "Chiedza", "Machingauta", "F"),
                ("SE-2026-0055", "Donald", "Chitsike", "M"),
                ("SE-2026-0056", "Maud", "Zhanda", "F"),
            ]),
        ]

        bands = bands_for(db, "O")

        for c_name, c_form, student_list in classes_spec:
            c_obj = db.query(ClassGroup).filter(ClassGroup.name == c_name).first()
            if not c_obj:
                c_obj = ClassGroup(name=c_name, form=c_form, year=2026, status="active")
                db.add(c_obj)
                db.flush()

            students_objs = []
            for adm, fn, ln, g in student_list:
                st = db.query(Student).filter(Student.admission_no == adm).first()
                if not st:
                    st = Student(admission_no=adm, first_name=fn, last_name=ln, gender=g, class_id=c_obj.id, status="active")
                    db.add(st)
                    db.flush()
                else:
                    st.class_id = c_obj.id
                    st.status = "active"
                students_objs.append(st)

            db.commit()

            # Ensure teacher assignment for Mathematics for Mr Moyo
            if subj_math and mrmoyo:
                ta = db.query(TeacherAssignment).filter(
                    TeacherAssignment.teacher_id == mrmoyo.id,
                    TeacherAssignment.class_id == c_obj.id,
                    TeacherAssignment.subject_id == subj_math.id
                ).first()
                if not ta:
                    db.add(TeacherAssignment(teacher_id=mrmoyo.id, class_id=c_obj.id, subject_id=subj_math.id))
                    db.commit()

            # Create 1 Weekly Revision Test and 1 End-of-Term Exam for Mathematics
            if subj_math and mrmoyo:
                # Test
                a_test = db.query(Assessment).filter(
                    Assessment.class_id == c_obj.id,
                    Assessment.subject_id == subj_math.id,
                    Assessment.title == "Weekly Revision Test 1",
                    Assessment.term == 1,
                    Assessment.year == 2026
                ).first()
                if not a_test:
                    a_test = Assessment(
                        class_id=c_obj.id,
                        subject_id=subj_math.id,
                        title="Weekly Revision Test 1",
                        kind="test",
                        term=1,
                        year=2026,
                        max_marks=50,
                        weight=1.0
                    )
                    db.add(a_test)
                    db.flush()

                # Exam
                a_exam = db.query(Assessment).filter(
                    Assessment.class_id == c_obj.id,
                    Assessment.subject_id == subj_math.id,
                    Assessment.title == "End of Term Exam (Paper 1)",
                    Assessment.term == 1,
                    Assessment.year == 2026
                ).first()
                if not a_exam:
                    a_exam = Assessment(
                        class_id=c_obj.id,
                        subject_id=subj_math.id,
                        title="End of Term Exam (Paper 1)",
                        kind="exam",
                        term=1,
                        year=2026,
                        max_marks=100,
                        weight=2.0
                    )
                    db.add(a_exam)
                    db.flush()

                db.commit()

                # Seed sample marks for each student
                test_scores = [44, 38, 41, 35, 30, 26]
                exam_scores = [88, 76, 82, 70, 62, 54]

                for idx, st in enumerate(students_objs):
                    m_val_test = test_scores[idx % len(test_scores)]
                    m_val_exam = exam_scores[idx % len(exam_scores)]

                    # Mark for test
                    mt = db.query(Mark).filter(Mark.assessment_id == a_test.id, Mark.student_id == st.id).first()
                    if not mt:
                        db.add(Mark(
                            assessment_id=a_test.id,
                            student_id=st.id,
                            marks_obtained=m_val_test,
                            grade=grade_for(percentage(m_val_test, 50), "O", bands),
                            absent=False,
                            entered_by=mrmoyo.id
                        ))

                    # Mark for exam
                    me = db.query(Mark).filter(Mark.assessment_id == a_exam.id, Mark.student_id == st.id).first()
                    if not me:
                        db.add(Mark(
                            assessment_id=a_exam.id,
                            student_id=st.id,
                            marks_obtained=m_val_exam,
                            grade=grade_for(percentage(m_val_exam, 100), "O", bands),
                            absent=False,
                            entered_by=mrmoyo.id
                        ))

                db.commit()
                print(f"Populated {c_name} with students, revision test, and exam marks.")

        print("All other teaching classes successfully seeded!")

    finally:
        db.close()

if __name__ == "__main__":
    seed()
