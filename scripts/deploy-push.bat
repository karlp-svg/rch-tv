@echo off
setlocal enabledelayedexpansion
echo ============================================
echo   RCH TV - Push Local Changes to GitHub
echo ============================================
echo.
cd /d "%~dp0.."

set /p MSG="Enter a commit message (e.g. deploy): "
if "%MSG%"=="" set MSG=deploy

echo.
echo Step 1: Adding all changed files...
git add .

echo Step 2: Committing changes...
git commit -m "!MSG!"
if !ERRORLEVEL! neq 0 goto skip

echo Step 3: Ensuring remote is set...
git remote remove origin 2>nul
git remote add origin https://github.com/karlp-svg/rch-tv.git

echo Step 4: Pushing to GitHub...
git push -u origin main
if !ERRORLEVEL! neq 0 goto error

echo.
echo ============================================
echo   SUCCESS! Code pushed to GitHub.
echo ============================================
echo.
echo Vercel will now auto-deploy all three projects
echo (public, dj, tv) in the next 1-2 minutes.
echo.
pause
exit /b 0

:skip
echo.
echo Nothing new to commit. Pushing anyway...
git remote remove origin 2>nul
git remote add origin https://github.com/karlp-svg/rch-tv.git
git push -u origin main
if !ERRORLEVEL! neq 0 goto error
echo.
pause
exit /b 0

:error
echo.
echo ERROR! Push failed. Check output above.
pause
exit /b 1
