import os
import json
from flask import Flask, send_from_directory, jsonify, request
from pdf_parser import parse_pdf, build_catalog
from scheduler import solve_schedules

app = Flask(__name__, static_folder="static")

PDF_FILENAME = "2026-2027 Güz Ders Programı.pdf"
CATALOG_PATH = os.path.join("static", "courses_data.json")

def ensure_catalog_exists():
    if not os.path.exists(CATALOG_PATH):
        print("[Sunucu] courses_data.json bulunamadı, PDF ayrıştırılıyor...")
        if os.path.exists(PDF_FILENAME):
            courses = parse_pdf(PDF_FILENAME)
            catalog = build_catalog(courses)
            with open(CATALOG_PATH, "w", encoding="utf-8") as f:
                json.dump(catalog, f, ensure_ascii=False, indent=2)
            print(f"[Sunucu] {len(courses)} ders ayrıştırıldı ve kaydedildi.")
        else:
            print(f"[Uyarı] {PDF_FILENAME} bulunamadı.")

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")

@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route("/api/catalog", methods=["GET"])
def get_catalog():
    if os.path.exists(CATALOG_PATH):
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"error": "Catalog not found"}), 404

@app.route("/api/solve", methods=["POST"])
def solve():
    data = request.get_json() or {}
    courses = data.get("courses", [])
    criteria = data.get("criteria", {})
    max_results = data.get("max_results", 50)
    
    results = solve_schedules(courses, criteria, max_results)
    return jsonify({"schedules": results, "count": len(results)})

@app.route("/api/upload-pdf", methods=["POST"])
def upload_pdf():
    if "file" not in request.files:
        return jsonify({"error": "Dosya seçilmedi"}), 400
    file = request.files["file"]
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Yalnızca ESTÜ ders programı PDF dosyaları geçerlidir."}), 400
    
    scratch_dir = "scratch"
    os.makedirs(scratch_dir, exist_ok=True)
    temp_path = os.path.join(scratch_dir, f"upload_{os.getpid()}_{file.filename}")
    try:
        file.save(temp_path)
        courses = parse_pdf(temp_path)
        if not courses:
            return jsonify({"error": "Ders tablosu bulunamadı. Yalnızca ESTÜ ders programları geçerlidir."}), 400
        catalog = build_catalog(courses)
        return jsonify({
            "success": True,
            "catalog": catalog,
            "course_count": len(courses),
            "filename": file.filename
        })
    except Exception as e:
        return jsonify({"error": f"PDF işlenemedi: {str(e)}"}), 500
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

def get_lan_ip():
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    ensure_catalog_exists()
    port = int(os.environ.get("PORT", 5000))
    lan_ip = get_lan_ip()
    print(f"==================================================")
    print(f" ESTÜ Ders Programı Hazırlama Otomasyonu")
    print(f" Yerel adres (PC):    http://127.0.0.1:{port}")
    print(f" Wi-Fi / LAN (Mobil): http://{lan_ip}:{port}")
    print(f"==================================================")
    app.run(host="0.0.0.0", port=port, debug=False)
