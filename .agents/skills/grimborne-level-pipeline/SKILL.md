---
name: grimborne-level-pipeline
description: >-
  Standard workflow and 10-point quality checklist for building or upgrading any
  game sector in Grimborne Hunters (Region I River Reach and beyond) using the
  Sector 01 vertical-slice gold standard. Use when creating or modifying any level zone.
---

# Пайплайн создания игровой локации (сектора)

Эталон реализации — `js/souls/soulsSector01Slice.js`. Полные правила — в `docs/LEVEL_DESIGN_GUIDE.md`.

## Порядок работы
1. **Сверься с глобальной картой и атласом:** проверь стык высот и ширины дороги с предыдущим сектором.
2. **Спроектируй маршруты, ориентир (Landmark) и шорткаты:** не более 1 костра на сектор; у каждого объекта — чёткая логика (ноль «высыпанного мусора»).
3. **Создай изолированный модуль сектора** (`js/souls/soulsSector0X*.js`, до `1 500` строк) с единой функцией `evalTerrainY(x, z)` и `evalSurfaceType(x, z)`.
4. **Подготовь 3D-ассеты** по навыку `grimborne-asset-pipeline` (переиспользуй готовые GLB, скульпть только недостающие).
5. **Зарегистрируй 1:1 коллизии (SSOT):** каждый твёрдый и разрушаемый объект добавляет коллайдер в момент размещения меша.
6. **Настрой честное освещение и горизонт:** стационарные `PointLight`, матовые материалы (`soulsGorgeTerrainMat.js`), закрытый скалами/лесом горизонт без «обрывов в небо».
7. **Добавь ассерты коллизий нового сектора** в `tools/qa_smoke.py`.
8. **Прогони QA и осмотри 6–8 скриншотов от уровня глаз:** `D:\RGBMoCap\runtime\python.exe tools\qa_smoke.py --shots`.
9. **Пройди чек-лист приёмки** из `docs/LEVEL_DESIGN_GUIDE.md` (все 10 пунктов обязательны).
10. **Обнови `docs/SYSTEM_REGISTRY.md`, `docs/CHANGELOG.md` и выложи сборку через `tools/release.py`**, прикрепив ссылку на игру.
