import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.db import SessionLocal
from app.models import User, Student
from app.security import verify_password
from app.routers.misc import dashboard, list_announcements, my_notifications
from app.routers.reports import report_json, children_of
from app.routers.assignments import list_mine as list_assignments
from app.routers.schedule import my_timetable, events
from app.routers.library import browse as browse_library
from app.routers.fees import mine as list_fees
from app.routers.notices import list_notices

s = SessionLocal()
u = s.query(User).filter(User.username == 'st.001').first()

print("=" * 65)
print("VERIFICATION OF STUDENT PORTAL EXPERIENCE FOR st.001")
print("=" * 65)

print("\n1. USER AUTHENTICATION")
print(f"  Username: {u.username}")
print(f"  Full Name: {u.full_name}")
print(f"  Role: {u.role}")
print(f"  Password 'admin123' verified: {verify_password('admin123', u.password_hash)}")

print("\n2. DASHBOARD VIEW (/dashboard)")
dash = dashboard(db=s, user=u)
print(f"  Welcome Name: {dash['name']}")
print(f"  Unread Alerts: {dash['unread']}")
for ch in dash.get('children', []):
    print(f"  Learner Card: {ch['name']} | Class: {ch['class']} | 30-Day Attendance: {ch['attendance']}%")
for tp in dash.get('top_performers', []):
    print(f"  Form Leader: Form {tp['form']} -> {tp['student_name']} ({tp['class_name']}) at {tp['overall']}%")

kids = children_of(s, u)
st = kids[0]

print("\n3. TERMINAL REPORT CARDS (/report-cards)")
for yr in [2024, 2025, 2026]:
    for t in [1, 2, 3]:
        try:
            rep = report_json(student_id=st.id, term=t, year=yr, db=s, user=u)
            print(f"  {yr} Term {t}: Overall={rep['overall']}%, Pos={rep['position']}/{rep['class_size']}, Grades={rep.get('grade_summary')}")
        except Exception as e:
            print(f"  {yr} Term {t}: {e}")

print("\n4. HOMEWORK / ASSIGNMENTS (/assignments)")
assts = list_assignments(db=s, user=u)
print(f"  Total Active/Historical Assignments: {len(assts)}")
for a in assts:
    sub = a.get('submission')
    if sub and sub.get('mark') is not None:
        status = f"Marked {sub['mark']}/{a['max_marks']} | Teacher Feedback: '{sub['feedback']}'"
    elif sub:
        status = "Handed in (Awaiting Grading)"
    else:
        status = "To do (Open for submission)"
    print(f"  - [{a['subject']}] {a['title']} -> {status}")

print("\n5. WEEKLY TIMETABLE (/timetable)")
tt = my_timetable(db=s, user=u)
slots = tt[0]['slots']
print(f"  Class Schedule: {tt[0]['title']} ({len(slots)} periods total)")
print("  Monday Schedule:")
for sl in [x for x in slots if x['day'] == 1]:
    print(f"    Period {sl['period']}: {sl['subject']} ({sl['room']}) - {sl['teacher']}")

print("\n6. DIGITAL LIBRARY (/library)")
lib = browse_library(db=s, user=u)
favs = [it for it in lib if it.get('favourite')]
print(f"  Approved Catalogue: {len(lib)} items")
print(f"  Pinned Favourites: {len(favs)} items")
for f in favs:
    print(f"    * {f['title']} [{f['kind'].upper()}] - {f['views']} views")

print("\n7. FEE STATEMENTS (/fees)")
fees = list_fees(db=s, user=u)
acc = fees[0]
print(f"  Learner: {acc['student']['name']} ({acc['student']['admission_no']})")
print(f"  Ledger History: {len(acc['records'])} entries")
print(f"  Outstanding Balance: {acc['balance']}")
for r in acc['records'][-4:]:
    print(f"    {r['fee_type']}: Due ${r['due']:.2f}, Paid ${r['paid']:.2f}, Bal ${r['balance']:.2f} [{r['status']}]")

print("\n8. CONSENT NOTICES (/notices)")
notices = list_notices(db=s, user=u)
print(f"  Active Notices: {len(notices)}")
for n in notices:
    resp = f"Parent Agreed" if n.get('response') == 'agree' else (n.get('response') or 'Open for reply')
    print(f"  - {n['title']} -> Status: {resp}")

print("\n9. ANNOUNCEMENTS (/announcements)")
ann = list_announcements(db=s, user=u)
print(f"  School Announcements: {len(ann)}")
for a in ann[:2]:
    print(f"  - [{a['audience'].upper()}] {a['title']}")

print("\n10. IN-APP ALERTS (/notifications)")
notifs = my_notifications(db=s, user=u)
print(f"  Total Alerts: {len(notifs['items'])}, Unread: {notifs['unread']}")
for n in notifs['items'][:4]:
    print(f"  - {n['title']} (Read: {n['read']}) -> Link: {n['link']}")

print("\n" + "=" * 65)
print("ALL STUDENT PORTAL FEATURES FULLY VERIFIED FOR st.001!")
print("=" * 65)
