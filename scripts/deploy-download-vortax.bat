@echo off
echo ============================================
echo   RCH TV - Download Custom Font Files
echo ============================================
echo.
echo Downloads the bundled Vortax and Westmeath font files
echo into public\fonts so they can be committed to GitHub.
echo.
cd /d "%~dp0.."

echo Step 1: Creating public\fonts folder...
if not exist public\fonts mkdir public\fonts

echo Step 2: Downloading Vortax fonts...
curl -L -o "public\fonts\Vortax.woff2" "https://3000-iffecjhmzhuonxwxcc4ee.e2b.app/fonts/Vortax.woff2"
if %ERRORLEVEL% neq 0 goto error
curl -L -o "public\fonts\Vortax.otf" "https://3000-iffecjhmzhuonxwxcc4ee.e2b.app/fonts/Vortax.otf"
if %ERRORLEVEL% neq 0 goto error

echo Step 3: Downloading Westmeath fonts...
curl -L -o "public\fonts\Westmeath.woff2" "https://3000-inpiifb1zlzv02lf7rmol.e2b.app/fonts/Westmeath.woff2"
if %ERRORLEVEL% neq 0 goto error
curl -L -o "public\fonts\Westmeath.otf" "https://3000-inpiifb1zlzv02lf7rmol.e2b.app/fonts/Westmeath.otf"
if %ERRORLEVEL% neq 0 goto error

echo Step 4: Verifying downloads...
if not exist public\fonts\Vortax.woff2 goto error
if not exist public\fonts\Westmeath.woff2 goto error
dir public\fonts\*.*

echo.
echo ============================================
echo   SUCCESS! All fonts downloaded into public\fonts.
echo ============================================
echo.
echo NOW RUN:  deploy-push.bat   (to commit and push to GitHub)
echo.
pause
exit /b 0

:error
echo.
echo ERROR! Download failed. Check your network connection.
echo.
pause
exit /b 1
