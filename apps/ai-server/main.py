
import cv2
import time
import datetime
import threading
import os
import traceback
import json
import re
import base64
import requests
import numpy as np
from dotenv import load_dotenv
from flask import Flask, Response
from flask_cors import CORS
from io import BytesIO
from PIL import Image
from google import genai

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRO: Configure SUPABASE_URL e SUPABASE_KEY no .env")
    exit(1)

if not GEMINI_API_KEY:
    print("ERRO: Configure GEMINI_API_KEY no .env")
    exit(1)

# Configurar Gemini (novo SDK google-genai)
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_ID = 'gemini-3.5-flash'

print("[OK] Gemini AI configurado com sucesso!")

app = Flask(__name__)
CORS(app)

active_markets = {}
latest_frames = {}
market_counts = {}

# --- Helpers de Banco ---

def db_headers():
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}

def db_get_market(market_id):
    try:
        resp = requests.get(f"{SUPABASE_URL}/rest/v1/markets?id=eq.{market_id}&select=*", headers=db_headers(), timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if data else None
    except:
        pass
    return None

def db_update_market(market_id, payload):
    try:
        requests.patch(f"{SUPABASE_URL}/rest/v1/markets?id=eq.{market_id}", json=payload, headers=db_headers(), timeout=5)
    except:
        pass

# --- Captura de Video ---

def download_video(url, market_id):
    local_path = f"temp_{market_id}.mp4"
    if os.path.exists(local_path) and os.path.getsize(local_path) > 1000:
        return local_path
    print(f"  [DOWNLOAD] Baixando video: {url[:80]}...")
    try:
        r = requests.get(url, stream=True, timeout=60)
        with open(local_path, 'wb') as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)
        print(f"  [OK] Download concluido: {os.path.getsize(local_path)} bytes")
        return local_path
    except Exception as e:
        print(f"  [ERRO] Erro ao baixar video: {e}")
        return None

def open_video(market):
    video_type = market.get('video_type', '')
    video_url = market.get('video_url', '')
    
    if video_type in ['upload', 'static_link']:
        local = download_video(video_url, market['id'])
        if local:
            cap = cv2.VideoCapture(local)
            if cap.isOpened():
                return cap, local
        cap = cv2.VideoCapture(video_url)
        if cap.isOpened():
            return cap, None
        return None, None
    
    elif video_type == 'youtube':
        try:
            import yt_dlp
            ydl_opts = {'format': 'best[height<=480]', 'quiet': True, 'no_warnings': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                stream_url = info.get('url')
                if stream_url:
                    cap = cv2.VideoCapture(stream_url)
                    if cap.isOpened():
                        return cap, None
        except:
            pass
        return None, None
    
    else:
        cap = cv2.VideoCapture(video_url)
        if cap.isOpened():
            return cap, None
        return None, None

# --- Analise com Gemini ---

def analyze_frame_with_gemini(frame_bgr, target_type):
    target_map = {
        'carros': 'cars (automobiles, vehicles on the road)',
        'motos': 'motorcycles',
        'pessoas': 'people (pedestrians)',
        'onibus': 'buses',
        'avioes': 'airplanes',
    }
    target_english = target_map.get(target_type, 'cars')

    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(frame_rgb)
    pil_img.thumbnail((640, 480))
    
    buf = BytesIO()
    pil_img.save(buf, format='JPEG', quality=70)
    img_bytes = buf.getvalue()
    
    prompt = f"""You are a computer vision system analyzing a traffic/surveillance camera frame.

TASK: Count ALL {target_english} visible in this image and provide their approximate bounding box locations.

RULES:
- Count EVERY {target_english} you can see, even partially visible ones
- Be precise with the count
- Return bounding boxes as percentage coordinates (0-100) of image width/height

Return ONLY a JSON object in this exact format, no markdown, no extra text:
{{"count": <number>, "boxes": [{{"x1": <left%>, "y1": <top%>, "x2": <right%>, "y2": <bottom%>}}]}}

If you see ZERO {target_english}, return: {{"count": 0, "boxes": []}}"""

    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[
                prompt,
                {
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": base64.b64encode(img_bytes).decode('utf-8')
                    }
                }
            ],
            config={
                "temperature": 0.1,
                "max_output_tokens": 1024
            }
        )
        
        text = response.text.strip()
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        text = text.strip()
        
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"  [WARN] Erro Gemini: {e}")
        return None

def draw_detections(frame, detections, target_type, count, line_config=None):
    h, w = frame.shape[:2]
    overlay = frame.copy()
    
    # Desenhar a linha vermelha customizada
    if line_config:
        lx1 = int(line_config.get('x1', 0) * w)
        ly1 = int(line_config.get('y1', 0.6) * h)
        lx2 = int(line_config.get('x2', 1) * w)
        ly2 = int(line_config.get('y2', 0.6) * h)
        cv2.line(overlay, (lx1, ly1), (lx2, ly2), (0, 0, 255), 2)
    
    target_labels = {
        'carros': 'CARRO',
        'motos': 'MOTO',
        'pessoas': 'PESSOA',
        'onibus': 'ONIBUS',
        'avioes': 'AVIAO',
    }
    label = target_labels.get(target_type, 'OBJ')
    box_color = (0, 255, 100)
    
    if detections and 'boxes' in detections:
        for i, box in enumerate(detections['boxes']):
            try:
                x1 = int(box['x1'] * w / 100)
                y1 = int(box['y1'] * h / 100)
                x2 = int(box['x2'] * w / 100)
                y2 = int(box['y2'] * h / 100)
                
                cv2.rectangle(overlay, (x1, y1), (x2, y2), box_color, 2)
                
                txt = f"{label} #{i+1}"
                (tw, th2), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(overlay, (x1, y1 - th2 - 8), (x1 + tw + 8, y1), box_color, -1)
                cv2.putText(overlay, txt, (x1 + 4, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
            except:
                pass
    
    panel_h = 45
    cv2.rectangle(overlay, (0, 0), (w, panel_h), (0, 0, 0), -1)
    cv2.putText(overlay, "GEMINI AI", (10, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 200, 255), 1, cv2.LINE_AA)
    
    count_text = f"CONTAGEM: {count}"
    cv2.putText(overlay, count_text, (10, 38), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 100), 2, cv2.LINE_AA)
    
    dot_color = (0, 255, 0) if int(time.time() * 2) % 2 == 0 else (0, 100, 0)
    cv2.circle(overlay, (w - 20, 22), 6, dot_color, -1)
    cv2.putText(overlay, "LIVE", (w - 65, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 1, cv2.LINE_AA)
    
    result = cv2.addWeighted(overlay, 0.85, frame, 0.15, 0)
    return result

# --- Loop Principal por Mercado ---

def process_market(market):
    market_id = market['id']
    active_markets[market_id] = True
    title = market['title']
    target_type = market.get('ai_counter_type', 'carros')
    
    print(f"\n{'='*60}")
    print(f"[START] Iniciando Analise Gemini AI: {title}")
    print(f"   Alvo: {target_type} | Tipo: {market.get('video_type')}")
    print(f"{'='*60}")
    
    cap, local_path = open_video(market)
    if cap is None or not cap.isOpened():
        print(f"  [ERRO] Nao foi possivel abrir o video para '{title}'")
        active_markets[market_id] = False
        return
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    is_static = market.get('video_type') in ['upload', 'static_link']
    
    print(f"  [OK] Video conectado! FPS: {fps:.1f}")
    
    current_db_count = market.get('ai_current_count') or 0
    local_count = current_db_count
    market_counts[market_id] = local_count
    
    line_config = market.get('ai_line_config')
    if not line_config:
        # Fallback to old ai_line_y if missing
        line_y = market.get('ai_line_y') or 0.6
        line_config = {"x1": 0, "y1": line_y, "x2": 1, "y2": line_y}
        
    last_gemini_time = 0
    last_db_update = time.time()
    last_detections = None
    frame_count = 0
    GEMINI_INTERVAL = 5
    
    # Anti-duplication tracker for vehicles crossing the line
    tracked_centers = [] # list of (cx, cy, timestamp)
    
    try:
        while active_markets.get(market_id, False):
            ret, frame = cap.read()
            
            if not ret or frame is None:
                if is_static:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = cap.read()
                    if not ret:
                        time.sleep(1)
                        continue
                else:
                    time.sleep(0.1)
                    continue
            
            frame_count += 1
            frame = cv2.resize(frame, (640, 360))
            
            now = time.time()
            
            if now - last_gemini_time >= GEMINI_INTERVAL:
                last_gemini_time = now
                
                print(f"  [AI] [{title}] Analisando frame #{frame_count} com Gemini...")
                result = analyze_frame_with_gemini(frame, target_type)
                
                if result and 'boxes' in result:
                    # Filter boxes that intersect the custom line
                    h, w = frame.shape[:2]
                    lx1 = int(line_config.get('x1', 0) * w)
                    ly1 = int(line_config.get('y1', 0.6) * h)
                    lx2 = int(line_config.get('x2', 1) * w)
                    ly2 = int(line_config.get('y2', 0.6) * h)
                    
                    new_crossed = 0
                    current_time = time.time()
                    
                    for box in result['boxes']:
                        try:
                            bx1 = int(box['x1'] * w / 100)
                            by1 = int(box['y1'] * h / 100)
                            bx2 = int(box['x2'] * w / 100)
                            by2 = int(box['y2'] * h / 100)
                            bw, bh = bx2 - bx1, by2 - by1
                            
                            # Check intersection with line segment
                            rect = (bx1, by1, bw, bh)
                            intersects, _, _ = cv2.clipLine(rect, (lx1, ly1), (lx2, ly2))
                            
                            if intersects:
                                cx, cy = bx1 + bw/2, by1 + bh/2
                                # Check if close to an already counted vehicle (within last 30s)
                                is_duplicate = False
                                for (tcx, tcy, tts) in tracked_centers:
                                    if current_time - tts < 30:
                                        dist = ((cx - tcx)**2 + (cy - tcy)**2)**0.5
                                        if dist < max(w, h) * 0.15: # 15% of screen distance
                                            is_duplicate = True
                                            break
                                
                                if not is_duplicate:
                                    tracked_centers.append((cx, cy, current_time))
                                    new_crossed += 1
                        except Exception as e:
                            print(f"  [WARN] Erro box: {e}")
                            pass
                            
                    # Clean up old tracked centers
                    tracked_centers = [tc for tc in tracked_centers if current_time - tc[2] < 30]

                    last_detections = result
                    if new_crossed > 0:
                        local_count += new_crossed
                        market_counts[market_id] = local_count
                    
                    n_boxes = len(result.get('boxes', []))
                    print(f"  [RESULT] [{title}] Detectou: {len(result['boxes'])} totais, {new_crossed} na linha | Total: {local_count}")
                else:
                    print(f"  [WARN] [{title}] Gemini nao retornou dados validos")
            
            if last_detections:
                out_frame = draw_detections(frame, last_detections, target_type, local_count, line_config)
            else:
                out_frame = draw_detections(frame, None, target_type, local_count, line_config)
            
            ret_enc, buffer = cv2.imencode('.jpg', out_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret_enc:
                latest_frames[market_id] = buffer.tobytes()
            
            if now - last_db_update > 5.0:
                m_data = db_get_market(market_id)
                if m_data:
                    if m_data.get('status') != 'active':
                        print(f"  [STOP] [{title}] Mercado fechado pelo admin.")
                        break
                    
                    if m_data.get('end_date'):
                        try:
                            end_date = datetime.datetime.fromisoformat(m_data['end_date'].replace('Z', '+00:00'))
                            if datetime.datetime.now(datetime.timezone.utc) >= end_date:
                                target = m_data.get('ai_target_count') or 0
                                winner = 'yes' if local_count >= target else 'no'
                                print(f"\n  [TIME] TEMPO ESGOTADO: '{title}'")
                                print(f"  [END] RESULTADO: {winner.upper()} (Alvo: {target}, Final: {local_count})")
                                db_update_market(market_id, {'status': 'closed', 'winner_side': winner, 'ai_current_count': local_count})
                                break
                        except:
                            pass
                    
                    if local_count != current_db_count:
                        db_update_market(market_id, {'ai_current_count': local_count})
                        current_db_count = local_count
                
                last_db_update = now
            
            if is_static:
                time.sleep(1.0 / fps)
            else:
                time.sleep(0.03)
    
    except Exception as e:
        print(f"  [ERRO] Erro em '{title}': {e}")
        traceback.print_exc()
    finally:
        active_markets[market_id] = False
        if market_id in latest_frames:
            del latest_frames[market_id]
        if cap:
            cap.release()
        print(f"  [FIM] [{title}] Processamento encerrado.")

# --- Sweeper ---

def sweeper():
    print("[SWEEP] Varredor de Mercados Ativado (a cada 8s)")
    while True:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/markets?status=eq.active&select=*", 
                headers=db_headers(), timeout=5
            )
            if resp.status_code == 200:
                markets = [m for m in resp.json() if m.get('video_type')]
                
                current_active = set()
                for m in markets:
                    m_id = m['id']
                    current_active.add(m_id)
                    if not active_markets.get(m_id):
                        active_markets[m_id] = True
                        threading.Thread(target=process_market, args=(m,), daemon=True).start()
                
                for m_id in list(active_markets.keys()):
                    if m_id not in current_active:
                        active_markets[m_id] = False
        except Exception as e:
            print(f"  [WARN] Erro no sweeper: {e}")
        
        time.sleep(8)

# --- Endpoints Flask ---

@app.route('/video_feed/<market_id>')
def video_feed(market_id):
    def generate():
        while True:
            frame = latest_frames.get(market_id)
            if frame:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.05)
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/status')
def status():
    return {
        'active_markets': list(active_markets.keys()),
        'counts': market_counts,
        'streaming': list(latest_frames.keys())
    }

# --- Main ---

def main():
    print("")
    print("="*60)
    print("  FORESIGHT AI SERVER -- Powered by Google Gemini")
    print("="*60)
    threading.Thread(target=sweeper, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False, use_reloader=False)

if __name__ == "__main__":
    main()
