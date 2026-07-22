@echo off
echo ============================================
echo   RCH TV - Local Development Server
echo ============================================
echo.
echo Runs the app locally for testing.
echo Uses the .env file for DATABASE_URL.
echo (Photos stored as base64 unless you also set
echo  Supabase env vars in .env)
echo.
cd /d "%~dp0.."

echo Step 1: Installing dependencies...
rmdir /s /q node_modules 2>nul
call npm install --force
if %ERRORLEVEL% neq 0 goto error

echo Step 2: Pushing schema to database...
call npx drizzle-kit push
if %ERRORLEVEL% neq 0 goto error

echo Step 3: Starting dev server at http://localhost:3000
echo Press Ctrl+C to stop.
echo.
call npm run dev

exit /b 0

:error
echo.
echo ERROR! Check that your local PostgreSQL is running
echo and .env has a valid DATABASE_URL.
echo.
pause
exit /b 1
