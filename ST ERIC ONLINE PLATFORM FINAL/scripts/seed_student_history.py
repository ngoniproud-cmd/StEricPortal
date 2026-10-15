"""
Populate comprehensive 2-year sample history for student st.001 (Tinashe Moyo).
Includes:
  - 2 Years of Terminal Assessments & Marks (2024, 2025, 2026) across 8 core subjects
  - Published Report Cards with Class Teacher and Headmaster comments for each term
  - Daily Attendance records spanning 2024 to 2026 (including recent 30-day ~96% attendance)
  - Homework Assignments with graded submissions, teacher feedback, and active to-do items
  - Complete 5-day Timetable (Periods 1-8) for class 1A with rooms and teachers
  - Rich Library catalogue with approved resources (textbooks, notes, past papers) and favourites
  - Fee Account Statement spanning 2024-2026 with $50 current balance
  - Consent Notices (with agreed parent responses)
  - School Calendar Events (Terms, Exams, Sports, Speech Day)
  - Announcements celebrating student achievements
  - In-App Notifications for the student's bell icon
"""
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# Ensure backend app is importable
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.db import SessionLocal
from app.models import (
    Announcement, Assessment, Attendance, CalendarEvent, ClassGroup, FeeRecord,
    LibraryFavourite, LibraryItem, Mark, Notice, NoticeResponse, Notification,
    ReportComment, Student, StudentGuardian, Subject, Submission, Assignment,
    TeacherAssignment, TimetableSlot, User
)


def seed_history():
    db = SessionLocal()
    print("=" * 65)
    print("SEEDING 2-YEAR COMPLETE STUDENT EXPERIENCE FOR st.001 (Tinashe Moyo)")
    print("=" * 65)

    # 1. Locate User and Student
    user = db.query(User).filter(User.username == "st.001").first()
    if not user:
        print("ERROR: User st.001 not found!")
        return

    student = db.query(Student).filter(Student.user_id == user.id).first()
    if not student:
        # Fallback by name
        student = db.query(Student).filter(Student.first_name.ilike("Tinashe")).first()
        if student:
            student.user_id = user.id
            db.commit()

    if not student:
        print("ERROR: Student record for Tinashe Moyo not found!")
        return

    print(f"Found Student: {student.full_name} (ID: {student.id}, Admission: {student.admission_no})")

    # Set student demographic details (female, 2010 DOB, joined 2024)
    student.gender = "F"
    student.date_of_birth = date(2010, 4, 15)
    student.admission_no = "SE-2024-0009"
    db.commit()

    # Get class 1A
    class_1a = db.query(ClassGroup).filter(ClassGroup.name == "1A").first()
    if not class_1a:
        class_1a = ClassGroup(name="1A", form=1, year=2026, status="active")
        db.add(class_1a)
        db.flush()

    student.class_id = class_1a.id
    db.commit()

    # Get classmates in 1A
    classmates = db.query(Student).filter(Student.class_id == class_1a.id, Student.id != student.id).all()
    print(f"Class 1A: {student.full_name} + {len(classmates)} classmates")

    # Teachers lookup
    teachers = db.query(User).filter(User.role == "teacher").all()
    teacher_map = {t.full_name: t for t in teachers}
    default_teacher = teachers[0] if teachers else user

    # Core ZIMSEC Subjects for Form 1 / O-Level
    subject_names = [
        "English Language",
        "Mathematics",
        "Combined Science",
        "Shona",
        "Geography",
        "History",
        "Commerce",
        "Agriculture",
    ]
    subjects = []
    for sname in subject_names:
        sub = db.query(Subject).filter(Subject.name.ilike(sname), Subject.level == "O").first()
        if not sub:
            sub = db.query(Subject).filter(Subject.name.ilike(sname)).first()
        if sub:
            subjects.append(sub)
        else:
            print(f"  Warning: Subject '{sname}' not found, skipping.")

    print(f"Loaded {len(subjects)} core academic subjects.")

    # ──────────────────────────────────────────────────────────
    # 2. ASSESSMENTS, MARKS & REPORT CARDS (2024, 2025, 2026)
    # ──────────────────────────────────────────────────────────
    print("\n[1/8] Generating 2-Year Academic Marks and Terminal Reports...")

    academic_terms = [
        (2024, 1, "Tinashe has settled exceptionally well into secondary school life. She displays great initiative, sharp analytical reasoning in Mathematics and Sciences, and writes fluent, compelling essays in both English and Shona. Position 1 is richly deserved.",
         "A stellar start to her high school journey at St Eric. Tinashe has set an admirable standard for her peers. Well done!"),
        (2024, 2, "Another consistently brilliant term. Tinashe actively participates in class discussions and assists fellow classmates with difficult concepts in Mathematics and Combined Science.",
         "Excellent academic diligence and character. Maintain this outstanding commitment."),
        (2024, 3, "Tinashe concludes Form 1 at the pinnacle of academic attainment. Awarded Best Form 1 Student in Mathematics, Science and English at the Annual Speech & Prize Giving.",
         "A magnificent year of academic mastery. Promoted with highest distinction."),
        (2025, 1, "Tinashe continues to demonstrate superior academic discipline. Her lab write-ups in Combined Science are exemplary, and her grasp of commercial principles is solid.",
         "Strong leadership and academic performance. Commendable work, Tinashe."),
        (2025, 2, "Consistently outstanding across all curriculum disciplines. Her critical thinking in Geography and History has matured noticeably.",
         "Consistent excellence is the hallmark of a true St Eric scholar. Bravo."),
        (2025, 3, "An extraordinary academic year. Tinashe achieved straight A grades in all terminal examinations. She also represented the school in the National Junior Science Olympiad.",
         "An exemplary model of our school motto — Service and Excellence. Outstanding achievement."),
        (2026, 1, "Tinashe has commenced this academic year with customary focus and drive. Her leadership in classroom group projects and steady exam scores are commendable.",
         "Superb standard of academic commitment. Keep leading by example."),
        (2026, 2, "Second term completed with distinction. Superior problem-solving and rigorous coursework in all disciplines.",
         "Splendid results. Continue working diligently toward Cambridge and ZIMSEC excellence."),
        (2026, 3, "Current Term 3: Outstanding revision tests and final examination preparations. Maintained Position 1 with stellar academic attainment across all 8 subjects.",
         "Unmatched dedication to her studies. An exemplary scholar and role model for St Eric High School."),
    ]

    # Pre-defined realistic marks for Tinashe Moyo per subject (ranging 80-98 across 9 terms)
    tinashe_pcts = {
        "English Language": [88, 90, 92, 89, 91, 93, 90, 92, 94],
        "Mathematics": [94, 96, 98, 92, 95, 96, 95, 96, 98],
        "Combined Science": [90, 92, 95, 91, 93, 94, 92, 93, 95],
        "Shona": [86, 88, 90, 88, 90, 92, 89, 91, 93],
        "Geography": [82, 85, 87, 84, 86, 88, 85, 87, 89],
        "History": [85, 87, 89, 86, 88, 91, 88, 90, 92],
        "Commerce": [88, 91, 93, 90, 92, 94, 91, 93, 95],
        "Agriculture": [84, 86, 88, 85, 87, 89, 86, 88, 90],
    }

    # Classmate base score offsets to ensure realistic bell curve below Tinashe
    cm_offsets = [0.76, 0.72, 0.68, 0.65, 0.61]

    marks_created = 0
    assessments_created = 0

    for term_idx, (year, term, teacher_comm, head_comm) in enumerate(academic_terms):
        # 1. ReportComment
        rc = db.query(ReportComment).filter(
            ReportComment.student_id == student.id,
            ReportComment.term == term,
            ReportComment.year == year
        ).first()
        if not rc:
            rc = ReportComment(
                student_id=student.id,
                term=term,
                year=year,
                class_teacher_comment=teacher_comm,
                head_comment=head_comm,
                published=True
            )
            db.add(rc)
        else:
            rc.class_teacher_comment = teacher_comm
            rc.head_comment = head_comm
            rc.published = True

        for sub in subjects:
            # Create Mid-Term Test and End of Term Exam
            tests = [
                (f"Term {term} Mid-Term Assessment", "test", 50.0, 1.0),
                (f"Term {term} Final Examination", "exam", 100.0, 2.0),
            ]
            for title, kind, max_m, wt in tests:
                ass = db.query(Assessment).filter(
                    Assessment.class_id == class_1a.id,
                    Assessment.subject_id == sub.id,
                    Assessment.term == term,
                    Assessment.year == year,
                    Assessment.kind == kind
                ).first()
                if not ass:
                    ass = Assessment(
                        class_id=class_1a.id,
                        subject_id=sub.id,
                        title=title,
                        kind=kind,
                        term=term,
                        year=year,
                        max_marks=max_m,
                        weight=wt,
                        is_locked=True
                    )
                    db.add(ass)
                    db.flush()
                    assessments_created += 1

                # Tinashe's mark
                base_pct = tinashe_pcts.get(sub.name, [88])[term_idx]
                if kind == "test":
                    t_pct = min(100.0, base_pct + 1.0)
                else:
                    t_pct = base_pct
                t_score = round(max_m * (t_pct / 100.0), 1)

                m = db.query(Mark).filter(Mark.assessment_id == ass.id, Mark.student_id == student.id).first()
                if not m:
                    m = Mark(
                        assessment_id=ass.id,
                        student_id=student.id,
                        marks_obtained=t_score,
                        absent=False,
                        grade="A" if t_pct >= 75 else "B",
                        entered_by=default_teacher.id
                    )
                    db.add(m)
                    marks_created += 1
                else:
                    m.marks_obtained = t_score
                    m.absent = False
                    m.grade = "A" if t_pct >= 75 else "B"

                # Classmates marks for position calculation
                for c_idx, cm in enumerate(classmates):
                    offset = cm_offsets[c_idx % len(cm_offsets)]
                    cm_pct = round(base_pct * offset, 1)
                    cm_score = round(max_m * (cm_pct / 100.0), 1)
                    cm_grade = "A" if cm_pct >= 75 else "B" if cm_pct >= 60 else "C" if cm_pct >= 50 else "D"
                    cm_m = db.query(Mark).filter(Mark.assessment_id == ass.id, Mark.student_id == cm.id).first()
                    if not cm_m:
                        cm_m = Mark(
                            assessment_id=ass.id,
                            student_id=cm.id,
                            marks_obtained=cm_score,
                            absent=False,
                            grade=cm_grade,
                            entered_by=default_teacher.id
                        )
                        db.add(cm_m)
                        marks_created += 1

    db.commit()
    print(f"  Created {assessments_created} assessments and {marks_created} student marks across 8 academic terms.")

    # ──────────────────────────────────────────────────────────
    # 3. DAILY ATTENDANCE (2024 to 2026)
    # ──────────────────────────────────────────────────────────
    print("\n[2/8] Generating Daily Attendance Records (2024 - 2026)...")
    att_created = 0

    term_spans = [
        # 2024
        (date(2024, 1, 9), date(2024, 4, 11)),
        (date(2024, 5, 7), date(2024, 8, 8)),
        (date(2024, 9, 10), date(2024, 12, 5)),
        # 2025
        (date(2025, 1, 14), date(2025, 4, 10)),
        (date(2025, 5, 6), date(2025, 8, 7)),
        (date(2025, 9, 9), date(2025, 12, 4)),
        # 2026
        (date(2026, 1, 13), date(2026, 4, 9)),
        (date(2026, 5, 12), date.today()),
    ]

    for start_d, end_d in term_spans:
        cur = start_d
        day_count = 0
        while cur <= end_d:
            if cur.weekday() < 5:  # Monday to Friday
                day_count += 1
                # Realistic pattern: 96% present, 3% late, 1% excused
                if day_count % 35 == 0:
                    status = "excused"
                elif day_count % 18 == 0:
                    status = "late"
                else:
                    status = "present"

                existing = db.query(Attendance).filter(
                    Attendance.student_id == student.id,
                    Attendance.day == cur
                ).first()
                if not existing:
                    att = Attendance(
                        student_id=student.id,
                        day=cur,
                        status=status,
                        marked_by=default_teacher.id
                    )
                    db.add(att)
                    att_created += 1

                # Also mark classmates so class registers are consistent
                for cm in classmates:
                    cm_st = "present" if (day_count + hash(cm.id)) % 15 != 0 else "absent"
                    if not db.query(Attendance).filter(Attendance.student_id == cm.id, Attendance.day == cur).first():
                        db.add(Attendance(student_id=cm.id, day=cur, status=cm_st, marked_by=default_teacher.id))

            cur += timedelta(days=1)

    db.commit()
    print(f"  Recorded {att_created} daily attendance entries for Tinashe Moyo.")

    # ──────────────────────────────────────────────────────────
    # 4. HOMEWORK & ASSIGNMENTS (With Submissions & Feedback)
    # ──────────────────────────────────────────────────────────
    print("\n[3/8] Creating Homework Assignments & Graded Submissions...")
    now = datetime.now(timezone.utc)

    # Clean existing assignments for class 1A to ensure fresh rich state
    db.query(Submission).filter(Submission.student_id == student.id).delete()
    db.query(Assignment).filter(Assignment.class_id == class_1a.id).delete()
    db.commit()

    math_sub = next((s for s in subjects if "Math" in s.name), subjects[0])
    hist_sub = next((s for s in subjects if "Hist" in s.name), subjects[0])
    sci_sub = next((s for s in subjects if "Sci" in s.name), subjects[0])
    shona_sub = next((s for s in subjects if "Shona" in s.name), subjects[0])
    agri_sub = next((s for s in subjects if "Agri" in s.name), subjects[0])
    geo_sub = next((s for s in subjects if "Geo" in s.name), subjects[0])
    eng_sub = next((s for s in subjects if "Eng" in s.name), subjects[0])

    homework_items = [
        {
            "sub": math_sub,
            "title": "Algebraic Expressions & Factorisation Problem Set",
            "instructions": "Complete Questions 1 through 15 on Page 84 of Focus on O-Level Mathematics. Show all intermediate steps and state factorization rules applied.",
            "due": now - timedelta(days=14),
            "max": 20.0,
            "submitted": True,
            "mark": 19.5,
            "text": "Attached my step-by-step working for all 15 factorisation problems. Applied difference of two squares for Q8 and quadratic grouping for Q12.",
            "feedback": "Flawless demonstration of algebraic grouping and factoring by inspection. Excellent mathematical discipline, Tinashe.",
        },
        {
            "sub": hist_sub,
            "title": "Essay: Social and Economic Organization of Great Zimbabwe",
            "instructions": "Discuss the archaeological and oral historical evidence regarding cattle pastoralism, gold mining, and international Indian Ocean trade networks at Great Zimbabwe (1100-1450 AD). Minimum 600 words.",
            "due": now - timedelta(days=10),
            "max": 50.0,
            "submitted": True,
            "mark": 48.0,
            "text": "Completed comprehensive 850-word historical essay exploring the stone enclosure architecture, soapstone bird relics, Persian ceramics, and Swahili coastal trading links.",
            "feedback": "Outstanding scholarly critique. You integrated material evidence with economic theories of state formation with maturity far beyond Form 1 level.",
        },
        {
            "sub": sci_sub,
            "title": "Lab Investigation: Factors Influencing Photosynthesis Rate",
            "instructions": "Write up the complete laboratory investigation on Elodea (pondweed) bubble count variations under light intensity gradients. Include hypotheses, apparatus list, data tables, and error analysis.",
            "due": now - timedelta(days=6),
            "max": 30.0,
            "submitted": True,
            "mark": 29.0,
            "text": "Submitted formal laboratory report including charted graph of light distance vs. oxygen bubble count per minute, along with limiting factor discussions.",
            "feedback": "Superb scientific method. Your graph was accurately plotted and your discussion on light intensity saturation was spot on.",
        },
        {
            "sub": shona_sub,
            "title": "Tsumo neMadimikira: Zvirevo neKushandiswa Kwazvo",
            "instructions": "Sarudzai tsumo shanu nemadimikira mashanu, mutsanangure zvaanoreva pamwe chete nekunyora ndima pfupi inoshandisa zvirevo izvi zvakanaka.",
            "due": now - timedelta(days=3),
            "max": 25.0,
            "submitted": True,
            "mark": 24.5,
            "text": "Ndagadzirira tsananguro dzakazara dzeumhizha hwetsumo dzakadai sekuti 'Chara chimwe hachitswanyi inda' uye 'Kupfuma idova' pamwe chete nenyaya inonakidza.",
            "feedback": "Rondedzero yakadzama ine mutauro unozve zvakanaka. Mashandisirwo emadimikira akanyatsobuda pachena. Makorokoto!",
        },
        {
            "sub": agri_sub,
            "title": "Field Practical: Soil Profile & Drainage Characteristics",
            "instructions": "Document the three soil samples collected from the school demonstration plot (sand, clay, loam). Record percolation rates and nutrient retention potential.",
            "due": now - timedelta(days=1),
            "max": 40.0,
            "submitted": True,
            "mark": None,  # Handed in, waiting for teacher grading!
            "text": "Conducted percolation rate experiments with funnels and filter papers. Loam demonstrated optimal retention while sandy soil drained within 45 seconds. Full table attached.",
            "feedback": None,
        },
        {
            "sub": geo_sub,
            "title": "Topographical Map Reading: Norton & Darwendale Sheet",
            "instructions": "Examine the 1:50,000 Norton topographical map extract. Calculate the gradient between Trig Beacon 142 and the railway junction. Identify drainage patterns of the Manyame river catchment.",
            "due": now + timedelta(days=3),
            "max": 30.0,
            "submitted": False,  # TO DO!
            "mark": None,
            "text": None,
            "feedback": None,
        },
        {
            "sub": eng_sub,
            "title": "Persuasive Speech: Preservation of Wetland Ecosystems in Zimbabwe",
            "instructions": "Prepare a 3-minute persuasive speech addressed to the local town council advocating for the protection of urban wetlands against commercial infrastructure expansion.",
            "due": now + timedelta(days=5),
            "max": 35.0,
            "submitted": False,  # TO DO!
            "mark": None,
            "text": None,
            "feedback": None,
        },
    ]

    for item in homework_items:
        a = Assignment(
            class_id=class_1a.id,
            subject_id=item["sub"].id,
            teacher_id=default_teacher.id,
            title=item["title"],
            instructions=item["instructions"],
            due_at=item["due"],
            max_marks=item["max"],
            status="active"
        )
        db.add(a)
        db.flush()

        if item["submitted"]:
            sub = Submission(
                assignment_id=a.id,
                student_id=student.id,
                text=item["text"],
                submitted_at=item["due"] - timedelta(hours=6),
                is_late=False,
                mark=item["mark"],
                feedback=item["feedback"],
                marked_by=default_teacher.id if item["mark"] is not None else None
            )
            db.add(sub)

    db.commit()
    print("  Created 7 assignments: 4 graded with teacher feedback, 1 handed in awaiting marks, 2 upcoming to-do.")

    # ──────────────────────────────────────────────────────────
    # 5. WEEKLY TIMETABLE (Periods 1-8 for Mon-Fri)
    # ──────────────────────────────────────────────────────────
    print("\n[4/8] Building Complete 5-Day Class Timetable for Class 1A...")
    db.query(TimetableSlot).filter(TimetableSlot.class_id == class_1a.id).delete()
    db.commit()

    # Schedule: 5 days, 8 periods
    schedule_grid = [
        # Mon (Day 1)
        (1, 1, eng_sub, "Room 12"),
        (1, 2, math_sub, "Room 12"),
        (1, 3, sci_sub, "Lab 1"),
        (1, 4, hist_sub, "Room 12"),
        (1, 5, shona_sub, "Room 12"),
        (1, 6, geo_sub, "Room 12"),
        (1, 7, agri_sub, "Agri Block"),
        (1, 8, subjects[6] if len(subjects) > 6 else eng_sub, "Room 14"),  # Commerce
        # Tue (Day 2)
        (2, 1, math_sub, "Room 12"),
        (2, 2, sci_sub, "Lab 1"),
        (2, 3, eng_sub, "Room 12"),
        (2, 4, subjects[6] if len(subjects) > 6 else math_sub, "Room 14"),  # Commerce
        (2, 5, shona_sub, "Room 12"),
        (2, 6, geo_sub, "Room 12"),
        (2, 7, hist_sub, "Room 12"),
        (2, 8, agri_sub, "Agri Block"),
        # Wed (Day 3)
        (3, 1, sci_sub, "Lab 1"),
        (3, 2, sci_sub, "Lab 1"),
        (3, 3, eng_sub, "Room 12"),
        (3, 4, math_sub, "Room 12"),
        (3, 5, hist_sub, "Room 12"),
        (3, 6, geo_sub, "Room 12"),
        (3, 7, agri_sub, "Agri Block"),
        (3, 8, shona_sub, "Room 12"),
        # Thu (Day 4)
        (4, 1, math_sub, "Room 12"),
        (4, 2, eng_sub, "Room 12"),
        (4, 3, shona_sub, "Room 12"),
        (4, 4, subjects[6] if len(subjects) > 6 else sci_sub, "Room 14"),  # Commerce
        (4, 5, sci_sub, "Lab 1"),
        (4, 6, geo_sub, "Room 12"),
        (4, 7, hist_sub, "Room 12"),
        (4, 8, eng_sub, "Library"),
        # Fri (Day 5)
        (5, 1, eng_sub, "Room 12"),
        (5, 2, math_sub, "Room 12"),
        (5, 3, sci_sub, "Lab 1"),
        (5, 4, shona_sub, "Room 12"),
        (5, 5, hist_sub, "Room 12"),
        (5, 6, geo_sub, "Room 12"),
        (5, 7, agri_sub, "Sports Field"),
        (5, 8, math_sub, "Room 12"),
    ]

    slots_added = 0
    for day, period, sub, room in schedule_grid:
        slot = TimetableSlot(
            class_id=class_1a.id,
            subject_id=sub.id,
            teacher_id=default_teacher.id,
            day=day,
            period=period,
            room=room
        )
        db.add(slot)
        slots_added += 1

    db.commit()
    print(f"  Added {slots_added} timetable slots covering Monday through Friday (Periods 1-8).")

    # ──────────────────────────────────────────────────────────
    # 6. DIGITAL LIBRARY CATALOGUE & FAVOURITES
    # ──────────────────────────────────────────────────────────
    print("\n[5/8] Populating Digital Library Resources & Student Favourites...")

    library_dir = BACKEND_DIR / "uploads" / "library"
    library_dir.mkdir(parents=True, exist_ok=True)

    # Minimal dummy valid PDF byte sequence
    DUMMY_PDF = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\n"
        b"trailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF\n"
    )

    resources = [
        {
            "title": "Focus on O-Level Mathematics: Comprehensive Students' Book",
            "desc": "Standard textbook covering ZIMSEC 4004 syllabus: algebra, geometry, mensuration, trigonometry, and statistics with worked examples.",
            "kind": "textbook",
            "sub": math_sub,
            "form": 0,
            "year": None,
            "session": None,
            "paper": None,
            "size": 14_200_000,
            "file": "focus_maths_olevel.pdf",
            "fav": True,
            "views": 342,
            "downloads": 189
        },
        {
            "title": "Step Ahead Combined Science: Form 1 & 2 Coursebook",
            "desc": "Biology, chemistry, and physics modules designed for Zimbabwe secondary curriculum with practical laboratory protocols.",
            "kind": "textbook",
            "sub": sci_sub,
            "form": 1,
            "year": None,
            "session": None,
            "paper": None,
            "size": 18_450_000,
            "file": "step_ahead_combined_science_f1.pdf",
            "fav": True,
            "views": 412,
            "downloads": 245
        },
        {
            "title": "ZIMSEC Combined Science 4003/1 Past Examination Paper (November 2024)",
            "desc": "Multiple choice theory examination paper covering all fundamental scientific principles and problem calculations.",
            "kind": "past_paper",
            "sub": sci_sub,
            "form": 0,
            "year": 2024,
            "session": "November",
            "paper": "1",
            "size": 2_150_000,
            "file": "zimsec_combined_sci_2024_p1.pdf",
            "fav": True,
            "views": 278,
            "downloads": 164
        },
        {
            "title": "ZIMSEC Combined Science 4003/1 Official Marking Scheme (November 2024)",
            "desc": "Authoritative ZIMSEC examiner mark scheme with question-by-question scoring rationales.",
            "kind": "marking_scheme",
            "sub": sci_sub,
            "form": 0,
            "year": 2024,
            "session": "November",
            "paper": "1",
            "size": 1_180_000,
            "file": "zimsec_combined_sci_2024_ms1.pdf",
            "fav": False,
            "views": 195,
            "downloads": 120
        },
        {
            "title": "ZIMSEC Mathematics 4004/2 Past Examination Paper (November 2024)",
            "desc": "Section A and Section B structured paper testing advanced algebraic factorization, geometric proofs, and graphs.",
            "kind": "past_paper",
            "sub": math_sub,
            "form": 0,
            "year": 2024,
            "session": "November",
            "paper": "2",
            "size": 2_340_000,
            "file": "zimsec_maths_2024_p2.pdf",
            "fav": True,
            "views": 389,
            "downloads": 210
        },
        {
            "title": "Complete Shona Tsumo, Madimikira neNyaudzosingwi Handbook",
            "desc": "Over 500 traditional Zimbabwean proverbs and idiomatic expressions with contextual interpretations and cultural usage.",
            "kind": "notes",
            "sub": shona_sub,
            "form": 0,
            "year": None,
            "session": None,
            "paper": None,
            "size": 4_620_000,
            "file": "shona_tsumo_madimikira.pdf",
            "fav": False,
            "views": 165,
            "downloads": 98
        },
        {
            "title": "ZIMSEC Geography 2248: Map Reading, Contours & Landforms Guide",
            "desc": "Practical guide on 1:50,000 Survey of Zimbabwe topographic map interpretation, grid references, scale conversions, and cross-sections.",
            "kind": "notes",
            "sub": geo_sub,
            "form": 1,
            "year": None,
            "session": None,
            "paper": None,
            "size": 8_120_000,
            "file": "geography_mapwork_guide.pdf",
            "fav": False,
            "views": 210,
            "downloads": 140
        },
    ]

    # Clean existing favourites for student
    db.query(LibraryFavourite).filter(LibraryFavourite.user_id == user.id).delete()
    db.commit()

    lib_items_seeded = 0
    for res in resources:
        # Write real PDF file to upload directory
        pdf_path = library_dir / res["file"]
        if not pdf_path.exists():
            pdf_path.write_bytes(DUMMY_PDF)

        item = db.query(LibraryItem).filter(LibraryItem.title == res["title"]).first()
        if not item:
            item = LibraryItem(
                title=res["title"],
                description=res["desc"],
                kind=res["kind"],
                subject_id=res["sub"].id,
                form=res["form"],
                exam_year=res["year"],
                session=res["session"],
                paper_no=res["paper"],
                file_path=res["file"],
                original_name=res["file"],
                mime="application/pdf",
                size_bytes=res["size"],
                uploaded_by=default_teacher.id,
                status="approved",
                reviewed_by=user.id,
                reviewed_at=datetime.now(timezone.utc),
                views=res["views"],
                downloads=res["downloads"]
            )
            db.add(item)
            db.flush()
            lib_items_seeded += 1
        else:
            item.file_path = res["file"]
            item.original_name = res["file"]
            item.status = "approved"

        if res["fav"]:
            fav = LibraryFavourite(user_id=user.id, item_id=item.id)
            db.add(fav)

    db.commit()
    print(f"  Published {len(resources)} approved library materials; pinned 4 favourites for Tinashe.")

    # ──────────────────────────────────────────────────────────
    # 7. FEE ACCOUNT & FINANCIAL STATEMENTS (2024 - 2026)
    # ──────────────────────────────────────────────────────────
    print("\n[6/8] Seeding 2-Year Bursar Fee Ledger & Account Statements...")

    # Clear existing fee records for this student
    db.query(FeeRecord).filter(FeeRecord.external_student_id == student.admission_no).delete()
    db.commit()

    fee_entries = [
        ("Term 1 2024 Tuition Fees", 350.00, 350.00, "paid", datetime(2024, 1, 8, 8, 0, tzinfo=timezone.utc), datetime(2024, 1, 15, 10, 30, tzinfo=timezone.utc)),
        ("Annual Building & Development Levy 2024", 100.00, 100.00, "paid", datetime(2024, 1, 8, 8, 0, tzinfo=timezone.utc), datetime(2024, 1, 22, 14, 0, tzinfo=timezone.utc)),
        ("Term 2 2024 Tuition Fees", 350.00, 350.00, "paid", datetime(2024, 5, 6, 8, 0, tzinfo=timezone.utc), datetime(2024, 5, 12, 11, 15, tzinfo=timezone.utc)),
        ("Term 3 2024 Tuition Fees", 350.00, 350.00, "paid", datetime(2024, 9, 9, 8, 0, tzinfo=timezone.utc), datetime(2024, 9, 14, 9, 45, tzinfo=timezone.utc)),
        ("Term 1 2025 Tuition Fees", 350.00, 350.00, "paid", datetime(2025, 1, 13, 8, 0, tzinfo=timezone.utc), datetime(2025, 1, 18, 12, 0, tzinfo=timezone.utc)),
        ("Annual Building & Development Levy 2025", 100.00, 100.00, "paid", datetime(2025, 1, 13, 8, 0, tzinfo=timezone.utc), datetime(2025, 1, 26, 15, 30, tzinfo=timezone.utc)),
        ("Science Laboratory Practical Equipment Levy 2025", 60.00, 60.00, "paid", datetime(2025, 1, 13, 8, 0, tzinfo=timezone.utc), datetime(2025, 2, 4, 10, 0, tzinfo=timezone.utc)),
        ("Term 2 2025 Tuition Fees", 350.00, 350.00, "paid", datetime(2025, 5, 5, 8, 0, tzinfo=timezone.utc), datetime(2025, 5, 11, 14, 20, tzinfo=timezone.utc)),
        ("Term 3 2025 Tuition Fees", 350.00, 350.00, "paid", datetime(2025, 9, 8, 8, 0, tzinfo=timezone.utc), datetime(2025, 9, 16, 11, 0, tzinfo=timezone.utc)),
        ("Term 1 2026 Tuition Fees", 350.00, 350.00, "paid", datetime(2026, 1, 12, 8, 0, tzinfo=timezone.utc), datetime(2026, 1, 16, 9, 30, tzinfo=timezone.utc)),
        ("Annual Building & Development Levy 2026", 120.00, 120.00, "paid", datetime(2026, 1, 12, 8, 0, tzinfo=timezone.utc), datetime(2026, 1, 23, 13, 45, tzinfo=timezone.utc)),
        ("Computer Lab & Digital Learning Connectivity Levy 2026", 50.00, 50.00, "paid", datetime(2026, 1, 12, 8, 0, tzinfo=timezone.utc), datetime(2026, 2, 2, 10, 15, tzinfo=timezone.utc)),
        ("Term 2 2026 Tuition Fees", 350.00, 350.00, "paid", datetime(2026, 5, 4, 8, 0, tzinfo=timezone.utc), datetime(2026, 5, 9, 11, 0, tzinfo=timezone.utc)),
        ("Term 3 2026 Tuition Fees", 350.00, 300.00, "part_paid", datetime(2026, 9, 8, 8, 0, tzinfo=timezone.utc), datetime(2026, 9, 15, 10, 30, tzinfo=timezone.utc)),
    ]

    for idx, (desc, due, paid, status, bill_date, pay_date) in enumerate(fee_entries, start=1):
        bal = round(due - paid, 2)
        rec = FeeRecord(
            external_student_id=student.admission_no,
            external_fee_id=f"FEE-2024-26-{idx:04d}",
            fee_type=desc,
            currency="USD",
            amount_due=due,
            amount_paid=paid,
            balance=bal,
            status=status,
            created_at=bill_date,
            last_synced_at=pay_date
        )
        db.add(rec)

    db.commit()
    print("  Created 13 historical fee statement items with realistic billing and payment dates; balance: US$ 50.00.")

    # ──────────────────────────────────────────────────────────
    # 8. NOTICES, ANNOUNCEMENTS, CALENDAR & NOTIFICATIONS
    # ──────────────────────────────────────────────────────────
    print("\n[7/8] Seeding Consent Notices, Calendar Events & Announcements...")

    # Parent user for responses
    parent_user = db.query(User).filter(User.username.in_(["parent1", "moyo"])).first()
    if not parent_user:
        parent_user = user

    # Consent Notices
    notices_data = [
        {
            "title": "Educational Excursion to Great Zimbabwe National Monument",
            "body": "The Humanities department has organized a three-day field study trip to Great Zimbabwe and Lake Mutirikwi. Learners will study Iron Age architectural stone masonry, medieval Indian Ocean trade networks, and conservation biology. Departure is at 06:00 on Friday 24th July from the main administration quadrangle. Total cost: USD 85.00 inclusive of luxury coach transport, full boarding at Great Zimbabwe Hotel, and monument entry fees.",
            "deadline": date(2026, 7, 20),
            "response": "agree"
        },
        {
            "title": "Annual Ministry of Health School Dental & Health Screening",
            "body": "Qualified medical practitioners from the Norton District Hospital will visit St Eric High to conduct comprehensive oral hygiene assessments, eyesight screenings, and routine wellness examinations for all Form 1 learners on Thursday 18th June. The service is provided entirely free of charge.",
            "deadline": date(2026, 6, 15),
            "response": "agree"
        },
        {
            "title": "National Junior Schools Debate & Public Speaking Championship (Bulawayo)",
            "body": "Congratulations to the St Eric Junior Debate Society for qualifying for the National Finals in Bulawayo from 15th to 17th August 2026. Selected team members will travel under the supervision of the Senior Debate Patron. Transport and lodging will be subsidized by the school.",
            "deadline": date(2026, 8, 5),
            "response": None  # Open for response!
        }
    ]

    for nd in notices_data:
        n = db.query(Notice).filter(Notice.title == nd["title"]).first()
        if not n:
            n = Notice(
                title=nd["title"],
                body=nd["body"],
                deadline=nd["deadline"],
                class_id=class_1a.id,
                created_by=default_teacher.id,
                status="active"
            )
            db.add(n)
            db.flush()

        if nd["response"]:
            nr = db.query(NoticeResponse).filter(NoticeResponse.notice_id == n.id, NoticeResponse.student_id == student.id).first()
            if not nr:
                nr = NoticeResponse(
                    notice_id=n.id,
                    student_id=student.id,
                    parent_id=parent_user.id,
                    response=nd["response"]
                )
                db.add(nr)

    # Calendar Events
    events_data = [
        ("Term 1 2026 Academic Session", "term", date(2026, 1, 13), date(2026, 4, 10), "Official first term academic learning cycle."),
        ("Term 2 2026 Academic Session", "term", date(2026, 5, 12), date(2026, 8, 7), "Winter term focusing on mid-year curricula and sports."),
        ("Term 3 2026 Academic Session", "term", date(2026, 9, 8), date(2026, 12, 4), "Third term featuring national ZIMSEC examinations."),
        ("Inter-House Athletics Championships", "sports", date(2026, 2, 27), None, "Track and field competitions at the main sports pavilion."),
        ("Mid-Term Break (Term 2)", "holiday", date(2026, 6, 19), date(2026, 6, 22), "School closed for four-day winter mid-term rest."),
        ("St Eric Annual Speech & Prize Giving Day", "event", date(2026, 7, 25), None, "Celebration of academic, cultural and athletic excellence."),
        ("Mid-Year Terminal Examinations", "exam", date(2026, 7, 6), date(2026, 7, 17), "Formal internal examinations across all forms."),
        ("Parents & Teachers Academic Consultation Conference", "event", date(2026, 6, 18), None, "One-on-one progress discussions with subject teachers."),
        ("Heroes' Day & Defence Forces Holidays", "holiday", date(2026, 8, 10), date(2026, 8, 11), "National public holidays."),
        ("ZIMSEC National Examination Session", "exam", date(2026, 10, 12), date(2026, 11, 20), "Official O-Level and A-Level ZIMSEC final exams."),
    ]

    for title, kind, start_d, end_d, desc in events_data:
        if not db.query(CalendarEvent).filter(CalendarEvent.title == title).first():
            db.add(CalendarEvent(title=title, kind=kind, start_date=start_d, end_date=end_d, description=desc))

    # Announcements
    announcements_data = [
        ("Academic Excellence Recognition: First Term Top Attainment",
         "The Headmaster and Academic Committee extend warmest congratulations to all learners who excelled in the First Term examinations. Special recognition is accorded to Tinashe Moyo of Form 1A for achieving top overall aggregate across Form 1. St Eric continues to uphold its motto: Service and Excellence.",
         "all"),
        ("Winter Sports Inter-School Fixtures Announced",
         "St Eric High School will host Kutama College and St Francis Xavier this coming Saturday. Fixtures commence at 08:30 in rugby, soccer, netball, and basketball. Supporters are expected in full school uniform.",
         "all"),
        ("Expanded Digital Library & Online Past Exam Papers",
         "The library department has uploaded verified ZIMSEC past papers, marking schemes, and revision guides to the online portal. Students can search, favourite, and download these materials at any time.",
         "students"),
        ("Parent-Teacher Consultation Day - Second Term",
         "Consultation sessions will be held on Thursday 18th June from 08:30 to 15:30. Parents and guardians are invited to review student portfolios, discuss academic attainment, and plan study interventions.",
         "parents"),
    ]

    for title, body, aud in announcements_data:
        if not db.query(Announcement).filter(Announcement.title == title).first():
            db.add(Announcement(title=title, body=body, audience=aud, published_by=default_teacher.id))

    # Notifications for student's bell icon
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    student_notifs = [
        ("Term 1 Report Card Published", "Your official Term 1 evaluation booklet is now available for review and download.", "/report-cards", True),
        ("Homework Graded: Algebraic Expressions", "Mrs Ncube marked your assignment: 19.5/20. 'Flawless demonstration of algebraic grouping!'", "/assignments", True),
        ("New Homework Assigned: Topographical Map Reading", "Mr Zvimba posted homework due in 3 days. Check instructions and worksheet.", "/assignments", False),
        ("Parent Consent Recorded: Great Zimbabwe Tour", "Your guardian has approved your participation in the July educational excursion.", "/notices", True),
        ("Fee Payment Credited", "A payment of USD 300.00 was credited to your tuition account by the bursar.", "/fees", False),
        ("New Library Resource Available", "ZIMSEC Combined Science 2024 Paper 1 and marking scheme have been added to the library.", "/library", False),
        ("Speech Day Academic Award", "Congratulations! You have been shortlisted for the Form 1 Overall Academic Excellence trophy.", "/announcements", True),
    ]

    for title, body, link, is_read in student_notifs:
        db.add(Notification(
            user_id=user.id,
            title=title,
            body=body,
            link=link,
            is_read=is_read
        ))

    db.commit()
    print("  Created notices, calendar events, announcements, and in-app notifications.")

    print("\n" + "=" * 65)
    print("SUCCESS: Full 2-year sample data seeded for student st.001 (Tinashe Moyo)!")
    print("=" * 65)


if __name__ == "__main__":
    seed_history()
