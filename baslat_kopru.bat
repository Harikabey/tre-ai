@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if not errorlevel 1 goto use_py

where python >nul 2>&1
if errorlevel 1 goto no_python

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto python_too_old

echo TreOS health sunucusu baslatiliyor. Kapatmak icin CTRL+C basin.
python treos_bridge.py
if errorlevel 1 goto run_failed
exit /b 0

:use_py
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto python_too_old

echo TreOS health sunucusu baslatiliyor. Kapatmak icin CTRL+C basin.
py -3 treos_bridge.py
if errorlevel 1 goto run_failed
exit /b 0

:no_python
echo Python bulunamadi. Python 3.10 veya daha yeni bir surum kurup tekrar deneyin.
pause
exit /b 1

:python_too_old
echo Python 3.10 veya daha yeni bir surum gerekli.
pause
exit /b 1

:run_failed
echo TreOS health sunucusu hata ile sonlandi.
pause
exit /b 1
