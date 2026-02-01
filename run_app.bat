@echo off
setlocal
echo ==========================================
echo       SISTEMA AREPAS ERP - INICIO LIMPIO
echo ==========================================
echo.

:: 1. Cleanup existing processes to avoid "Port already in use" errors
echo [1/3] Limpiando procesos antiguos...
taskkill /F /IM python.exe /T 2>nul
taskkill /F /IM node.exe /T 2>nul
echo OK.
echo.

:: 2. Start Backend
echo [2/3] Iniciando Servidor Backend (Puerto 8000)...
:: We use port 8000 as standard. Removing --reload for better stability as requested.
start "ArepasERP Backend" cmd /k "python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

:: 3. Wait for backend
echo Esperando que el backend inicie...
timeout /t 5 >nul
echo.

:: 4. Start Frontend
echo [3/3] Iniciando Servidor Frontend...
echo.
cd frontend

:: Ensure the frontend knows we are on port 8000 (it will be updated in the code too)
echo Ejecutando 'npm run dev'...
echo.
cmd /c "npm run dev"

echo.
echo ==========================================
echo Si el sistema no abre automaticamente, ve a: http://localhost:5173
echo (O el puerto que indique Vite arriba)
echo.
pause
