@echo off
setlocal
echo =======================================================
echo Pushing Hydro Repository to https://github.com/YashUpadhyay5/hydro.git
echo =======================================================
echo.
set "GIT_CMD=C:\Users\Falcon\.gemini\antigravity\brain\a91f5a61-88ec-4d94-a155-e930d1ca57db\scratch\mingit\cmd\git.exe"

if not exist "%GIT_CMD%" (
    where git >nul 2>nul
    if %errorlevel% equ 0 (
        set "GIT_CMD=git"
    ) else (
        echo [ERROR] Git was not found!
        pause
        exit /b 1
    )
)

echo Using Git at: %GIT_CMD%
echo.
"%GIT_CMD%" push -u origin main
echo.
if %errorlevel% equ 0 (
    echo [SUCCESS] Code successfully pushed to GitHub!
) else (
    echo [NOTE] If prompted for authentication:
    echo 1. Generate a GitHub Personal Access Token (Classic) at: https://github.com/settings/tokens
    echo 2. Check the 'repo' scope checkbox.
    echo 3. When Git asks for password in the terminal, paste your Token!
)
echo.
pause
