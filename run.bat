@echo off
chcp 65001 > nul
echo ===================================================
echo  ESTÜ Ders Programı Hazırlama Otomasyonu
echo ===================================================
echo Tarayıcı açılıyor ve yerel sunucu başlatılıyor...
start "" "http://127.0.0.1:5000"
python app.py
pause

