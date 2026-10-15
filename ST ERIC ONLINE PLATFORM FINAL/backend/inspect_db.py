import sqlite3

conn = sqlite3.connect('dev.db')
c = conn.cursor()

print("=== USERS ===")
for r in c.execute("SELECT id, username, full_name, role, department FROM users WHERE role IN ('teacher','admin','hod')").fetchall():
    print(r)

print("\n=== CLASSES ===")
for r in c.execute("SELECT id, name, form, year, class_teacher_id FROM classes").fetchall():
    print(r)

print("\n=== TEACHER ASSIGNMENTS ===")
for r in c.execute("SELECT ta.teacher_id, u.username, u.full_name, c.name, s.name FROM teacher_assignments ta JOIN users u ON u.id = ta.teacher_id JOIN classes c ON c.id = ta.class_id JOIN subjects s ON s.id = ta.subject_id").fetchall():
    print(r)

print("\n=== STUDENTS PER CLASS ===")
for r in c.execute("SELECT c.name, count(s.id) FROM students s JOIN classes c ON c.id = s.class_id GROUP BY c.name").fetchall():
    print(r)
