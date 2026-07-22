@echo off
cd /d "%~dp0"
echo Starting ASTEM Attendance web app...
echo.
"C:\nvm4w\nodejs\node.exe" dev-server.cjs
echo.
echo Server stopped. Press any key to close this window.
pause >nul

