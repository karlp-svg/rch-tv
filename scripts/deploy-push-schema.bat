@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   RCH TV - Push Database Schema to Supabase
echo ============================================
echo.
echo Creates all database tables in your Supabase project.
echo.
echo You need the DATABASE_URL from Supabase:
echo   Project Settings - Database - Connection string - URI
echo   (replace [password] with your actual database password)
echo.
set /p DB_URL="Paste the Supabase DATABASE_URL here: "
echo.
cd /d "%~dp0.."

echo Step 1: Saving DATABASE_URL to .env and .env.prod...
(
  echo DATABASE_URL=!DB_URL!
) > .env.prod
(
  echo DATABASE_URL=!DB_URL!
) > .env
echo DONE.

echo.
echo Step 2: Clean installing dependencies...
rmdir /s /q node_modules 2>nul
call npm install --force
if %ERRORLEVEL% neq 0 goto error

echo.
echo Step 3: Pushing schema to Supabase...
echo   (if this hangs, you may need to enable IPv4 in Supabase)
echo.
set DATABASE_URL=!DB_URL!
call npx drizzle-kit push --config=drizzle.config.prod.ts
if %ERRORLEVEL% neq 0 goto error

echo.
echo ============================================
echo   SUCCESS! All tables created in Supabase.
echo ============================================
echo.
del .env.prod 2>nul
echo.
echo Now run:  deploy-github-setup.bat
echo Then:     deploy on vercel.com (add the 4 env vars)
echo.
pause
exit /b 0

:error
echo.
echo ERROR! Schema push failed.
echo.
echo Things to check:
echo 1. Make sure [password] part was replaced with your real password
echo 2. Supabase project is running - check supabase.com dashboard
echo 3. If you see "password auth failed", the password is wrong
echo    Reset it in Supabase: Project Settings - Database
echo.
del .env.prod 2>nul
pause
exit /b 1
