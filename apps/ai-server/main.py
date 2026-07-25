import cv2
import time
import datetime
import threading
import os
import traceback
import json
import requests
from ultralytics import YOLO
from dotenv import load_dotenv
from flask import Flask, Response
from flask_cors import CORS
import yt_dlp
import streamlink

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL') or os.getenv('SUPABASE_URL')
SUPABASE_KEY = os.getenv('VITE_SUPABASE_ANON_KEY') or os.getenv('SUPABASE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRO: Configure SUPABASE_URL e SUPABASE_KEY no arquivo .env")
    exit(1)

# Carregar modelo YOLOv8 leve
print("Carregando modelo de Inteligência Artificial (YOLOv8)...")
model = YOLO('yolov8n.pt')

# Classes COCO usadas
COCO_CLASSES = {
    'carros': 2,
    'motos': 3,
    'pessoas': 0
}

app = Flask(__name__)
CORS(app)

active_markets = {}
latest_frames = {}

class VideoStream:
    """ Lê frames em uma thread separada para manter o buffer sempre vazio (evita lag) """
    def __init__(self, src):
        self.stream = cv2.VideoCapture(src)
        self.ret, self.frame = self.stream.read()
        self.stopped = False

    def start(self):
        threading.Thread(target=self.update, args=(), daemon=True).start()
        return self

    def update(self):
        while True:
            if self.stopped:
                self.stream.release()
                return
            self.ret, self.frame = self.stream.read()

    def read(self):
        return self.ret, self.frame

    def stop(self):
        self.stopped = True

def get_stream_url(video_url, video_type):
    if video_type == 'ipcam' or video_type == 'upload':
        return video_url
    if video_type == 'youtube':
        ydl_opts = {
            'format': 'best',
            'quiet': True,
            'no_warnings': True,
            'extractor_args': {'youtube': {'player_client': ['android']}},
            'cookiefile': 'cookies.txt',
            'simulate': True
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(video_url, download=False)
                return info_dict.get('url')
        except Exception as e:
            print(f"Erro yt-dlp fallback: {e}")
        try:
            streams = streamlink.streams(video_url)
            if 'best' in streams:
                return streams['best'].url
            elif '720p' in streams:
                return streams['720p'].url
            else:
                return list(streams.values())[-1].url
        except Exception as e:
            print(f"Erro ao extrair stream do YouTube: {e}")
            return None
    return video_url

def db_get_market(market_id):
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}
    try:
        resp = requests.get(f"{SUPABASE_URL}/rest/v1/markets?id=eq.{market_id}&select=*", headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data[0] if data else None
    except:
        pass
    return None

def db_update_market(market_id, payload):
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}
    try:
        requests.patch(f"{SUPABASE_URL}/rest/v1/markets?id=eq.{market_id}", json=payload, headers=headers, timeout=5)
    except:
        pass

def process_market(market):
    market_id = market['id']
    active_markets[market_id] = True
    
    print(f"\n--- Iniciando Processamento YOLOv8 para o mercado: {market['title']} ---")
    
    target_class_id = COCO_CLASSES.get(market.get('ai_counter_type', 'carros'), 2)
    stream_url = get_stream_url(market['video_url'], market['video_type'])
    
    if not stream_url:
        print("URL de stream inválida.")
        active_markets[market_id] = False
        return
        
    cap = VideoStream(stream_url).start()
    time.sleep(1)
    
    if cap.frame is None:
        print("Não foi possível abrir o feed de vídeo.")
        active_markets[market_id] = False
        cap.stop()
        return

    print(f"[{market['title']}] Conectado ao feed! Iniciando rastreamento INSTANTÂNEO...")
    
    counted_ids = set()
    previous_cy = {}
    last_update_time = time.time()
    
    current_db_count = market.get('ai_current_count') or 0
    current_line_y_percent = market.get('ai_line_y') or 0.6
    local_count = current_db_count
    line_flash_time = 0

    try:
        while active_markets.get(market_id, False):
            ret, frame = cap.read()
            if not ret or frame is None:
                continue
                
            frame = cv2.resize(frame, (640, 360))
            h, w = frame.shape[:2]
            line_y = int(h * current_line_y_percent)
                
            # Rastreamento YOLO instantâneo
            results = model.track(frame, persist=True, classes=[target_class_id], verbose=False)
            annotated_frame = results[0].plot()
            
            line_color = (0, 255, 0)
            if time.time() - line_flash_time < 0.3:
                line_color = (0, 0, 255) # Pisca a linha quando cruza
            
            if results[0].boxes.id is not None:
                boxes = results[0].boxes
                ids = boxes.id.cpu().tolist()
                coords = boxes.xywh.cpu().tolist()
                
                for obj_id, coord in zip(ids, coords):
                    cx, cy, cw, ch = coord
                    
                    # Lógica Robusta de Cruzamento de Linha (Centro de Massa)
                    if obj_id in previous_cy:
                        prev_y = previous_cy[obj_id]
                        
                        # Verifica se pulou a linha de cima pra baixo OU de baixo pra cima
                        if (prev_y < line_y and cy >= line_y) or (prev_y > line_y and cy <= line_y):
                            if obj_id not in counted_ids:
                                counted_ids.add(obj_id)
                                local_count += 1
                                line_flash_time = time.time()
                                print(f"[{market['title']}] +1 Veículo (ID: {obj_id}). Total: {local_count}")
                                
                    previous_cy[obj_id] = cy
                        
            # Desenha a linha configurada pelo admin
            cv2.line(annotated_frame, (0, line_y), (w, line_y), line_color, 2)
            cv2.putText(annotated_frame, f"CONTAGEM: {local_count}", (10, line_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.7, line_color, 2)

            ret_enc, buffer = cv2.imencode('.jpg', annotated_frame)
            if ret_enc:
                latest_frames[market_id] = buffer.tobytes()

            now = time.time()
            if now - last_update_time > 3.0:
                m_data = db_get_market(market_id)
                if m_data:
                    if m_data.get('status') != 'active':
                        print(f"[{market['title']}] Fechado ou excluído pelo Admin.")
                        break

                    current_line_y_percent = m_data.get('ai_line_y') or current_line_y_percent
                    
                    if m_data.get('end_date'):
                        end_date = datetime.datetime.fromisoformat(m_data['end_date'].replace('Z', '+00:00'))
                        if datetime.datetime.now(datetime.timezone.utc) >= end_date:
                            print(f"\n⏰ TEMPO ESGOTADO para o mercado: '{market['title']}'!")
                            target = m_data.get('ai_target_count') or 0
                            winner = 'yes' if local_count >= target else 'no'
                            
                            print(f"🏁 RESOLUÇÃO AUTOMÁTICA: Venceu {winner.upper()} (Alvo: {target}, Placar Final: {local_count})")
                            db_update_market(market_id, {'status': 'closed', 'winner_side': winner, 'ai_current_count': local_count})
                            break

                    if local_count != current_db_count:
                        db_update_market(market_id, {'ai_current_count': local_count})
                        current_db_count = local_count

                last_update_time = now

    except Exception as e:
        print(f"Erro no processamento de {market['title']}: {e}")
        traceback.print_exc()
    finally:
        active_markets[market_id] = False
        if market_id in latest_frames:
            del latest_frames[market_id]
        if 'cap' in locals():
            cap.stop()

def sweeper():
    print("=== Varredor de Mercados YOLOv8 Ativado ===")
    while True:
        try:
            headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
            resp = requests.get(f"{SUPABASE_URL}/rest/v1/markets?status=eq.active&select=*", headers=headers, timeout=5)
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
            pass
        
        time.sleep(5)

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

def main():
    print("=== Foresight AI Backend Iniciado (YOLOv8 Instantâneo) ===")
    threading.Thread(target=sweeper, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False, use_reloader=False)

if __name__ == "__main__":
    main()
