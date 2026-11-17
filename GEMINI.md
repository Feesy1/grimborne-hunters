# Grimborne Hunters («Охотники Мрака») — Контекст проекта для нового диалога

Отвечать пользователю на **русском языке**. Перед коммитом проверять синтаксис JS (`--check`) и живую сцену без консольных/сетевых ошибок.

## 1. Общие сведения и деплой
- **Репозиторий**: `D:\GrimborneHunters` -> `https://github.com/Feesy1/grimborne-hunters.git` (ветка `main`).
- **Онлайн-ссылка (GitHub Pages)**: `https://feesy1.github.io/grimborne-hunters/?v=20261117z20`.
- **Cache-buster (обязательно обновлять при каждом пуше!)**: `?v=20261117z20` используется в `index.html`, `manifest.json`, `README.md`, `ИГРАТЬ_НА_ТЕЛЕФОНЕ.md`, `Запустить_игру.cmd`, `Запустить_на_Mac.command`, `js/*.js` — увеличивать суффикс (`z20`, `z21`, …), чтобы на iPhone и MacBook Safari не зависал кэш.
- **Локальный запуск**: `server.ps1 -Port 8090` (`Запустить_игру.cmd` для Windows, `Запустить_на_Mac.command` для macOS).
- **Стек**: Vanilla ES Modules + Three.js `r160`, без сборщика, локальный + Yandex SDK fallback (`js/yandexSdk.js`).

## 2. Основные модули (`D:\GrimborneHunters\js\`)
- `config.js`: классы героев, арсенал оружия, 16 архетипов врагов и 5 боссов, 25 уровней кампании.
  - **Чумной зомби (`plague_zombie`)**: ослаблен до `hp: 50`, `damage: 8`, `speed: 2.35`.
  - **Опыт за уровень**: снижен в 10 раз по просьбе пользователя.
  - **Стрелок (`gunslinger`)**: стартует с `usp_pistol` («Тактический USP», 15 патр., перезарядка 2.0 с, пробитие брони 15%), далее `colt` -> `smg` -> `pistol` (охотничье ружьё с дозарядкой по 1 патрону) -> `ak47`.
- `models.js`: прогрессивный загрузчик 3D-моделей (Tier-1 приоритетно грузит активного героя, его оружие и врагов текущей главы; `*_Tripo.glb` оптимизированы по текстурам, статическое оружие облегчено). Особые эффекты: светящиеся глаза и вырез сферы посоха Воды (`buildStaffGlobeCutoutAlphaMap`, `buildTripoSkullEyeEmissiveMap`), оверлеи анимаций рук Воина и Стрелка под каждое оружие.
- `world.js` & `css/style.css`: оптимизация под MacBook и iPhone — потолок DPR (`1.0` моб / `1.35` ПК), отключение MSAA при `devicePixelRatio >= 1.5`, тени `512 BasicShadowMap` / `1024 PCFShadowMap` (отключены на рядовых зомби), пулинг VFX (`SlashArc`, `DangerZone`, `MuzzleFlash`, `Shockwave`), автопереход в `setLowSpecMode(true)` при просадке FPS ниже `43`, без `backdrop-filter: blur` поверх живого WebGL.
- `audio.js` & `main.js`: процедурный DOOM-подобный саундтрек и профили звуков для огнестрельного и ближнего оружия с раздельными ползунками Музыки и Эффектов; общий `musicGuitarShaper` и защита от спама `setMusicMode()`.
- `combat.js`, `progression.js`, `ui.js`: боевая логика, кислотные лужи слизней, сохранения (`grimborne_save_v1`) и хаб/HUD на русском.
