from database import conn, cursor
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
import cloudinary
import cloudinary.uploader

from fastapi import FastAPI, UploadFile, File
from ultralytics import YOLO
import shutil
import os
import cv2
import time

from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Image
)
from reportlab.lib.styles import getSampleStyleSheet
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175"
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM")
TWILIO_WHATSAPP_TO = os.getenv("TWILIO_WHATSAPP_TO")
TWILIO_CONTENT_SID = os.getenv("TWILIO_CONTENT_SID")

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

# Load accident classification model (custom trained)
model_path = os.getenv("MODEL_PATH", "weights/best.pt")
model = YOLO(model_path)

# Load standard YOLOv8 object-detection model for vehicle identification.
# yolov8n.pt is downloaded automatically by Ultralytics on first run.
detection_model = YOLO("yolov8n.pt")

# COCO class IDs that represent vehicles
VEHICLE_CLASS_IDS = {1, 2, 3, 5, 7}   # bicycle, car, motorcycle, bus, truck
VEHICLE_NAMES = {
    1: "Bicycle",
    2: "Car",
    3: "Motorcycle",
    5: "Bus",
    7: "Truck",
}



def save_accident_frame(video_path, filename):

    os.makedirs("screenshots", exist_ok=True)

    cap = cv2.VideoCapture(video_path)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    middle_frame = total_frames // 2

    cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame)

    success, frame = cap.read()

    if success:

        image_path = f"screenshots/{filename}.jpg"

        cv2.imwrite(image_path, frame)

        cap.release()

        return image_path

    cap.release()

    return None


def detect_vehicles(image_path: str) -> list[str]:
    """Run YOLOv8 object detection on *image_path* and return a deduplicated,
    sorted list of vehicle type names found in the frame (e.g. ['Car', 'Truck']).
    Falls back to an empty list if detection fails or no vehicles are present.
    """
    if not image_path or not os.path.exists(image_path):
        return []

    try:
        det_results = detection_model.predict(
            source=image_path,
            conf=0.25,      # confidence threshold
            verbose=False
        )

        found: set[str] = set()

        for det in det_results:
            if det.boxes is None:
                continue
            for cls_id in det.boxes.cls.tolist():
                cls_int = int(cls_id)
                if cls_int in VEHICLE_CLASS_IDS:
                    found.add(VEHICLE_NAMES[cls_int])

        vehicles = sorted(found)
        print(f"Vehicles detected: {vehicles}")
        return vehicles

    except Exception as exc:
        print(f"Vehicle detection error: {exc}")
        return []


def generate_pdf_report(
    filename,
    status,
    confidence,
    vehicles,
    image_path
):

    os.makedirs("reports", exist_ok=True)

    pdf_path = f"reports/{filename}_report.pdf"

    doc = SimpleDocTemplate(pdf_path)

    styles = getSampleStyleSheet()

    content = []

    content.append(
        Paragraph(
            "AI ACCIDENT DETECTION REPORT",
            styles["Title"]
        )
    )

    content.append(Spacer(1, 12))

    content.append(
        Paragraph(
            f"Generated On: {datetime.now()}",
            styles["Normal"]
        )
    )

    content.append(
        Paragraph(
            f"Video File: {filename}",
            styles["Normal"]
        )
    )

    content.append(
        Paragraph(
            f"Accident Status: {status}",
            styles["Normal"]
        )
    )

    content.append(
        Paragraph(
            f"Confidence Score: {confidence:.2f}%",
            styles["Normal"]
        )
    )

    content.append(
        Paragraph(
            f"Vehicles Detected: {', '.join(vehicles)}",
            styles["Normal"]
        )
    )

    content.append(Spacer(1, 20))

    if image_path and os.path.exists(image_path):
        content.append(
            Image(
                image_path,
                width=300,
                height=180
            )
        )

    content.append(Spacer(1, 20))

    content.append(
        Paragraph(
            "Emergency Alert: Immediate verification recommended.",
            styles["Normal"]
        )
    )

    doc.build(content)

    return pdf_path
def upload_to_cloudinary(image_path):

    result = cloudinary.uploader.upload(image_path)

    return result["secure_url"]


def send_whatsapp_alert(image_url, confidence, vehicles):

    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        return {
            "status": "skipped",
            "sid": None,
            "error": "Twilio credentials are not configured."
        }

    client = Client(
        TWILIO_ACCOUNT_SID,
        TWILIO_AUTH_TOKEN
    )

    try:
        message_payload = {
            "from_": TWILIO_WHATSAPP_FROM,
            "to": TWILIO_WHATSAPP_TO,
            "media_url": [image_url]
        }

        if TWILIO_CONTENT_SID:
            message_payload["content_sid"] = TWILIO_CONTENT_SID
            message_payload["content_variables"] = "{}"
        else:
            message_payload["body"] = (
                "ACCIDENT DETECTED\n\n"
                f"Confidence: {confidence:.2f}%\n\n"
                f"Vehicles: {', '.join(vehicles) if vehicles else 'Unknown'}"
            )

        message = client.messages.create(**message_payload)
        latest_message = message

        for _ in range(4):
            time.sleep(2)
            latest_message = client.messages(message.sid).fetch()
            if latest_message.status not in {"queued", "accepted", "sending", "sent"}:
                break

        error_parts = [
            str(latest_message.error_code)
            if latest_message.error_code
            else None,
            latest_message.error_message
        ]
        error_text = " | ".join(part for part in error_parts if part)

        if latest_message.error_code == 63016:
            error_text = (
                "63016: WhatsApp rejected this free-form message because it "
                "was outside the 24-hour customer service window. Use an "
                "approved template via TWILIO_CONTENT_SID, or send after the "
                "user messages your WhatsApp number."
            )

        print("WhatsApp Status:", latest_message.sid, latest_message.status)

        return {
            "status": latest_message.status,
            "sid": latest_message.sid,
            "error": error_text or None
        }
    except TwilioRestException as exc:
        error_text = exc.msg or str(exc)

        if exc.code == 63016:
            error_text = (
                "63016: WhatsApp rejected this free-form message because it "
                "was outside the 24-hour customer service window. Use an "
                "approved template via TWILIO_CONTENT_SID, or send after the "
                "user messages your WhatsApp number."
            )

        return {
            "status": "failed",
            "sid": None,
            "error": error_text
        }
    except Exception as exc:
        return {
            "status": "failed",
            "sid": None,
            "error": str(exc)
        }



@app.get("/")
def home():
    return {
        "Project": "AI Accident Detection System",
        "Status": "Running Successfully"
    }


@app.post("/upload-video")
async def upload_video(file: UploadFile = File(...)):

    os.makedirs("uploads", exist_ok=True)

    video_path = f"uploads/{file.filename}"

    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    results = model.predict(
        source=video_path,
        save=True
    )

    # Map custom model classes to human-readable names.
    # Update this dictionary based on your specific custom dataset classes.
    accident_detected = False
    confidence = 0

    for result in results:

        if result.probs is not None:

            predicted_class = model.names[result.probs.top1]
            confidence = float(result.probs.top1conf) * 100

            print(
                f"Prediction: {predicted_class} | Confidence: {confidence:.2f}%"
            )

            if predicted_class == "accident":
                accident_detected = True

    status = (
        "ACCIDENT DETECTED"
        if accident_detected
        else "NO ACCIDENT DETECTED"
    )

    image_path = save_accident_frame(
        video_path,
        file.filename
    )

    # Detect real vehicle types from the captured accident frame.
    vehicles_detected = detect_vehicles(image_path)

    pdf_path = generate_pdf_report(
        file.filename,
        status,
        confidence,
        vehicles_detected,
        image_path
    )

    alert_result = {
        "status": "not_triggered",
        "sid": None,
        "error": None
    }

    if accident_detected:
        try:
            image_url = upload_to_cloudinary(image_path)
            alert_result = send_whatsapp_alert(
                image_url,
                confidence,
                vehicles_detected
            )
        except Exception as exc:
            alert_result = {
                "status": "failed",
                "sid": None,
                "error": f"Alert pipeline failed before Twilio send: {exc}"
            }

    cursor.execute(
        """
        INSERT INTO accidents
        (
            filename,
            status,
            confidence,
            vehicles,
            screenshot,
            pdf_report,
            alert_status,
            alert_sid,
            alert_error
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            file.filename,
            status,
            confidence,
            ",".join(vehicles_detected),
            image_path,
            pdf_path,
            alert_result["status"],
            alert_result["sid"],
            alert_result["error"]
        )
    )

    conn.commit()

    return {
        "filename": file.filename,
        "status": status,
        "confidence": round(confidence, 2),
        "vehicles_detected": vehicles_detected,
        "result_folder": "runs/detect",
        "pdf_report": pdf_path,
        "screenshot": image_path,
        "alert": alert_result
    }


@app.get("/dashboard-stats")
def dashboard_stats():

    total_accidents = cursor.execute(
        "SELECT COUNT(*) FROM accidents"
    ).fetchone()[0]

    total_alerts = cursor.execute(
        """
        SELECT COUNT(*)
        FROM accidents
        WHERE alert_status IN
        ('queued', 'accepted', 'sending', 'sent', 'delivered', 'read')
        """
    ).fetchone()[0]

    latest = cursor.execute(
        """
        SELECT confidence, alert_status
        FROM accidents
        ORDER BY id DESC
        LIMIT 1
        """
    ).fetchone()

    latest_confidence = (
        latest[0]
        if latest
        else 0
    )

    return {
        "total_accidents": total_accidents,
        "latest_confidence": latest_confidence,
        "total_alerts": total_alerts,
        "latest_alert_status": latest[1] if latest else "none"
    }
