import cv2
import time
import datetime
import threading
import os
import traceback
import requests
import numpy as np
import math
from dotenv import load_dotenv
from flask import Flask, Response
from flask_cors import CORS

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL') or os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_KEY') or os.getenv('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRO: Configure SUPABASE_URL e SUPABASE_KEY no .env")
    exit(1)

# Carregar Modelo YOLOv4-tiny OpenCV
try:
    net = cv2.dnn.readNet('models/yolov4-tiny.weights', 'models/yolov4-tiny.cfg')
    net.setPreferableBackend(cv2.dnn.DNN_BACKEND_OPENCV)
    net.setPreferableTarget(cv2.dnn.DNN_TARGET_CPU)
    
    with open('models/coco.names', 'r') as f:
        classes = [line.strip() for line in f.readlines()]
        
    layer_names = net.getLayerNames()
    try:
        output_layers = [layer_names[i - 1] for i in net.getUnconnectedOutLayers()]
    except:
        output_layers = [layer_names[i[0] - 1] for i in net.getUnconnectedOutLayers()]
        
    print("[OK] Cerebro OpenCV (YOLOv4-tiny) carregado com sucesso!")
except Exception as e:
    print(f"ERRO: Falha ao carregar modelo OpenCV: {e}")
    exit(1)

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

# --- Centroid Tracker ---
class CentroidTracker:
    def __init__(self, max_disappeared=15):
        self.next_object_id = 0
        self.objects = {}
        self.disappeared = {}
        self.max_disappeared = max_disappeared
        self.crossed = set()
        
    def register(self, centroid):
        self.objects[self.next_object_id] = centroid
        self.disappeared[self.next_object_id] = 0
        self.next_object_id += 1
        
    def deregister(self, object_id):
        del self.objects[object_id]
        del self.disappeared[object_id]
        if object_id in self.crossed:
            self.crossed.remove(object_id)
            
    def update(self, rects):
        if len(rects) == 0:
            for object_id in list(self.disappeared.keys()):
                self.disappeared[object_id] += 1
                if self.disappeared[object_id] > self.max_disappeared:
                    self.deregister(object_id)
            return self.objects
            
        input_centroids = np.zeros((len(rects), 2), dtype="int")
        for (i, (startX, startY, endX, endY)) in enumerate(rects):
            cX = int((startX + endX) / 2.0)
            cY = int((startY + endY) / 2.0)
            input_centroids[i] = (cX, cY)
            
        if len(self.objects) == 0:
            for i in range(0, len(input_centroids)):
                self.register(input_centroids[i])
        else:
            object_ids = list(self.objects.keys())
            object_centroids = list(self.objects.values())
            
            used_rows = set()
            used_cols = set()
            
            for (i, obj_id) in enumerate(object_ids):
                if obj_id in used_rows: continue
                best_dist = float("inf")
                best_col = -1
                
                for (j, pt) in enumerate(input_centroids):
                    if j in used_cols: continue
                    dist = math.dist(object_centroids[i], pt)
                    if dist < best_dist and dist < 120:
                        best_dist = dist
                        best_col = j
                        
                if best_col != -1:
                    self.objects[obj_id] = input_centroids[best_col]
                    self.disappeared[obj_id] = 0
                    used_rows.add(obj_id)
                    used_cols.add(best_col)
                    
            for j in range(len(input_centroids)):
                if j not in used_cols:
                    self.register(input_centroids[j])
                    
            for obj_id in object_ids:
                if obj_id not in used_rows:
                    self.disappeared[obj_id] += 1
                    if self.disappeared[obj_id] > self.max_disappeared:
                        self.deregister(obj_id)
                        
        return self.objects

# --- Processamento de IA ---
def detect_objects(frame, target_type):
    height, width, _ = frame.shape
    blob = cv2.dnn.blobFromImage(frame, 0.00392, (320, 320), (0, 0, 0), True, crop=False)
    net.setInput(blob)
    outs = net.forward(output_layers)
    
    target_map = {
        'carros': ['car', 'truck'],
        'motos': ['motorbike', 'bicycle'],
        'pessoas': ['person'],
        'onibus': ['bus'],
        'avioes': ['aeroplane'],
    }
    allowed_classes = target_map.get(target_type, ['car'])
    
    class_ids = []
    confidences = []
    boxes = []
    
    for out in outs:
        for detection in out:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.4:
                try:
                    if classes[class_id] in allowed_classes:
                        center_x = int(detection[0] * width)
                        center_y = int(detection[1] * height)
                        w = int(detection[2] * width)
                        h = int(detection[3] * height)
                        x = int(center_x - w / 2)
                        y = int(center_y - h / 2)
                        
                        boxes.append([x, y, w, h])
                        confidences.append(float(confidence))
                        class_ids.append(class_id)
                except:
                    pass
                    
    indexes = cv2.dnn.NMSBoxes(boxes, confidences, 0.4, 0.3)
    final_boxes = []
    if len(indexes) > 0:
        for i in indexes.flatten():
            x, y, w, h = boxes[i]
            final_boxes.append((x, y, x + w, y + h))
            
    return final_boxes

def draw_hud(frame, objects, crossed, line_config, count):
    h, w = frame.shape[:2]
    overlay = frame.copy()
    
    # Linha
    lx1 = int(line_config.get('x1', 0) * w)
    ly1 = int(line_config.get('y1', 0.6) * h)
    lx2 = int(line_config.get('x2', 1) * w)
    ly2 = int(line_config.get('y2', 0.6) * h)
    cv2.line(overlay, (lx1, ly1), (lx2, ly2), (0, 0, 255), 2)
    
    # Caixas dos objetos
    for obj_id, (cx, cy) in objects.items():
        color = (0, 255, 0) if obj_id in crossed else (0, 165, 255)
        cv2.circle(overlay, (cx, cy), 4, color, -1)
        cv2.putText(overlay, f"ID {obj_id}", (cx - 10, cy - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
    # Painel HUD
    panel_h = 45
    cv2.rectangle(overlay, (0, 0), (w, panel_h), (0, 0, 0), -1)
    cv2.putText(overlay, "FORESIGHT TRACKER", (10, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (100, 200, 255), 1, cv2.LINE_AA)
    
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
    print(f"[START] Iniciando Cerebro Foresight: {title}")
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
    
    line_config = market.get('ai_line_config') or {"x1": 0, "y1": 0.6, "x2": 1, "y2": 0.6}
        
    last_db_update = time.time()
    frame_count = 0
    
    tracker = CentroidTracker(max_disappeared=15)
    
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
            h, w = frame.shape[:2]
            
            # Line coordinates
            lx1 = int(line_config.get('x1', 0) * w)
            ly1 = int(line_config.get('y1', 0.6) * h)
            lx2 = int(line_config.get('x2', 1) * w)
            ly2 = int(line_config.get('y2', 0.6) * h)
            
            # Detectar (para otimizar, podemos pular frames no futuro, mas YOLOv4-tiny eh rapido o suficiente)
            boxes = detect_objects(frame, target_type)
            objects = tracker.update(boxes)
            
            new_crossed = 0
            
            # Verificar interserccao
            for (startX, startY, endX, endY) in boxes:
                cX = int((startX + endX) / 2.0)
                cY = int((startY + endY) / 2.0)
                
                # Match centroid to object ID
                matched_id = None
                for obj_id, centroid in objects.items():
                    if centroid[0] == cX and centroid[1] == cY:
                        matched_id = obj_id
                        break
                        
                if matched_id is not None and matched_id not in tracker.crossed:
                    rect = (startX, startY, endX - startX, endY - startY)
                    intersects, _, _ = cv2.clipLine(rect, (lx1, ly1), (lx2, ly2))
                    if intersects:
                        tracker.crossed.add(matched_id)
                        new_crossed += 1
                        
            if new_crossed > 0:
                local_count += new_crossed
                market_counts[market_id] = local_count
                print(f"  [RESULT] [{title}] {new_crossed} {target_type} cruzou a linha! | Total: {local_count}")
                
            if frame_count % 30 == 0:
                print(f"  [AI] Processado frame #{frame_count}, {len(objects)} objetos ativos no momento.")
                
            out_frame = draw_hud(frame, objects, tracker.crossed, line_config, local_count)
            
            ret_enc, buffer = cv2.imencode('.jpg', out_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            if ret_enc:
                latest_frames[market_id] = buffer.tobytes()
            
            now = time.time()
            if now - last_db_update > 5.0:
                m_data = db_get_market(market_id)
                if m_data:
                    # Atualiza a linha em tempo real se o admin mudou
                    if m_data.get('ai_line_config'):
                        line_config = m_data.get('ai_line_config')
                        
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

def main():
    print("")
    print("="*60)
    print("  FORESIGHT AI SERVER -- CEREBRO LOCAL YOLOv4-TINY")
    print("="*60)
    threading.Thread(target=sweeper, daemon=True).start()
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False, use_reloader=False)

if __name__ == "__main__":
    main()
