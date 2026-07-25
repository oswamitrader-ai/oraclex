import requests, os
from dotenv import load_dotenv
load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')
h = {'apikey': key, 'Authorization': f'Bearer {key}'}
r = requests.get(f'{url}/rest/v1/markets?status=eq.active&select=id,title,video_type,video_url', headers=h)
print(f"Status: {r.status_code}")
for m in r.json():
    print(f"  ID: {m['id'][:8]}... | Title: {m['title']} | Type: {m.get('video_type')} | URL: {str(m.get('video_url',''))[:80]}")
print(f"\nTotal: {len(r.json())} mercados ativos")
