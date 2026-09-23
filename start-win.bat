@echo off
title Alcove Server
cd /d "%~dp0"

echo ========================================================
echo   Alcove - Private Journal
echo ========================================================
echo.
echo Serving directory: %~dp0
echo URL: http://localhost:8000
echo.

:: Launch default browser
start "" "http://localhost:8000"

:: Check if python is available
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Starting Python HTTP server on port 8000...
    python -m http.server 8000
    goto :end
)

:: Check if py launcher is available
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Starting Python (py launcher) HTTP server on port 8000...
    py -m http.server 8000
    goto :end
)

:: PowerShell fallback HTTP server using HttpListener
echo Python was not detected. Launching lightweight PowerShell HTTP server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = New-Object System.Net.HttpListener; $listener.Prefixes.Add('http://localhost:8000/'); $listener.Start(); Write-Host 'PowerShell HTTP Server listening on http://localhost:8000 (Ctrl+C to terminate)...'; $mimeTypes = @{ '.html'='text/html'; '.css'='text/css'; '.js'='application/javascript'; '.json'='application/json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon' }; while ($listener.IsListening) { $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response; $urlPath = $request.Url.LocalPath.TrimStart('/'); if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = 'index.html' }; $filePath = Join-Path (Get-Location) $urlPath; if (Test-Path $filePath -PathType Leaf) { $ext = [System.IO.Path]::GetExtension($filePath).ToLower(); $response.ContentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { 'application/octet-stream' }; $bytes = [System.IO.File]::ReadAllBytes($filePath); $response.ContentLength64 = $bytes.Length; $response.OutputStream.Write($bytes, 0, $bytes.Length); } else { $response.StatusCode = 404; $buffer = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found'); $response.ContentLength64 = $buffer.Length; $response.OutputStream.Write($buffer, 0, $buffer.Length); }; $response.OutputStream.Close(); }"

:end
pause
