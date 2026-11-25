# Grimborne Hunters — Архитектура проекта (`GAME_ARCHITECTURE`)

## 1. Общая структура модулей (реальная карта импортов)
Весь код игры находится в `D:\GrimborneHunters\js\` и загружается нативными ES-модулями без сборки.

```mermaid
flowchart TD
    HTML["index.html + css/style.css"] --> MAIN["js/main.js (Оркестратор, игровой цикл, сохранения)"]
    MAIN --> INPUT["js/input.js (ПК + Тач-ввод, буфер действий)"]
    MAIN --> UI["js/ui.js + ui/modals, svgIcons, resolvers"]
    MAIN --> AUDIO["js/audio.js + 6 модулей souls*Audio"]
    MAIN --> SDK["js/yandexSdk.js + progression.js"]
    MAIN --> COMBAT["js/combat.js (Бой, движение, интерактив)"]
    MAIN --> WORLD["js/world.js (Three.js сцена, камера, свет, VFX)"]
    MAIN --> MODELS["js/models.js (GLB-загрузчик, анимации, IK)"]

    COMBAT --> CSUB["combat/bridge, bossAi, poiseSystem"]
    COMBAT --> SCOM["souls/soulsLocomotion, StaminaBuffer, HitboxDamage, MobAi, GameFeel, PhysicsFeel, WeaponTrails"]
    WORLD --> CASTLE["js/soulsArena.js + souls/soulsCastle* (Замок Пепла)"]
    WORLD --> SHORE["js/souls/soulsExteriorShore.js (Побег + Внешний мир)"]
    SHORE --> S01["js/souls/soulsSector01Slice.js (Эталон Сектор 01)"]
    SHORE -.-> ARCH["Архив Секторов 02–08 (GorgeRoad, RiverReachEast/North — пауза)"]
    S01 --> MAT["soulsGorgeTerrainMat.js + soulsGorgeAtmosphere.js"]
```

## 2. Игровые потоки данных

### 2.1. Ввод → Движение → Физика → Анимация → Камера
```mermaid
flowchart LR
    INP["input.js (WASD / Roll / LMB / E)"] --> BUF["soulsStaminaBuffer.js"]
    BUF --> COM["combat.js (Состояние героя)"]
    COM --> LOCO["soulsLocomotion.js (Root-Motion 30/60/144 FPS)"]
    LOCO --> CLAMP["world.clampSoulsPosition() → Castle / Sector01 SSOT"]
    CLAMP --> ANIM["models.js + warriorStances.js (Анимации и IK)"]
    CLAMP --> CAM["world.js (Орбитальная камера и плавный фоллоу)"]
```

### 2.2. Атака → Хитбокс → Урон / Разрушение → Реакция
```mermaid
flowchart LR
    ATK["Ввод атаки (R1 / R2 / Roll-Attack)"] --> STATE["Окно замаха и удара (combat.js)"]
    STATE --> HIT["soulsHitboxDamage.js + poiseSystem.js"]
    STATE --> DEST["world.hitShoreDestructibles() (Бочки и ящики)"]
    HIT --> ENEMY["bossAi.js / soulsMobAi.js (Урон, стаггер, рипост)"]
    DEST --> SPL["Щепки + мгновенное снятие коллайдера + playWoodSmash()"]
    ENEMY --> FEED["soulsGameFeel.js (Hitstop, shake) + audio.js"]
```

### 2.3. Материалы и рендер окружения
```mermaid
flowchart LR
    MAPS["Карты (Albedo, Normal, ORM — только нужные)"] --> UV["UV (World Box / Frond)"]
    UV --> VAO["Vertex AO (COLOR_0 из Blender: 0.42..1.0)"]
    VAO --> SHAD["soulsGorgeTerrainMat.js (Матовый PBR: Roughness 0.80–0.97)"]
    SHAD --> LGT["Стационарные PointLights + Moon DirLight + Cool HemiLight"]
    LGT --> TONE["ACES Filmic ToneMapping (1.22) → Экран"]
```

### 2.4. Конвейер загрузки ресурсов
```mermaid
flowchart LR
    GLB["Blender 4.5.9 → Draco GLB"] --> CHK["tools/check_assets.py"]
    CHK --> LOAD["GLTFLoader + DRACOLoader (vendor/)"]
    LOAD --> CACHE["Кэш мешей + клонирование с общими материалами"]
    CACHE --> SSOT["Регистрация коллайдера в той же функции спавна"]
    SSOT --> QA["tools/qa_smoke.py (0 ошибок, FPS >= 60)"]
```

## 3. Архитектурные правила роста (как избегать техдолга)
1. **Не раздувать 4 монолита** (`combat.js` 11.6k, `models.js` 11.6k, `css/style.css` 11.2k, `world.js` 9.4k). Любая новая подсистема (новый сектор, новый тип врага, механика костра, новый тип интерактива) пишется **отдельным ES-модулем** до `1 500` строк и подключается в монолит через 5–15 строк делегирования.
2. **Единый источник истины (SSOT):** геометрия мира, высоты `evalGroundY`, типы поверхностей `evalSurfaceType` и коллизии `clampPosition` одного сектора обязаны жить в одном модуле сектора.
3. **Запрещено динамически создавать/удалять `PointLight` в кадре** (вызывает компиляцию шейдеров и фризы) — использовать заранее созданные стационарные источники света и менять только их `intensity`.
4. **Запрещены внешние CDN-запросы** во время игры — все библиотеки (`Three.js`, `GLTFLoader`, `DRACOLoader`, `draco_wasm_wrapper`) лежат локально в `vendor/`.
5. **Чистота памяти (VRAM):** все созданные геометрии/материалы/текстуры регистрируются через `trackGeo` / `trackMat` / `trackTex` и освобождаются в `dispose()`.
