@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if errorlevel 1 goto no_python
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>&1
if errorlevel 1 goto python_too_old

echo Rigout ve PyInstaller kuruluyor...
py -3 -m pip install --upgrade rigout pyinstaller
if errorlevel 1 goto install_failed

echo TreOS-Bridge.exe olusturuluyor...
py -3 -m PyInstaller --clean --noconfirm --onefile --console --name TreOS-Bridge --distpath build\dist --workpath build\work --specpath build --collect-all rigout treos_bridge.py
if errorlevel 1 goto build_failed

copy /y "build\dist\TreOS-Bridge.exe" "public\TreOS-Bridge.exe" >nul
if errorlevel 1 goto copy_failed

echo.
echo Basarili: public\TreOS-Bridge.exe
echo Vercel dagitiminda kullanmak icin degisikligi commit edip yeniden deploy edin.
pause
exit /b 0

:no_python
echo Python Launcher bulunamadi. Python 3.10 veya yenisini kurun.
pause
exit /b 1

:python_too_old
echo Python 3.10 veya daha yeni bir surum gerekli.
pause
exit /b 1

:install_failed
echo Bagimliliklar kurulamadi. Internet baglantinizi ve pip kurulumunu kontrol edin.
pause
exit /b 1

:build_failed
echo PyInstaller derlemesi basarisiz oldu.
pause
exit /b 1

:copy_failed
echo EXE olusturuldu ancak public klasorune kopyalanamadi.
pause
exit /b 1
