#!/usr/bin/env python3
"""
Import NST data from JSON files into Supabase.
Run: python3 import-to-supabase.py
"""

import json, os, sys, time
import urllib.request, urllib.error

SUPABASE_URL = 'https://qibdsiirzhfkpkyznfys.supabase.co'
SUPABASE_KEY = 'sb_publishable_2kYikvy29rc9845zr8J26A_jYNUyM4t'
DATA_DIR = os.path.join(os.path.dirname(__file__), 'nst-data')

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

# Map: json filename -> supabase table, columns to keep (None = all)
TABLES = {
    'talent':           ('nst_talent',          ['name','age','height','measurements','category','bio','skills','instagram','photo','featured','created_at']),
    'success_stories':  ('nst_success_stories',  ['name','title','brand','story','photo','created_at']),
    'testimonials':     ('nst_testimonials',      ['name','role','quote','rating','photo','created_at']),
    'faqs':             ('nst_faqs',             ['question','answer','sort_order','created_at']),
    'contacts':         ('nst_contacts',         ['name','email','phone','subject','message','status','created_at']),
    'talent_register':  ('nst_talent_register',  ['name','age','phone','email','category','notes','created_at']),
    'applications':     ('nst_applications',     None),  # all columns
    'leads':            ('nst_leads',            None),  # all columns
}

def supabase_insert(table, rows, batch_size=100):
    """Insert rows in batches, return (success_count, error_count)"""
    ok = 0
    errors = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        data = json.dumps(batch).encode()
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/{table}',
            data=data,
            headers=HEADERS,
            method='POST'
        )
        try:
            with urllib.request.urlopen(req) as resp:
                ok += len(batch)
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f'    Batch {i//batch_size+1} error {e.code}: {body[:200]}')
            errors += len(batch)
        time.sleep(0.1)  # be gentle with rate limits
    return ok, errors

def filter_cols(rows, cols):
    if cols is None:
        return rows
    return [{k: r.get(k) for k in cols} for r in rows]

def main():
    print('=== NST Supabase Import ===\n')
    for filename, (table, cols) in TABLES.items():
        path = os.path.join(DATA_DIR, f'{filename}.json')
        if not os.path.exists(path):
            print(f'{filename}: file not found, skipping')
            continue
        with open(path) as f:
            raw = json.load(f)
        rows = filter_cols(raw, cols)
        if not rows:
            print(f'{filename}: 0 rows, skipping')
            continue
        print(f'{filename} -> {table}: {len(rows)} rows...', end=' ', flush=True)
        ok, errors = supabase_insert(table, rows)
        print(f'✓ {ok} inserted, {errors} errors')

    print('\nDone!')

if __name__ == '__main__':
    main()
