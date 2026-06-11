import sqlite3

conn = sqlite3.connect("accidents.db", check_same_thread=False)

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS accidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    status TEXT,
    confidence REAL,
    vehicles TEXT,
    screenshot TEXT,
    pdf_report TEXT,
    alert_status TEXT,
    alert_sid TEXT,
    alert_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
""")

existing_columns = {
    row[1]
    for row in cursor.execute("PRAGMA table_info(accidents)").fetchall()
}

for column_name, column_type in (
    ("alert_status", "TEXT"),
    ("alert_sid", "TEXT"),
    ("alert_error", "TEXT"),
):
    if column_name not in existing_columns:
        cursor.execute(
            f"ALTER TABLE accidents ADD COLUMN {column_name} {column_type}"
        )

conn.commit()
