import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import requests, os
from dotenv import load_dotenv
load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_KEY')
print(f"URL: {url}")
print(f"KEY: {key[:20]}...")

h = {'apikey': key, 'Authorization': f'Bearer {key}'}
r = requests.get(f'{url}/rest/v1/markets?status=eq.active&select=*', headers=h, timeout=5)
print(f"Status: {r.status_code}")
markets = [m for m in r.json() if m.get('video_type')]
print(f"Mercados com video_type: {len(markets)}")
for m in markets:
    print(f"  -> {m['title']} | video_type={m['video_type']} | video_url={m['video_url']}")

# Testar yt-dlp
if markets:
    m = markets[0]
    if m['video_type'] == 'youtube':
        print("\nTestando yt-dlp...")
        try:
            import yt_dlp
            ydl_opts = {'format': 'best[height<=480]', 'quiet': True, 'no_warnings': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(m['video_url'], download=False)
                stream_url = info.get('url')
                print(f"Stream URL obtido: {stream_url[:100]}...")
                
                import cv2
                cap = cv2.VideoCapture(stream_url)
                print(f"VideoCapture aberto: {cap.isOpened()}")
                if cap.isOpened():
                    ret, frame = cap.read()
                    print(f"Frame lido: ret={ret}, shape={frame.shape if frame is not None else 'None'}")
                    cap.release()
        except Exception as e:
            print(f"ERRO yt-dlp: {e}")
            import traceback
            traceback.print_exc()
