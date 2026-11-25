---
name: grimborne-team
description: >-
  Orchestrates the 9 specialized AI engineering and art roles for Grimborne Hunters
  (Game Architect, Gameplay Programmer, Level Designer, Technical Artist,
  3D Environment Artist, Animation Specialist, Performance Engineer,
  QA/Testing Agent, and Art Director). Use when planning or executing multi-system
  features, new sectors, 3D assets, combat/animation changes, or architectural refactors.
---

# Grimborne Hunters — AI-команда специалистов (9 ролей)

Команда из 9 специализированных ролей предотвращает хаотичные правки, смешение стилей и регрессии. Не вызывай все 9 ролей на мелкую правку — подключай **только нужных специалистов** по матрице ниже.

Полные инструкции и шаблоны системных промптов для каждой роли: [roles.md](./references/roles.md).

## Матрица подключения ролей по типу задачи

| Тип задачи | Обязательные роли (субагенты / проходы) | Обязательный финальный контроль |
| :--- | :--- | :--- |
| **Новый сектор локации** | 1. Game Architect + 3. Level Designer → 5. 3D Environment Artist (Blender-субагент) + 4. Technical Artist | 9. Art Director + 7. Performance Engineer + 8. QA Agent |
| **Новый 3D-ассет / проп** | 5. 3D Environment Artist (Blender-субагент) + 4. Technical Artist | 9. Art Director (превью с манекеном `1.60 м`) + `tools/check_assets.py` |
| **Боёвка / Враг / Механика** | 1. Game Architect → 2. Gameplay Programmer + 6. Animation Specialist | 8. QA Agent (проверка Замка + Сектора 01) |
| **Освещение / Материалы / VFX** | 4. Technical Artist + 9. Art Director | 7. Performance Engineer (FPS) + 8. QA Agent (живые скриншоты) |
| **Исправление бага** | 1. Game Architect (причина + зависимости) → профильный исполнитель (2 / 4 / 6) | 8. QA Agent (исходный баг + регрессия) |

## Правило запуска реальных субагентов
- **Всегда запускай отдельного субагента** (`define_subagent` + `invoke_subagent`), если:
  - нужно параллельно скульптить 2+ набора Blender GLB (`3D Environment Artist`);
  - нужен глубокий независимый аудит большого монолита (`combat.js`, `models.js`, `world.js`);
  - задача состоит из 2+ независимых модулей, которые можно делать одновременно.
- Для остальных ролей используй профили из [roles.md](./references/roles.md) как обязательные контрольные ворота (gates) до написания кода и перед выкладкой.

## Обязательный порядок работы
1. Сверь задачу с `docs/SYSTEM_REGISTRY.md` и `docs/TECHNICAL_DECISIONS.md`.
2. Если задача крупная — заполни короткий бриф по `docs/TASK_BRIEF_TEMPLATE.md` и зафиксируй приоритет (`P0–P3`).
3. Выполни работу строго по профильному пайплайну (`grimborne-asset-pipeline`, `grimborne-level-pipeline` или `grimborne-bugfix-qa`).
4. Перед финализацией прогони `tools/check_assets.py` + `tools/qa_smoke.py` и прикрепи ссылку на живую сборку.
