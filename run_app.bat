@echo off
echo ==========================================
echo       INICIANDO SISTEMA AREPAS ERP
echo ==========================================
echo.

:: 1. Start Backend using python -m to avoid PATH issues
echo [1/2] Iniciando Servidor Backend (API)...
start "ArepasERP Backend" cmd /k "python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000"

:: 2. Wait 3 seconds for backend to warm up
timeout /t 3 >nul
echo.

:: 3. Start Frontend
echo [2/2] Iniciando Servidor Frontend (React)...
echo.
cd frontend

:: Use npm.cmd explicitly to avoid potential confusion, though npm usually works in cmd
echo Ejecutando 'npm run dev'...
echo Si este paso falla, asegurese de tener Node.js instalado.
echo.
cmd /c "npm run dev"

echo.
echo ==========================================
echo Si ves errores arriba, por favor toma una captura.
echo Presiona cualquier tecla para cerrar esta ventana...
pause
