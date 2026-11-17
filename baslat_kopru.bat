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

echo TreOS koprusu arka planda baslatiliyor...
start "TreOS Rigout Koprusu" /min python "%~dp0treos_bridge.py"
echo.
echo TreOS koprusu http://127.0.0.1:8765/mcp adresinde baslatildi.
echo Rigout servis portu 8766 olarak ayrildi.
echo Uretim TreOS adresini yetkilendirmek icin TREOS_ALLOWED_ORIGINS ortam degiskenini ayarlayin.
pause
exit /b 0

:use_py
echo TreOS koprusu arka planda baslatiliyor...
start "TreOS Rigout Koprusu" /min py -3 "%~dp0treos_bridge.py"
echo.
echo TreOS koprusu http://127.0.0.1:8765/mcp adresinde baslatildi.
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
