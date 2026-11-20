// 5 Distinct Act Boss State Machines (Full Bosses, Co-Bosses, Mini-Bosses & Endless Bosses).
// Extracted from js/combat.js (Stage 4 Wave 2 modular split).
import {
  TWO_PI,
  ARENA_ENTITY_LIMIT,
  MAX_ACTIVE_ENEMIES,
  clamp,
  normalizeAngle,
  lerpAngle
} from './bridge.js?v=20261120z38';

export function updateBossAI(boss, dt, elapsedTime, ctx) {
  const {
    player,
    enemies,
    bossHazards,
    world,
    audio,
    emitParticles,
    emitSlashArc,
    emitShockwave,
    emitTelegraphZone,
    triggerModelAttack,
    floatText,
    applyDamageToPlayer,
    spawnProjectile,
    spawnEnemy
  } = ctx;

  boss.bossStateTimer -= dt;
  const dx = player.x - boss.x;
  const dz = player.z - boss.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const angleToPlayer = Math.atan2(dx, dz);
  const slowMult = boss.frostTimer > 0 ? 1 - (1 - (boss.frostFactor || 0.75)) * 0.45 : 1.0;
  const effSpeed = boss.speed * slowMult;
  const mbScale = boss.isMiniBoss ? 0.82 : 1.0;

  // ------------------------------------------------------------------------
  // 1. BOSS_BUTCHER (Демон Преисподней): Double-Leap Magma Shockwaves + Greatsword Frenzy
  // ------------------------------------------------------------------------
  if (boss.type === 'boss_butcher') {
    if (boss.bossPhase === 0) {
      if (boss.bossSubState === 'stalk') {
        if (boss.model?.obj) boss.model.obj.position.y = 0;
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
        boss.x += (dx / dist) * effSpeed * dt;
        boss.z += (dz / dist) * effSpeed * dt;

        if (boss.bossStateTimer <= 0 || dist < 7.5) {
          boss.bossSubState = 'leap_telegraph';
          boss.bossStepCount = 0;
          boss.bossStateTimer = 0.65;
          const jumpDist = Math.min(10.5, dist);
          boss.dashStartX = boss.x;
          boss.dashStartZ = boss.z;
          boss.dashTargetX = clamp(boss.x + (dx / dist) * jumpDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.dashTargetZ = clamp(boss.z + (dz / dist) * jumpDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.facing = angleToPlayer;
          emitTelegraphZone(boss.dashTargetX, boss.dashTargetZ, 3.4 * mbScale, 0.65, 0xea580c);
          floatText('🔥 ПРЫЖОК ДЕМОНА!', boss.x, boss.z, '#fb923c');
        }
      } else if (boss.bossSubState === 'leap_telegraph') {
        emitParticles(boss.x, 0.8, boss.z, 0xf97316, 1, 2.8, 0.13);
        if (boss.bossStateTimer <= 0) {
          boss.bossSubState = 'leaping';
          boss.bossStateTimer = 0.32;
          triggerModelAttack(boss.model);
        }
      } else if (boss.bossSubState === 'leaping') {
        const prog = clamp(1 - boss.bossStateTimer / 0.32, 0, 1);
        boss.x = boss.dashStartX + (boss.dashTargetX - boss.dashStartX) * prog;
        boss.z = boss.dashStartZ + (boss.dashTargetZ - boss.dashStartZ) * prog;
        if (boss.model?.obj) {
          boss.model.obj.position.y = Math.sin(prog * Math.PI) * 2.1 * mbScale;
        }

        if (boss.bossStateTimer <= 0) {
          if (boss.model?.obj) boss.model.obj.position.y = 0;
          const slamRad = 3.4 * mbScale;
          audio?.playExplosion?.();
          world?.addScreenShake?.(boss.isMiniBoss ? 0.34 : 0.52, 0.24);
          emitShockwave(boss.x, boss.z, slamRad, 0xea580c, 0.36);
          emitParticles(boss.x, 0.4, boss.z, 0xf97316, 18, 6.8, 0.18);

          if (Math.hypot(player.x - boss.x, player.z - boss.z) <= slamRad + player.radius * 0.45) {
            applyDamageToPlayer(boss.damage);
          }

          boss.bossStepCount += 1;
          if (boss.bossStepCount < 2) {
            // Immediate 2nd Leap!
            boss.bossSubState = 'leap_telegraph';
            boss.bossStateTimer = 0.65;
            const ndx = player.x - boss.x;
            const ndz = player.z - boss.z;
            const ndist = Math.hypot(ndx, ndz) || 0.001;
            const jump2 = Math.min(9.5, ndist);
            boss.dashStartX = boss.x;
            boss.dashStartZ = boss.z;
            boss.dashTargetX = clamp(boss.x + (ndx / ndist) * jump2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.dashTargetZ = clamp(boss.z + (ndz / ndist) * jump2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
            boss.facing = Math.atan2(ndx, ndz);
            emitTelegraphZone(boss.dashTargetX, boss.dashTargetZ, slamRad, 0.65, 0xea580c);
          } else {
            boss.bossPhase = 1;
            boss.bossSubState = 'cleave_chase';
            boss.bossStateTimer = 1.05;
          }
        }
      }
    } else {
      if (boss.model?.obj) boss.model.obj.position.y = 0;
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 9);
      if (boss.bossSubState === 'cleave_chase') {
        boss.x += (dx / dist) * (effSpeed * 1.15) * dt;
        boss.z += (dz / dist) * (effSpeed * 1.15) * dt;
        if (boss.bossStateTimer <= 0 || dist <= 3.8 * mbScale) {
          boss.bossSubState = 'recover';
          boss.bossStateTimer = 0.95;
          triggerModelAttack(boss.model);
          audio?.playMeleeSwing?.(true);
          const reach = 4.7 * mbScale;
          emitSlashArc(boss.x, boss.z, angleToPlayer, reach, Math.PI * 1.35, 0xf97316);
          if (dist <= reach + player.radius * 0.4) {
            applyDamageToPlayer(boss.damage);
          }
        }
      } else if (boss.bossStateTimer <= 0) {
        boss.bossPhase = 0;
        boss.bossSubState = 'stalk';
        boss.bossStateTimer = 1.75;
      }
    }
    return;
  }

  // ------------------------------------------------------------------------
  // 2. BOSS_TROLL / BOSS_WARDEN (Тролль-Костолом / Огр-Костолом): Hammer Cleave & Juggernaut Whirlwind Spin
  // ------------------------------------------------------------------------
  if (boss.type === 'boss_warden' || boss.type === 'boss_troll') {
    boss.meleeCooldown = Math.max(0, (boss.meleeCooldown || 0) - dt);
    boss.spinHitTimer = Math.max(0, (boss.spinHitTimer || 0) - dt);
    boss.spinVfxTimer = Math.max(0, (boss.spinVfxTimer || 0) - dt);

    if (boss.bossPhase === 0) {
      if (boss.bossSubState === 'stalk') {
        boss.model?.handle?.setClipOverride?.(null);
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 7.5);
        if (dist > 2.2) {
          boss.x += (dx / dist) * effSpeed * dt;
          boss.z += (dz / dist) * effSpeed * dt;
        }

        if (dist <= 3.1 * mbScale && boss.meleeCooldown <= 0) {
          boss.meleeCooldown = 1.65;
          triggerModelAttack(boss.model, 'Heavy_Cleave');
          audio?.playMeleeSwing?.(true);
          emitSlashArc(boss.x, boss.z, boss.facing, 3.25 * mbScale, Math.PI * 0.95, 0xf59e0b);
          if (dist <= 2.95 * mbScale) {
            applyDamageToPlayer(boss.damage);
          }
        }

        if (boss.bossStateTimer <= 0 && dist <= 13.5) {
          boss.bossSubState = 'whirl_windup';
          boss.bossStateTimer = 0.65;
          boss.facing = angleToPlayer;
          emitTelegraphZone(boss.x, boss.z, 2.95 * mbScale, 0.65, 0xd97706);
          emitParticles(boss.x, 1.0, boss.z, 0xf59e0b, 14, 4.5, 0.16);
          floatText('🌀 ВИХРЬ МОЛОТА!', boss.x, boss.z, '#fbbf24');
        }
      } else if (boss.bossSubState === 'whirl_windup') {
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
        boss.x += (dx / dist) * (effSpeed * 0.25) * dt;
        boss.z += (dz / dist) * (effSpeed * 0.25) * dt;
        if (Math.random() < 0.55) {
          emitParticles(boss.x, 0.9, boss.z, 0xf59e0b, 2, 3.2, 0.14);
        }
        if (boss.bossStateTimer <= 0) {
          boss.bossPhase = 1;
          boss.bossSubState = 'whirl_spin';
          boss.bossStateTimer = 3.2;
          boss.spinHitTimer = 0;
          boss.spinVfxTimer = 0;
          boss.model?.handle?.setClipOverride?.('Whirl_Spin');
          audio?.playMeleeSwing?.(true);
          emitShockwave(boss.x, boss.z, 3.1 * mbScale, 0xf59e0b, 0.35);
        }
      }
    } else {
      if (boss.bossSubState === 'whirl_spin') {
        boss.model?.handle?.setClipOverride?.('Whirl_Spin');
        boss.facing += dt * 11.4;
        const spinSpeed = Math.min(4.15, effSpeed * 1.24);
        boss.x += (dx / dist) * spinSpeed * dt;
        boss.z += (dz / dist) * spinSpeed * dt;

        if (boss.spinVfxTimer <= 0) {
          boss.spinVfxTimer = 0.28;
          audio?.playMeleeSwing?.(false);
          emitSlashArc(boss.x, boss.z, boss.facing, 3.05 * mbScale, Math.PI * 1.5, 0xf97316);
          emitParticles(boss.x, 0.65, boss.z, 0xfbbf24, 5, 4.5, 0.13);
        }

        if (dist <= 2.75 * mbScale && boss.spinHitTimer <= 0) {
          boss.spinHitTimer = 0.52;
          world?.addScreenShake?.(0.32, 0.18);
          applyDamageToPlayer(Math.round(boss.damage * 0.85));
        }

        if (boss.bossStateTimer <= 0) {
          boss.model?.handle?.setClipOverride?.(null);
          boss.bossSubState = 'recover';
          boss.bossStateTimer = 1.25;
          emitShockwave(boss.x, boss.z, 2.8 * mbScale, 0xd97706, 0.3);
        }
      } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
        boss.model?.handle?.setClipOverride?.(null);
        boss.bossPhase = 0;
        boss.bossSubState = 'stalk';
        boss.bossStateTimer = 3.6;
      }
    }
    return;
  }

  // ------------------------------------------------------------------------
  // 3. BOSS_ARCHLICH (Король-Лич): Dark Flame Spiral + Cursed Rune Zones + Shadow Blink + Undead Raise
  // ------------------------------------------------------------------------
  if (boss.type === 'boss_archlich') {
    boss.blinkCooldown = Math.max(0, (boss.blinkCooldown || 0) - dt);
    boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 7);
    if (dist > 9.5) {
      boss.x += (dx / dist) * effSpeed * dt;
      boss.z += (dz / dist) * effSpeed * dt;
    } else if (dist < 4.3 && boss.blinkCooldown <= 0) {
      boss.blinkCooldown = 7.5;
      emitShockwave(boss.x, boss.z, 3.2, 0xa855f7, 0.35);
      emitParticles(boss.x, 1.0, boss.z, 0xc084fc, 18, 6.0, 0.16);
      const blinkAng = angleToPlayer + Math.PI + (Math.random() - 0.5) * 1.1;
      boss.x = clamp(player.x - Math.sin(blinkAng) * 9.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
      boss.z = clamp(player.z - Math.cos(blinkAng) * 9.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
      emitShockwave(boss.x, boss.z, 3.6, 0xd946ef, 0.42);
      emitParticles(boss.x, 1.0, boss.z, 0xd946ef, 22, 6.5, 0.18);
      floatText('🌑 ТЕНЕВОЙ ШАГ!', boss.x, boss.z, '#e879f9');
    } else if (dist < 5.5) {
      boss.x -= (dx / dist) * (effSpeed * 0.55) * dt;
      boss.z -= (dz / dist) * (effSpeed * 0.55) * dt;
    }

    if (boss.bossPhase === 0) {
      if (boss.bossSubState === 'stalk' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'spiral_1';
        boss.bossStateTimer = 0.52;
        triggerModelAttack(boss.model, 'Spellcast_Shoot');
        audio?.playMagicCast?.('spark_staff');
        floatText('🔮 СПИРАЛЬ ПЛАМЕНИ!', boss.x, boss.z, '#c084fc');

        const boltCount = boss.isMiniBoss ? 6 : 8;
        for (let b = 0; b < boltCount; b++) {
          const ba = angleToPlayer + (b / boltCount) * TWO_PI;
          spawnProjectile({
            x: boss.x,
            z: boss.z,
            vx: Math.sin(ba) * 11.2,
            vz: Math.cos(ba) * 11.2,
            damage: Math.round(boss.damage * 0.78),
            maxDist: 20,
            kind: 'enemy',
            color: 0xa855f7,
            isEnemy: true
          });
        }
      } else if (boss.bossSubState === 'spiral_1' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 1;
        boss.bossSubState = 'plague_cast';
        boss.bossStateTimer = 0.95;
        triggerModelAttack(boss.model, 'Spellcast_Shoot');
        audio?.playMagicCast?.('void_orb');

        const boltCount = boss.isMiniBoss ? 6 : 8;
        for (let b = 0; b < boltCount; b++) {
          const ba = angleToPlayer + ((b + 0.5) / boltCount) * TWO_PI;
          spawnProjectile({
            x: boss.x,
            z: boss.z,
            vx: Math.sin(ba) * 11.6,
            vz: Math.cos(ba) * 11.6,
            damage: Math.round(boss.damage * 0.78),
            maxDist: 20,
            kind: 'enemy',
            color: 0xc084fc,
            isEnemy: true
          });
        }
      }
    } else if (boss.bossPhase === 1) {
      if (boss.bossSubState === 'plague_cast' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'plague_wait';
        boss.bossStateTimer = 1.25;
        triggerModelAttack(boss.model, 'Spellcast_Shoot');
        floatText('🟣 РУНЫ ИСТОЩЕНИЯ!', boss.x, boss.z, '#d8b4fe');
        const zoneCount = boss.isMiniBoss ? 2 : 3;
        for (let c = 0; c < zoneCount; c++) {
          const offAng = angleToPlayer + (c - (zoneCount - 1) * 0.5) * 0.95;
          const offDist = c === 0 ? 0 : 3.6;
          const zx = clamp(player.x + Math.sin(offAng) * offDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const zz = clamp(player.z + Math.cos(offAng) * offDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const zRad = 2.7 * mbScale;
          emitTelegraphZone(zx, zz, zRad, 1.15, 0x9333ea);
          bossHazards.push({
            x: zx,
            z: zz,
            radius: zRad,
            timer: 1.15,
            damage: Math.round(boss.damage * 0.85),
            color: 0xa855f7
          });
        }
      } else if (boss.bossSubState === 'plague_wait' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 2;
        boss.bossSubState = 'summon';
        boss.bossStateTimer = 0.65;
      }
    } else {
      if (boss.bossSubState === 'summon' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'recover';
        boss.bossStateTimer = 1.45;
        triggerModelAttack(boss.model, 'Spellcast_Shoot');
        emitShockwave(boss.x, boss.z, 5.2 * mbScale, 0xa855f7, 0.45);
        floatText('💀 ВОССТАНЬТЕ!', boss.x, boss.z, '#d8b4fe');

        const count = boss.isMiniBoss ? 2 : 3;
        for (let s = 0; s < count; s++) {
          if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
          const sAng = (s / count) * TWO_PI + elapsedTime;
          const sx = clamp(boss.x + Math.cos(sAng) * 3.1, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const sz = clamp(boss.z + Math.sin(sAng) * 3.1, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          spawnEnemy(s % 2 === 0 ? 'plague_zombie' : 'vampire_bat', sx, sz, null, { isSummoned: true, xp: 5, gold: 2 });
          emitParticles(sx, 0.6, sz, 0xa855f7, 8, 4.0, 0.14);
        }
      } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 0;
        boss.bossSubState = 'stalk';
        boss.bossStateTimer = 1.75;
      }
    }
    return;
  }

  // ------------------------------------------------------------------------
  // 4. BOSS_ASHLORD (Пепельный Дракон): Dragon Swoop + 5 Meteors + Dragon Guard
  // ------------------------------------------------------------------------
  if (boss.type === 'boss_ashlord') {
    if (boss.bossPhase === 0) {
      if (boss.bossSubState === 'stalk') {
        boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
        boss.x += (dx / dist) * effSpeed * dt;
        boss.z += (dz / dist) * effSpeed * dt;

        if (boss.bossStateTimer <= 0 || dist < 7.0) {
          boss.bossSubState = 'telegraph_dash';
          boss.bossStateTimer = 0.65;
          const dashDist = Math.min(11.5, dist + 1.8);
          boss.dashTargetX = clamp(boss.x + (dx / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.dashTargetZ = clamp(boss.z + (dz / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          boss.facing = angleToPlayer;
          emitTelegraphZone(boss.dashTargetX, boss.dashTargetZ, 4.2, 0.65, 0xf97316);
          emitParticles(boss.x, 1.3, boss.z, 0xf97316, 18, 6.0, 0.18);
          floatText('🐉 ПИКЕ ДРАКОНА!', boss.x, boss.z, '#fb923c');
        }
      } else if (boss.bossSubState === 'telegraph_dash') {
        emitParticles(boss.x, 1.0, boss.z, 0xef4444, 2, 3.5, 0.14);
        if (boss.bossStateTimer <= 0) {
          boss.bossSubState = 'dashing';
          boss.bossStateTimer = 0.30;
        }
      } else if (boss.bossSubState === 'dashing') {
        const tdx = boss.dashTargetX - boss.x;
        const tdz = boss.dashTargetZ - boss.z;
        const tdist = Math.hypot(tdx, tdz);
        if (tdist > 0.25) {
          const step = Math.min(tdist, 28 * dt);
          boss.x += (tdx / tdist) * step;
          boss.z += (tdz / tdist) * step;
        }
        if (boss.bossStateTimer <= 0) {
          const slashAngle = Math.atan2(player.x - boss.x, player.z - boss.z);
          boss.facing = slashAngle;
          triggerModelAttack(boss.model);
          audio?.playMeleeSwing?.(true);
          world?.addScreenShake?.(0.62, 0.30);
          emitSlashArc(boss.x, boss.z, slashAngle, 5.8, Math.PI * 1.45, 0xf97316);
          emitShockwave(boss.x, boss.z, 4.8, 0xef4444, 0.36);

          const pDist = Math.hypot(player.x - boss.x, player.z - boss.z);
          if (pDist <= 5.8) {
            const pAng = Math.atan2(player.x - boss.x, player.z - boss.z);
            if (Math.abs(normalizeAngle(pAng - slashAngle)) <= Math.PI * 0.75 || pDist <= 2.4) {
              applyDamageToPlayer(boss.damage);
            }
          }
          // Radial 8-ember burst on cleave finish!
          for (let k = 0; k < 8; k++) {
            const ka = slashAngle + (k / 8) * TWO_PI;
            spawnProjectile({
              x: boss.x,
              z: boss.z,
              vx: Math.sin(ka) * 13.0,
              vz: Math.cos(ka) * 13.0,
              damage: Math.round(boss.damage * 0.75),
              maxDist: 19,
              kind: 'enemy',
              color: 0xf97316,
              isEnemy: true
            });
          }

          boss.bossPhase = 1;
          boss.bossSubState = 'meteors';
          boss.bossStateTimer = 0.85;
        }
      }
    } else if (boss.bossPhase === 1) {
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
      boss.x += (dx / dist) * (effSpeed * 0.45) * dt;
      boss.z += (dz / dist) * (effSpeed * 0.45) * dt;

      if (boss.bossSubState === 'meteors' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'wait_meteors';
        boss.bossStateTimer = 1.25;
        triggerModelAttack(boss.model);
        audio?.playMagicCast?.('cinder_tome');
        floatText('☄️ ДОЖДЬ ПЕПЛА!', boss.x, boss.z, '#ef4444');

        // 5 Meteor Danger Zones around player!
        for (let m = 0; m < 5; m++) {
          const mAng = (m / 5) * TWO_PI + elapsedTime * 0.7;
          const mDist = m === 0 ? 0 : 3.8 + (m % 2) * 1.4;
          const zx = clamp(player.x + Math.cos(mAng) * mDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const zz = clamp(player.z + Math.sin(mAng) * mDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          emitTelegraphZone(zx, zz, 3.1, 1.10, 0xef4444);
          bossHazards.push({
            x: zx,
            z: zz,
            radius: 3.1,
            timer: 1.10,
            damage: Math.round(boss.damage * 0.92),
            color: 0xf97316
          });
        }
      } else if (boss.bossSubState === 'wait_meteors' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 2;
        boss.bossSubState = 'summon_elite';
        boss.bossStateTimer = 0.65;
      }
    } else {
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
      if (boss.bossSubState === 'summon_elite' && boss.bossStateTimer <= 0) {
        boss.bossSubState = 'recover';
        boss.bossStateTimer = 1.2;
        triggerModelAttack(boss.model);
        emitShockwave(boss.x, boss.z, 5.8, 0xf59e0b, 0.48);
        floatText('🔥 СТРАЖА ДРАКОНА!', boss.x, boss.z, '#fbbf24');

        const guards = ['gargoyle', 'dark_cultist'];
        for (let g = 0; g < guards.length; g++) {
          if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
          const gAng = angleToPlayer + (g === 0 ? -0.9 : 0.9);
          const gx = clamp(boss.x + Math.sin(gAng) * 3.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          const gz = clamp(boss.z + Math.cos(gAng) * 3.5, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
          spawnEnemy(guards[g], gx, gz, null, { isSummoned: true, xp: 10, gold: 4 });
          emitParticles(gx, 0.7, gz, 0xf97316, 10, 4.5, 0.15);
        }
      } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
        boss.bossPhase = 0;
        boss.bossSubState = 'stalk';
        boss.bossStateTimer = 1.85;
      }
    }
    return;
  }

  // ------------------------------------------------------------------------
  // 5. BOSS_CTHULHU / REAPER (Вестник Бездны & Default Boss): Tentacle Surge + Abyssal Rifts + Deep Summons
  // ------------------------------------------------------------------------
  if (boss.bossPhase === 0) {
    if (boss.bossSubState === 'stalk') {
      boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 8);
      boss.x += (dx / dist) * effSpeed * dt;
      boss.z += (dz / dist) * effSpeed * dt;

      if (boss.bossStateTimer <= 0 || dist < 6.4) {
        boss.bossSubState = 'telegraph_dash';
        boss.bossStateTimer = 0.65;
        const dashDist = Math.min(10.5, dist + 1.5);
        boss.dashTargetX = clamp(boss.x + (dx / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        boss.dashTargetZ = clamp(boss.z + (dz / dist) * dashDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        boss.facing = angleToPlayer;

        emitTelegraphZone(boss.dashTargetX, boss.dashTargetZ, 3.8 * mbScale, 0.65, 0x06b6d4);
        emitParticles(boss.x, 1.2, boss.z, 0x22d3ee, 16, 5.5, 0.18);
        floatText('🌊 НАТИСК БЕЗДНЫ!', boss.x, boss.z, '#22d3ee');
      }
    } else if (boss.bossSubState === 'telegraph_dash') {
      emitParticles(boss.x, 1.0, boss.z, 0x06b6d4, 2, 3.0, 0.14);
      if (boss.bossStateTimer <= 0) {
        boss.bossSubState = 'dashing';
        boss.bossStateTimer = 0.28;
      }
    } else if (boss.bossSubState === 'dashing') {
      const tdx = boss.dashTargetX - boss.x;
      const tdz = boss.dashTargetZ - boss.z;
      const tdist = Math.hypot(tdx, tdz);
      if (tdist > 0.25) {
        const step = Math.min(tdist, 26 * dt);
        boss.x += (tdx / tdist) * step;
        boss.z += (tdz / tdist) * step;
      }
      if (boss.bossStateTimer <= 0) {
        const slashAngle = Math.atan2(player.x - boss.x, player.z - boss.z);
        boss.facing = slashAngle;
        triggerModelAttack(boss.model);
        audio?.playMeleeSwing?.(true);
        world?.addScreenShake?.(boss.isMiniBoss ? 0.36 : 0.52, 0.28);
        const reach = 5.4 * mbScale;
        emitSlashArc(boss.x, boss.z, slashAngle, reach, Math.PI * 1.28, 0x06b6d4);
        emitShockwave(boss.x, boss.z, 4.4 * mbScale, 0x22d3ee, 0.32);

        const pDist = Math.hypot(player.x - boss.x, player.z - boss.z);
        if (pDist <= reach + 0.15) {
          const pAng = Math.atan2(player.x - boss.x, player.z - boss.z);
          if (Math.abs(normalizeAngle(pAng - slashAngle)) <= Math.PI * 0.68 || pDist <= 2.2) {
            applyDamageToPlayer(boss.damage);
          }
        }

        boss.bossPhase = 1;
        boss.bossSubState = 'cast_flames';
        boss.bossStateTimer = 1.05;
      }
    }
  } else if (boss.bossPhase === 1) {
    boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
    boss.x += (dx / dist) * (effSpeed * 0.45) * dt;
    boss.z += (dz / dist) * (effSpeed * 0.45) * dt;

    if (boss.bossSubState === 'cast_flames' && boss.bossStateTimer <= 0.45) {
      boss.bossSubState = 'wait_flames';
      boss.bossStateTimer = 1.25;
      triggerModelAttack(boss.model);
      audio?.playMagicCast?.('void_orb');
      floatText('🌀 СФЕРЫ БЕЗДНЫ!', boss.x, boss.z, '#67e8f9');

      const count = boss.isMiniBoss ? 2 : 3;
      for (let c = 0; c < count; c++) {
        const offsetAng = angleToPlayer + (c - (count - 1) * 0.5) * 0.85;
        const offsetDist = c === 1 ? 0 : 3.5;
        const zx = clamp(player.x + Math.sin(offsetAng) * offsetDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        const zz = clamp(player.z + Math.cos(offsetAng) * offsetDist, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        const fRad = 2.9 * mbScale;
        emitTelegraphZone(zx, zz, fRad, 1.08, 0x06b6d4);
        bossHazards.push({
          x: zx,
          z: zz,
          radius: fRad,
          timer: 1.08,
          damage: Math.round(boss.damage * 0.9),
          color: 0x06b6d4
        });
      }
    } else if (boss.bossSubState === 'wait_flames' && boss.bossStateTimer <= 0) {
      boss.bossPhase = 2;
      boss.bossSubState = 'summon';
      boss.bossStateTimer = 0.7;
    }
  } else {
    boss.facing = lerpAngle(boss.facing, angleToPlayer, dt * 6);
    if (boss.bossSubState === 'summon' && boss.bossStateTimer <= 0) {
      boss.bossSubState = 'recover';
      boss.bossStateTimer = 1.2;
      triggerModelAttack(boss.model);
      emitShockwave(boss.x, boss.z, 5.0 * mbScale, 0x0891b2, 0.45);
      floatText('🦑 ЗОВ БЕЗДНЫ!', boss.x, boss.z, '#67e8f9');

      const summonCount = boss.isMiniBoss ? 2 : 3;
      for (let s = 0; s < summonCount; s++) {
        if (enemies.length >= MAX_ACTIVE_ENEMIES + 6) break;
        const sAng = (s / summonCount) * TWO_PI + elapsedTime;
        const sx = clamp(boss.x + Math.cos(sAng) * 3.2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        const sz = clamp(boss.z + Math.sin(sAng) * 3.2, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT);
        const abyssMinion = s % 2 === 0 ? 'shadow_wisp' : 'dark_spider';
        spawnEnemy(abyssMinion, sx, sz, null, { isSummoned: true, xp: 5, gold: 2 });
        emitParticles(sx, 0.6, sz, 0x22d3ee, 8, 4.0, 0.15);
      }
    } else if (boss.bossSubState === 'recover' && boss.bossStateTimer <= 0) {
      boss.bossPhase = 0;
      boss.bossSubState = 'stalk';
      boss.bossStateTimer = 1.95;
    }
  }
}
