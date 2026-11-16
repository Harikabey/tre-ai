@echo off
setlocal

where py >nul 2>&1
if not errorlevel 1 goto use_py
where python >nul 2>&1
if errorlevel 1 goto no_python

set "RIGOUT_PYTHON=python"
set "RIGOUT_PY_ARGS="
python -m pip install rigout
if errorlevel 1 goto install_failed
goto launch_rigout

:use_py
set "RIGOUT_PYTHON=py"
set "RIGOUT_PY_ARGS=-3"
py -3 -m pip install rigout
if errorlevel 1 goto install_failed
goto launch_rigout

:launch_rigout
set "RIGOUT_LOG=%TEMP%\treos-rigout-%RANDOM%.log"
set "RIGOUT_CONFIG=%~dp0rigout-config.json"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $arguments=@(); if($env:RIGOUT_PY_ARGS){$arguments += $env:RIGOUT_PY_ARGS.Split(' ')}; $arguments += @('-u','-m','rigout'); $log=$env:RIGOUT_LOG; $process=Start-Process -FilePath $env:RIGOUT_PYTHON -ArgumentList $arguments -RedirectStandardOutput $log -RedirectStandardError ($log+'.err') -WindowStyle Hidden -PassThru; $url='http://127.0.0.1:8765/mcp'; $token=''; for($i=0;$i -lt 30 -and !$token;$i++){Start-Sleep -Seconds 2; $text=''; foreach($path in @($log,($log+'.err'))){if(Test-Path $path){$text+=(Get-Content -Raw $path)}}; $urlMatch=[regex]::Match($text,'(?im)https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:/\S*)?'); if($urlMatch.Success){$url=$urlMatch.Value.TrimEnd('.',',',')')}; $tokenMatch=[regex]::Match($text,'(?im)(?:bearer\s+)?(?:access\s+)?token(?:\x22|\x27)?\s*[:=]\s*(?:\x22|\x27)?([A-Za-z0-9._~+/-]{8,}={0,})'); if($tokenMatch.Success){$token=$tokenMatch.Groups[1].Value}}; $json=[ordered]@{url=$url;token=$token}|ConvertTo-Json -Compress; [IO.File]::WriteAllText($env:RIGOUT_CONFIG,$json,[Text.UTF8Encoding]::new($false))"
if errorlevel 1 goto launch_failed
del /q "%RIGOUT_LOG%" "%RIGOUT_LOG%.err" >nul 2>&1
powershell -NoProfile -Command "if((Get-Content -Raw $env:RIGOUT_CONFIG | ConvertFrom-Json).token){exit 0}else{exit 1}"
if errorlevel 1 (echo Token otomatik algilanamadi; TreOS'ta elle girmeniz gerekebilir.) else (echo Token bilgisi config dosyasina yazildi.)
echo Kurulum tamamlandi, TreOS'a donun.
echo Yapilandirma: "%RIGOUT_CONFIG%"
pause
exit /b 0

:no_python
echo Python bulunamadi. Python 3 kurup bu betigi yeniden calistirin.
pause
exit /b 1

:install_failed
echo Rigout kurulumu basarisiz oldu. Internet baglantinizi ve Python pip kurulumunu kontrol edin.
pause
exit /b 1

:launch_failed
if defined RIGOUT_LOG del /q "%RIGOUT_LOG%" "%RIGOUT_LOG%.err" >nul 2>&1
echo Rigout baslatilamadi veya yapilandirma dosyasi yazilamadi.
pause
exit /b 1
