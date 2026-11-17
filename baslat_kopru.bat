@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
  if not errorlevel 1 goto use_py
  goto python_too_old
)
where python >nul 2>&1
if errorlevel 1 goto no_python
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto python_too_old

set "TREOS_ALLOWED_ORIGINS="
set /p "TREOS_ALLOWED_ORIGINS=TreOS sayfa kaynagini girin (bos birakilirsa yayinlanan TreOS ve localhost izinleri kullanilir): "
echo TreOS koprusu arka planda baslatiliyor...
echo Rigout ve HTTPS sertifika bagimliligi kuruluyor veya guncelleniyor...
python -m pip install --upgrade rigout cryptography
if errorlevel 1 goto install_failed
start "TreOS Rigout Koprusu" /min python "%~dp0treos_bridge.py"
echo.
echo TreOS koprusu https://127.0.0.1:8765/mcp adresinde baslatildi.
echo Ilk kullanimda https://127.0.0.1:8765/healthz adresinde sertifika uyarisi onaylanmalidir.
echo Rigout servis portu 8766 olarak ayrildi.
echo Uretim TreOS adresini yetkilendirmek icin TREOS_ALLOWED_ORIGINS ortam degiskenini ayarlayin.
pause
exit /b 0

:use_py
set "TREOS_ALLOWED_ORIGINS="
set /p "TREOS_ALLOWED_ORIGINS=TreOS sayfa kaynagini girin (bos birakilirsa yayinlanan TreOS ve localhost izinleri kullanilir): "
echo TreOS koprusu arka planda baslatiliyor...
echo Rigout ve HTTPS sertifika bagimliligi kuruluyor veya guncelleniyor...
py -3 -m pip install --upgrade rigout cryptography
if errorlevel 1 goto install_failed
start "TreOS Rigout Koprusu" /min py -3 "%~dp0treos_bridge.py"
echo.
echo TreOS koprusu https://127.0.0.1:8765/mcp adresinde baslatildi.
echo Ilk kullanimda https://127.0.0.1:8765/healthz adresinde sertifika uyarisi onaylanmalidir.
echo Rigout servis portu 8766 olarak ayrildi.
echo Uretim TreOS adresini yetkilendirmek icin TREOS_ALLOWED_ORIGINS ortam degiskenini ayarlayin.
pause
exit /b 0

:no_python
echo Python bulunamadi. Python 3 kurup bu dosyayi yeniden calistirin.
pause
exit /b 1

:python_too_old
echo Python 3.10 veya daha yeni bir surum gerekli.
pause
exit /b 1

:install_failed
echo Rigout kurulumu basarisiz oldu. Internet baglantinizi ve pip kurulumunu kontrol edin.
pause
exit /b 1
