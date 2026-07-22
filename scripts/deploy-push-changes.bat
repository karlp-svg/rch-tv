@echo off
echo ============================================
echo   RCH TV - Push Code Changes
echo ============================================
echo.
echo Commits and pushes any pending changes to GitHub.
echo.
cd /d "%~dp0.."

git add .
if %ERRORLEVEL% neq 0 goto error

git commit -m "Add deploy target system for multi-deployment"
if %ERRORLEVEL% neq 0 (
  echo.
  echo Nothing to commit (or commit failed).
  echo If you have local changes, they are staged.
)

git push
if %ERRORLEVEL% neq 0 goto error

echo.
echo ============================================
echo   SUCCESS! Code pushed.
echo ============================================
echo.
echo Vercel will auto-deploy all three projects.
echo.
echo Wait ~2 minutes then check:
echo  - rch-tv-public.vercel.app
echo  - rch-tv-dj.vercel.app
echo  - rch-tv-tv.vercel.app
echo.
pause
exit /b 0

:error
echo.
echo ERROR! Push failed.
pause
exit /b 1
