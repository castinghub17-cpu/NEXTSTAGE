import requests, json, time
import urllib3
urllib3.disable_warnings()

URL = 'https://qibdsiirzhfkpkyznfys.supabase.co'
KEY = 'sb_secret_IwKicTt0PwjW3OqBFszjVg_bIWdOmWW'
HEADERS = {
    'apikey': KEY,
    'Authorization': f'Bearer {KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

TABLES = {
    'talent':          ('nst_talent',         ['name','age','height','measurements','category','bio','skills','instagram','photo','featured','created_at']),
    'success_stories': ('nst_success_stories', ['name','title','brand','story','photo','created_at']),
    'testimonials':    ('nst_testimonials',    ['name','role','quote','rating','photo','created_at']),
    'faqs':            ('nst_faqs',            ['question','answer','sort_order','created_at']),
    'contacts':        ('nst_contacts',        ['name','email','phone','subject','message','status','created_at']),
    'talent_register': ('nst_talent_register', ['name','age','phone','email','category','notes','created_at']),
    'applications':    ('nst_applications',    None),
    'leads':           ('nst_leads',           None),
}

def clean_row(row):
    """Replace empty strings with None for every field (SQLite nulls come through as '')."""
    return {k: (None if v == '' else v) for k, v in row.items()}

for filename, (table, cols) in TABLES.items():
    with open(f'nst-data/{filename}.json') as f:
        raw = json.load(f)
    if cols:
        rows = [{k: r.get(k) for k in cols} for r in raw]
    else:
        rows = raw
    rows = [clean_row(r) for r in rows]

    print(f'{filename}: {len(rows)} rows...', end=' ', flush=True)
    ok = 0
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        r = requests.post(f'{URL}/rest/v1/{table}', headers=HEADERS, json=batch, verify=False)
        if r.status_code in (200, 201):
            ok += len(batch)
        else:
            print(f'\n  ERR {r.status_code}: {r.text[:300]}')
        time.sleep(0.2)
    print(f'DONE ({ok})')

print('\nALL DONE!')
