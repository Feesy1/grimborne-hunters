---
name: grimborne-asset-pipeline
description: >-
  Standard 10-step pipeline for sculpting, validating, and integrating 3D Blender 4.5.9
  Draco GLB assets and PBR textures into Grimborne Hunters. Use whenever creating or
  updating any 3D prop, building, rock, tree, or texture.
---

# Пайплайн создания 3D-ассетов Grimborne Hunters

Следуй полному стандарту из `docs/ASSET_PIPELINE.md` и `docs/VISUAL_STYLE_GUIDE.md`.

## Шаги выполнения
1. **Определи назначение и коллизию:** твёрдый объект, разрушаемый проп или фоновый декор?
2. **Зафиксируй масштаб по герою (`1.60 м`):** сверь габариты с таблицей в `docs/VISUAL_STYLE_GUIDE.md`.
3. **Спроектируй разбиение по материалам:** разные материалы (камень, кованое железо, дерево, стекло) → отдельные именованные меши с общим `origin = (0, 0, 0)`, `1` примитив на меш.
4. **Напиши скрипт Blender в `scratch/`** (НЕ в `D:\GrimborneHunters`!) и выполни через `D:\Blender\blender-4.5.9-windows-x64\blender.exe --background --python ...`:
   - Настоящая геометрия с фасками (bevel), `Y = 0` строго на грунте;
   - Чистые UV (`TEXCOORD_0`) + raytraced Vertex AO (`COLOR_0` в `[0.42..1.00]`);
   - Экспорт Draco GLB (`export_yup=True`, `export_apply=True`, уровень сжатия `6`) в `D:\GrimborneHunters\assets\env\...`.
5. **Отрендери 4-панельное превью** в `scratch/` рядом с голубым манекеном **`1.60 м`** и **обязательно осмотри через `read_file`** (роль Art Director).
6. **Проверь габариты и структуру:** запусти `D:\RGBMoCap\runtime\python.exe tools\check_assets.py`.
7. **Интегрируй в модуль сектора с 1:1 коллайдером (SSOT):** назначь матовые PBR-материалы (`roughness 0.85–0.95` для камня/дерева) и сразу зарегистрируй коллайдер по тем же координатам.
8. **Проверь в живом движке:** запусти `D:\RGBMoCap\runtime\python.exe tools\qa_smoke.py --shots` и осмотри объект рядом с героем при ночном освещении.
9. **Зафиксируй в `docs/CHANGELOG.md`.**
