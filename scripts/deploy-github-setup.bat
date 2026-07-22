@echo off
echo ============================================
echo   RCH TV - GitHub Setup and Push
echo ============================================
echo.
echo This commits all files and pushes to GitHub
echo so Vercel can deploy from the repo.
echo.
echo Make sure you have created an EMPTY repository
echo on GitHub called "rch-tv" first:
echo   github.com - New repository - name "rch-tv"
echo   (do NOT tick any initialise boxes)
echo.
set /p REPO_URL="Enter your GitHub repo URL (https://github.com/USERNAME/rch-tv.git): "
echo.
cd /d "%~dp0.."

echo Step 1: Initialising Git...
git init
if %ERRORLEVEL% neq 0 goto error

echo Step 2: Adding all files...
git add .
if %ERRORLEVEL% neq 0 goto error

echo Step 3: Committing...
git commit -m "RCH TV initial deploy"
if %ERRORLEVEL% neq 0 goto error

echo Step 4: Setting main branch...
git branch -M main
if %ERRORLEVEL% neq 0 goto error

echo Step 5: Adding remote...
git remote add origin %REPO_URL%
if %ERRORLEVEL% neq 0 goto error

echo Step 6: Pushing (overwriting any default GitHub files like README)...
git push -u origin main --force
if %ERRORLEVEL% neq 0 goto error

echo.
echo ============================================
echo   SUCCESS! Code is on GitHub.
echo ============================================
echo.
echo Now deploy on Vercel:
echo 1. vercel.com - sign in with GitHub
echo 2. Add New - Project - import "rch-tv"
echo 3. Add the 4 environment variables (see README.txt Step 4)
echo 4. Click Deploy
echo.
pause
exit /b 0

:error
echo.
echo ERROR! Git push failed. Check the message above.
echo If the repo already has commits, you may need to run:
echo   git remote remove origin
echo and try again.
echo.
pause
exit /b 1
