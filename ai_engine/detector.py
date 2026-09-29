"""
Módulo de Visão Computacional com OpenCV & YOLO (Ultralytics / ONNX)
Executa a detecção de veículos em vídeo local ou stream RTSP e envia a telemetria para o servidor web.
"""

import os
import sys
import time
import json
import argparse
import requests
import cv2
import numpy as np

# Configurações padrão
SERVER_URL = os.environ.get("PARKING_SERVER_URL", "http://localhost:3000").rstrip("/")
API_URL = SERVER_URL + "/api/telemetry"
ZONES_URL = SERVER_URL + "/api/zones"
VOLUNTEER_TOKEN = os.environ.get("VOLUNTEER_TOKEN", "")
AUTH_HEADERS = {"Authorization": f"Bearer {VOLUNTEER_TOKEN}"} if VOLUNTEER_TOKEN else {}

def load_zones_from_server():
    """Busca as definições de polígonos salvas no servidor local."""
    try:
        res = requests.get(ZONES_URL, timeout=3)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"[Aviso] Não foi possível carregar zonas do servidor: {e}")
    return []

def point_in_polygon(point, polygon):
    """Verifica se um ponto (x, y) normalizado [0, 1] está dentro do polígono."""
    pts = np.array([[int(p['x'] * 1000), int(p['y'] * 1000)] for p in polygon], dtype=np.int32)
    test_pt = (int(point[0] * 1000), int(point[1] * 1000))
    return cv2.pointPolygonTest(pts, test_pt, False) >= 0

def run_detector(video_source, model_name="yolov8n.pt", send_telemetry=True):
    print(f"==================================================")
    print(f"Iniciando Detector de Veículos (OpenCV + YOLO)")
    print(f"Fonte: {video_source}")
    print(f"Modelo: {model_name}")
    print(f"==================================================")

    # Inicializa modelo YOLO
    try:
        from ultralytics import YOLO
        model = YOLO(model_name)
    except ImportError:
        print("[ERRO] Pacote ultralytics não instalado. Instale com: pip install -r requirements.txt")
        return

    # Abre captura de vídeo (Arquivo ou RTSP)
    cap = cv2.VideoCapture(video_source)
    if not cap.isOpened():
        print(f"[ERRO] Não foi possível abrir a fonte de vídeo: {video_source}")
        return

    zones = load_zones_from_server()
    last_zones_sync = time.time()
    last_telemetry_time = 0

    frame_count = 0
    fps_start = time.time()
    current_fps = 0

    # Classes COCO para veículos: 2: car, 3: motorcycle, 5: bus, 7: truck
    VEHICLE_CLASSES = [2, 3, 5, 7]

    while True:
        ret, frame = cap.read()
        if not ret:
            # Se for vídeo local e terminou, reinicia loop
            if isinstance(video_source, str) and not video_source.startswith("rtsp://"):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                print("[Aviso] Perda de sinal no stream da câmera.")
                break

        h, w, _ = frame.shape
        frame_count += 1

        # Calcula FPS real
        if time.time() - fps_start >= 1.0:
            current_fps = frame_count
            frame_count = 0
            fps_start = time.time()

        # Recarrega zonas do servidor periodicamente
        if time.time() - last_zones_sync > 10:
            zones = load_zones_from_server()
            last_zones_sync = time.time()

        # Inferência com YOLO (resolução de inferência 640 para velocidade em CPU)
        results = model.predict(source=frame, classes=VEHICLE_CLASSES, conf=0.45, imgsz=640, verbose=False)
        detections = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                xyxy = box.xyxy[0].tolist()
                conf = float(box.conf[0])
                cls = int(box.cls[0])

                bx = xyxy[0] / w
                by = xyxy[1] / h
                bw = (xyxy[2] - xyxy[0]) / w
                bh = (xyxy[3] - xyxy[1]) / h

                detections.append({
                    "x": bx,
                    "y": by,
                    "width": bw,
                    "height": bh,
                    "confidence": conf,
                    "label": "car"
                })

        # Processa contagem por setor
        sector_results = []
        for zone in zones:
            pts = zone.get("points", [])
            cars_in_zone = 0

            for det in detections:
                ground_pt = (det["x"] + det["width"] / 2, det["y"] + det["height"] * 0.85)
                if point_in_polygon(ground_pt, pts):
                    cars_in_zone += 1

            cap_limit = zone.get("maxEstimatedCapacity", 10)
            ratio = cars_in_zone / max(1, cap_limit)

            status = "available_probable"
            if ratio >= 0.85:
                status = "full"
            elif ratio >= 0.55:
                status = "moderate"

            sector_results.append({
                "id": zone["id"],
                "detectedCarsCount": cars_in_zone,
                "aiStatus": "uncertain",
                "uncertaintyReason": "Contagem sem calibração não comprova espaço para estacionar.",
                "notes": f"{cars_in_zone} veículos identificados por visão computacional."
            })

        # Envia telemetria para o servidor
        now = time.time()
        if send_telemetry and (now - last_telemetry_time > 1.0):
            last_telemetry_time = now
            payload = {
                "producer": "detector",
                "fps": current_fps,
                "visibilityQuality": "good",
                "videoSource": {
                    "name": "Pipeline Python OpenCV + YOLO",
                    "type": "rtsp_stream" if str(video_source).startswith("rtsp://") else "local_video"
                },
                "sectors": sector_results
            }
            try:
                requests.post(API_URL, json=payload, headers=AUTH_HEADERS, timeout=0.8)
            except Exception:
                pass

        # Exibe janela local com OpenCV para depuração (opcional)
        for det in detections:
            cv2.rectangle(
                frame,
                (int(det["x"] * w), int(det["y"] * h)),
                (int((det["x"] + det["width"]) * w), int((det["y"] + det["height"]) * h)),
                (0, 255, 0), 2
            )

        cv2.putText(frame, f"FPS: {current_fps} | Carros: {len(detections)}", (20, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)

        cv2.imshow("Monitoramento Lagoinha (Preview OpenCV)", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Detector OpenCV de Estacionamento")
    parser.add_argument("--source", type=str, default="0", help="Arquivo de vídeo local ou URL RTSP (0 para webcam)")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Modelo YOLO (ex: yolov8n.pt, yolov8s.pt)")
    args = parser.parse_args()

    # Se a fonte for número (ex: webcam 0), converte para inteiro
    src = int(args.source) if args.source.isdigit() else args.source
    run_detector(src, args.model)
