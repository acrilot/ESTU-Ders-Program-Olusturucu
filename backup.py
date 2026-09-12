import os
import shutil
import datetime
import zipfile

def create_backup(version_name=None):
    os.makedirs("backups", exist_ok=True)
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    if not version_name:
        version_name = f"backup_{timestamp}"
    else:
        version_name = f"{version_name}_{timestamp}"
        
    zip_path = os.path.join("backups", f"{version_name}.zip")
    
    ignore_dirs = {".git", "__pycache__", "backups", "env", "venv"}
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                if file.endswith((".pyc", ".pyo", ".zip")):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, ".")
                zipf.write(file_path, arcname)
                
    print(f"[Yedekleme] Başarılı: {zip_path}")
    return zip_path

if __name__ == "__main__":
    import sys
    ver = sys.argv[1] if len(sys.argv) > 1 else "v1.0.0"
    create_backup(ver)

