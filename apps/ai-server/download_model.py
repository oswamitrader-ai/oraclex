import requests
import os

os.makedirs('models', exist_ok=True)

def download(url, filename):
    print(f"Baixando {filename}...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    r = requests.get(url, headers=headers, stream=True)
    r.raise_for_status()
    with open(filename, 'wb') as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)

download('https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg', 'models/yolov4-tiny.cfg')
download('https://github.com/AlexeyAB/darknet/releases/download/darknet_yolo_v4_pre/yolov4-tiny.weights', 'models/yolov4-tiny.weights')
download('https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/coco.names', 'models/coco.names')

print("Modelos YOLOv4-tiny baixados com sucesso!")
