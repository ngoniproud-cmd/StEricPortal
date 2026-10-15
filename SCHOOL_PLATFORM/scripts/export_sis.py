#!/usr/bin/env python3
import argparse
from pathlib import Path

from app.db import SessionLocal
from app.sis import build_users_archive

parser = argparse.ArgumentParser(description="Create a reviewable deterministic Canvas SIS ZIP")
parser.add_argument("output", type=Path)
parser.add_argument("--account-id", default="1")
args = parser.parse_args()
with SessionLocal() as db:
    archive = build_users_archive(db, args.account_id)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(archive.content)
print(f"wrote {archive.row_count} users to {args.output}")
