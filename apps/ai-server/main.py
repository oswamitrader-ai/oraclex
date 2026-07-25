import os
import time
import cv2
import yt_dlp
import streamlink
import traceback
import datetime
import threading
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv
from flask import Flask, Response
from flask_cors import CORS

# Carregar variáveis de ambiente (Supabase URL e KEY)
load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRO: Configure SUPABASE_URL e SUPABASE_KEY no arquivo .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Carregar modelo YOLOv8 leve
print("Carregando modelo de Inteligência Artificial (YOLOv8)...")
model = YOLO('yolov8n.pt') 

# Dicionário de tradução PT -> EN (classes do COCO dataset)
COCO_CLASSES = {
    'carros': 2,    # 'car' class id no YOLO
    'pessoas': 0,   # 'person' class id
    'motos': 3,     # 'motorcycle' class id
    'onibus': 5,    # 'bus' class id
    'avioes': 4     # 'airplane' class id
}

# -------------------------------------------------------------
# CONFIGURAÇÃO FLASK (SERVIDOR DE STREAMING MJPEG)
# -------------------------------------------------------------
app = Flask(__name__)
CORS(app)

latest_frames = {}  # Dicionário para armazenar o último frame gerado (market_id -> bytes JPEG)
active_markets = {} # Dicionário para controlar quais mercados estão rodando (market_id -> bool)

def generate_frames(market_id):
    """Gera um fluxo MJPEG contínuo enviando os frames processados."""
    while True:
        frame_bytes = latest_frames.get(market_id)
        if frame_bytes:
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        else:
            time.sleep(0.1)

@app.route('/video_feed/<market_id>')
def video_feed(market_id):
    """Endpoint onde o Frontend vai se conectar para ver o vídeo do mercado ao vivo."""
    return Response(generate_frames(market_id), mimetype='multipart/x-mixed-replace; boundary=frame')

# -------------------------------------------------------------
# MOTOR DE VISÃO COMPUTACIONAL DA IA
# -------------------------------------------------------------

class VideoStream:
    def __init__(self, src):
        self.stream = cv2.VideoCapture(src)
        self.ret, self.frame = self.stream.read()
        self.stopped = False
        self.frame_ready = threading.Event()
        self.frame_ready.set()
        
    def start(self):
        threading.Thread(target=self.update, daemon=True).start()
        return self
        
    def update(self):
        while True:
            if self.stopped:
                self.stream.release()
                return
            ret, frame = self.stream.read()
            if not ret:
                self.stopped = True
            else:
                self.ret = ret
                self.frame = frame
                self.frame_ready.set()
                
    def read(self):
        self.frame_ready.wait()
        self.frame_ready.clear()
        return self.ret, self.frame
        
    def stop(self):
        self.stopped = True


def get_stream_url(video_url, video_type):
    """Extrai o link raw do vídeo se for YouTube, ou retorna direto se for IP Cam"""
    if video_type == 'youtube':
        # yt-dlp com extração de cookies do navegador do usuário
        # Isso burla o "Sign in to confirm you're not a bot"
        # Vamos usar o cliente "android" do YouTube (mobile) que não exige
        # desafios complexos de Javascript nem bloqueia facilmente por "bot"
        try:
            ydl_opts = {
                'format': 'best', 
                'quiet': True,
                'extractor_args': {'youtube': {'player_client': ['android', 'web']}}
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(video_url, download=False)
                return info_dict.get('url')
        except Exception as e:
            print(f"Erro yt-dlp client android: {e}")
            
        # Fallback sem cookies se o android falhar
        try:
            ydl_opts = {'format': 'best', 'quiet': True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(video_url, download=False)
                return info_dict.get('url')
        except Exception as e:
            print(f"Erro yt-dlp fallback: {e}")
            
        # Fallback para o streamlink antigo
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

def process_market(market):
    market_id = market['id']
    active_markets[market_id] = True
    print(f"\n--- Iniciando Processamento AI para o mercado: {market['title']} ---")
    
    target_class_id = COCO_CLASSES.get(market.get('ai_counter_type', 'carros'), 2)
    stream_url = get_stream_url(market['video_url'], market['video_type'])
    
    if not stream_url:
        print("URL de stream inválida.")
        active_markets[market_id] = False
        return
        
    # Inicializa o fluxo de vídeo em background (Evita travamentos e lags no buffer)
    cap = VideoStream(stream_url).start()
    
    # Aguarda 1 segundo para garantir que o primeiro frame foi lido
    time.sleep(1)
    
    if cap.frame is None:
        print("Não foi possível abrir o feed de vídeo.")
        active_markets[market_id] = False
        cap.stop()
        return

    print(f"[{market['title']}] Conectado ao feed! Iniciando rastreamento...")
    
    counted_ids = set()
    initial_positions = {}
    last_update_time = time.time()
    current_db_count = market.get('ai_current_count') or 0
    local_count = current_db_count
    line_flash_time = 0

    try:
        while active_markets.get(market_id, False):
            ret, frame = cap.read()
            if not ret:
                print(f"[{market['title']}] Fim do feed ou erro na leitura.")
                break
                
            # Resize frame para acelerar drasticamente o FPS
            frame = cv2.resize(frame, (640, 360))
            h, w = frame.shape[:2]
                
            results = model.track(frame, persist=True, classes=[target_class_id], verbose=False)
            annotated_frame = results[0].plot()
            
            # Moldura de cor para feedback visual no Admin
            border_color = (0, 255, 0)
            if time.time() - line_flash_time < 0.3:
                border_color = (0, 0, 255) # Pisca vermelho na borda
            
            if results[0].boxes.id is not None:
                boxes = results[0].boxes
                ids = boxes.id.cpu().tolist()
                coords = boxes.xywh.cpu().tolist()
                
                for obj_id, coord in zip(ids, coords):
                    cx, cy, cw, ch = coord
                    
                    if obj_id not in initial_positions:
                        initial_positions[obj_id] = (cx, cy)
                    else:
                        start_x, start_y = initial_positions[obj_id]
                        # Calcula a distância que o carro percorreu desde que apareceu na tela
                        dist = ((cx - start_x)**2 + (cy - start_y)**2)**0.5
                        
                        # Se o carro se moveu mais de 10% do tamanho da tela, e não foi contado ainda
                        # Isso ignora carros estacionados e falhas de frame
                        if dist > (w * 0.1) and obj_id not in counted_ids:
                            counted_ids.add(obj_id)
                            local_count += 1
                            line_flash_time = time.time()
                            print(f"[{market['title']}] +1 Carro (Moveu {int(dist)}px). Total: {local_count}")
                        
            # Desenha uma borda de feedback na tela do admin
            cv2.rectangle(annotated_frame, (0,0), (w, h), border_color, 4)
            cv2.putText(annotated_frame, "IA MONITORANDO MOVIMENTO", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, border_color, 2)

            # ANNOTATION & STREAMING: Desenhar caixas no frame e salvar em memória para o Flask
            ret_enc, buffer = cv2.imencode('.jpg', annotated_frame)
            if ret_enc:
                latest_frames[market_id] = buffer.tobytes()

            if time.time() - last_update_time > 3.0:
                check_resp = supabase.table('markets').select('*').eq('id', market_id).execute()
                if not check_resp.data or check_resp.data[0]['status'] != 'active':
                    print(f"[{market['title']}] Fechado ou excluído pelo Admin.")
                    break

                m_data = check_resp.data[0]
                
                if m_data.get('end_date'):
                    end_date = datetime.datetime.fromisoformat(m_data['end_date'].replace('Z', '+00:00'))
                    if datetime.datetime.now(datetime.timezone.utc) >= end_date:
                        print(f"\n⏰ TEMPO ESGOTADO para o mercado: '{market['title']}'!")
                        target = m_data.get('ai_target_count') or 0
                        winner = 'yes' if local_count >= target else 'no'
                        
                        print(f"🏁 RESOLUÇÃO AUTOMÁTICA: Venceu {winner.upper()} (Alvo: {target}, Placar Final: {local_count})")
                        supabase.table('markets').update({
                            'status': 'closed',
                            'winner_side': winner,
                            'ai_current_count': local_count
                        }).eq('id', market_id).execute()
                        break

                if local_count != current_db_count:
                    print(f"[{market['title']}] Supabase contagem: {local_count}")
                    supabase.table('markets').update({'ai_current_count': local_count}).eq('id', market_id).execute()
                    current_db_count = local_count
                last_update_time = time.time()

    except Exception as e:
        print(f"Erro no processamento de {market['title']}: {e}")
        traceback.print_exc()
    finally:
        active_markets[market_id] = False
        if market_id in latest_frames:
            del latest_frames[market_id]
        if 'cap' in locals():
            cap.stop()

# -------------------------------------------------------------
# ORQUESTRADOR (VARREDOR DE MERCADOS)
# -------------------------------------------------------------
def sweeper():
    """Procura mercados ativos no banco e garante que as Threads estejam rodando."""
    print("=== Varredor de Mercados Ativado ===")
    while True:
        try:
            response = supabase.table('markets').select('*').eq('status', 'active').execute()
            markets = [m for m in response.data if m.get('video_type')]
            
            current_active = set()
            for m in markets:
                m_id = m['id']
                current_active.add(m_id)
                # Se o mercado está ativo no banco e a thread não está rodando...
                if m_id not in active_markets or not active_markets[m_id]:
                    t = threading.Thread(target=process_market, args=(m,), daemon=True)
                    t.start()
                    time.sleep(2)
            
            # Parar threads de mercados que não estão mais no BD como ativos
            for m_id in list(active_markets.keys()):
                if active_markets[m_id] and m_id not in current_active:
                    print(f"Desligando processamento do mercado {m_id} (não está mais ativo)")
                    active_markets[m_id] = False

        except Exception as e:
            print("Erro no sweeper:")
            traceback.print_exc()
        
        time.sleep(10)

def main():
    print("=== Foresight AI Backend Iniciado ===")
    # Inicia orquestrador em Background
    t_sweeper = threading.Thread(target=sweeper, daemon=True)
    t_sweeper.start()
    
    # Inicia o servidor Web do Flask na thread principal (bloqueia o terminal)
    print("Servidor de Streaming escutando em http://localhost:5000/video_feed/<market_id>")
    app.run(host='0.0.0.0', port=5000, threaded=True, debug=False, use_reloader=False)

if __name__ == "__main__":
    main()
