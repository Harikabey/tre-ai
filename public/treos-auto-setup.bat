@echo off
setlocal

set "ASSET_BASE_URL=__TREOS_ASSET_BASE_URL__"
set "EXPECTED_SHA256=86f31cc7cf3dcaed4337e61e26d86e2ded06fa1380d8e844c4ff18259084c572"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 veya uzeri gerekli. Node.js'i resmi kaynaktan yukleyip betigi yeniden calistirin.
  goto :done
)
node -e "if (Number(process.versions.node.split('.')[0]) ^< 18) process.exit(1)"
if errorlevel 1 (
  echo Node.js 18 veya uzeri gerekli.
  goto :done
)

echo TreOS Simulator baslatiliyor...
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $simulator = Join-Path $env:TEMP ('treos-local-simulator-' + [guid]::NewGuid().ToString() + '.mjs'); try { Invoke-WebRequest -UseBasicParsing -Uri '%ASSET_BASE_URL%/treos-local-simulator.mjs' -OutFile $simulator; if ((Get-FileHash -Algorithm SHA256 -LiteralPath $simulator).Hash -ne '%EXPECTED_SHA256%') { throw 'Simulator SHA-256 verification failed.' }; & node $simulator 2>&1 | ForEach-Object { $line = [string]$_; Write-Host $line; if ($line -match '(https?://[^\s]+/mcp)') { $url = $Matches[1]; $url | Set-Clipboard; Write-Host 'URL panoya kopyalandı. TreOS arayüzüne yapıştırın.' } }; if ($LASTEXITCODE -ne 0) { throw ('Simulator exited with code ' + $LASTEXITCODE) } } catch { Write-Host $_.Exception.Message; exit 1 } finally { Remove-Item -LiteralPath $simulator -Force -ErrorAction SilentlyContinue }"
if errorlevel 1 (
  echo Simulator baslatilamadi. Ag erisimini ve SHA-256 dogrulamasini kontrol edin.
)

:done
pause
