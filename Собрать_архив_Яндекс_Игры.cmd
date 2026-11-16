@echo off
chcp 65001 >nul
title Сборка архива для Яндекс Игр
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root = '%~dp0'; $zip = Join-Path $root 'GrimborneHunters_YandexGames.zip'; if (Test-Path $zip) { Remove-Item $zip -Force }; Compress-Archive -Path (Join-Path $root 'index.html'), (Join-Path $root 'css'), (Join-Path $root 'js'), (Join-Path $root 'vendor'), (Join-Path $root 'assets') -DestinationPath $zip -Force; Write-Host 'Готово! Архив для Яндекс Игр создан:' $zip -ForegroundColor Green"
pause
