import requests

def get_frame():
    url = 'http://127.0.0.1:5000/video_feed/d3b4d08a-fbdd-4f43-b64d-d189f252ce83'
    r = requests.get(url, stream=True)
    buffer = b''
    for chunk in r.iter_content(chunk_size=1024):
        buffer += chunk
        if b'\xff\xd9' in buffer: # End of JPEG
            start = buffer.find(b'\xff\xd8')
            end = buffer.find(b'\xff\xd9') + 2
            if start != -1 and end != -1:
                jpg = buffer[start:end]
                with open('frame_test.jpg', 'wb') as f:
                    f.write(jpg)
                print(f"Salvou frame com {len(jpg)} bytes")
                return

get_frame()
