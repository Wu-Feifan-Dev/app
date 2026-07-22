@echo off
chcp 65001 >nul
title 项目计划进行表 - 服务器
cd /d "%~dp0"

echo ========================================
echo   项目计划进行表 启动程序
echo ========================================
echo.

REM 检查服务器是否已在运行
netstat -ano | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [√] 本地服务器已在运行
) else (
    echo [1/2] 正在启动本地服务器...
    start /b "" "C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe" server.js
    timeout /t 3 /nobreak >nul
    echo [√] 本地服务器已启动 (端口 3000)
)

echo [2/2] 正在启动 cpolar 内网穿透...
echo.
echo ========================================
echo   网站启动后，看下面 cpolar 输出的网址！
echo   网址格式类似: https://xxx.r19.cpolar.top
echo.
echo   登录密码: 今天的日期 (年月日)
echo   例如: 20260706
echo ========================================
echo.
echo   注意: 这个窗口不能关！关了网站就打不开了
echo   最小化即可，不要关闭
echo.
echo ========================================
echo.

"C:\Program Files\cpolar\cpolar.exe" http 3000

pause
