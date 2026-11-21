// 5 Distinct Act Boss State Machines (Full Bosses, Co-Bosses, Mini-Bosses & Endless Bosses).
// Extracted from js/combat.js (Stage 4 Wave 2 modular split).
import {
  TWO_PI,
  ARENA_ENTITY_LIMIT,
  MAX_ACTIVE_ENEMIES,
  clamp,
  normalizeAngle,
  lerpAngle
} from './bridge.js?v=20261121z68';
import { SOULS_CASTLE_CONSTANTS } from '../souls/soulsCastleLayout.js?v=20261121z68';

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

// ============================================================================
// CHAPTER XXVI DARK SOULS / ELDEN RING BOSS AI («Рыцарь Пепла — Судия Руин»)
// Elden Ring `luabnd` Goal Stack + exact clip-synced 5-attack moveset,
// Neutral Spacing/Circling, Combo Branching, Flask Punish w/ LOS, Multi-Parry
// ============================================================================
export const SOULS_BOSS_CLIP_TIMINGS = Object.freeze({
  Heavy_Cleave: Object.freeze({ duration: 3.200, endAt: 1.80, impactAt: 1.033, speed: 1.22, trackingCutoff01: 0.66 }),
  Sweep_Combo: Object.freeze({ duration: 4.700, endAt: 3.85, hit1At: 1.967, hit2At: 2.967, speed: 1.20, trackingCutoff01: 0.68 }),
  Delayed_Crush: Object.freeze({ duration: 4.233, endAt: 3.48, hit1At: 1.033, hit2At: 1.633, lockAt: 2.48, impactAt: 2.700, speed: 1.18, trackingCutoff01: 0.68 }),
  Combo_Sweep_1: Object.freeze({ duration: 1.250, endAt: 1.14, impactAt: 0.60, speed: 1.14, trackingCutoff01: 0.68 }),
  Combo_Backhand_2: Object.freeze({ duration: 1.150, endAt: 1.05, impactAt: 0.54, speed: 1.16, trackingCutoff01: 0.68 }),
  Combo_Slam_3: Object.freeze({ duration: 1.450, endAt: 1.34, impactAt: 0.82, speed: 1.12, trackingCutoff01: 0.70 }),
  Leap_Slam: Object.freeze({ duration: 3.700, endAt: 2.55, takeoffAt: 0.433, flightStartAt: 0.70, apexAt: 1.233, landMoveEndAt: 1.633, impactAt: 1.767, speed: 1.22, trackingCutoff01: 0.65 }),
  Whirl_Spin: Object.freeze({ duration: 1.100, windupSec: 0.52, p1SpinSec: 0.92, p2SpinSec: 1.42, speed: 1.15, trackingCutoff01: 0.68 }),
  Recover_Heft: Object.freeze({ duration: 0.950, speed: 1.05 }),
  Walk_Backward: Object.freeze({ duration: 1.000, speed: 1.0 }),
  Strafe_Left: Object.freeze({ duration: 1.000, speed: 1.0 }),
  Strafe_Right: Object.freeze({ duration: 1.000, speed: 1.0 }),
  Cutscene_Rise_Roar: Object.freeze({ duration: 2.400, peakAt: 1.15, speed: 1.0 }),
  Roar_Taunt: Object.freeze({ duration: 2.070, peakAt: 0.50, speedOpening: 1.14, speedPhase2: 1.22 }),
  Stagger_Kneel: Object.freeze({ duration: 1.033, kneelSec: 4.20, speed: 1.0 }),
  Stagger_Recover: Object.freeze({ duration: 0.933, speed: 1.0 }),
  Riposte_Victim_Fall: Object.freeze({ duration: 3.600, impaleAt: 0.56, yankAt: 1.48, fallImpactAt: 1.72, riseStartAt: 1.95, speed: 1.0 }),
  Hit_React_Gut: Object.freeze({ duration: 1.633, speed: 1.24 }),
  Block_React: Object.freeze({ duration: 1.367, speed: 1.18 })
});

export const SOULS_BOSS_ATTACK_META = Object.freeze({
  quick_cleave: Object.freeze({
    attackId: 'overhead_cleave',
    staminaDamage: 32,
    damageLevel: 'light',
    activeWindowSec: 0.09,
    canParry: true,
    trackingCutoff01: 0.66,
    label: 'Quick_Cleave'
  }),
  overhead_cleave: Object.freeze({
    attackId: 'overhead_cleave',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.10,
    canParry: true,
    trackingCutoff01: 0.66,
    label: 'Heavy_Cleave'
  }),
  combo_sweep_1: Object.freeze({
    attackId: 'aaa_combo',
    staminaDamage: 32,
    damageLevel: 'light',
    activeWindowSec: 0.09,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Combo_Sweep_1'
  }),
  combo_backhand_2: Object.freeze({
    attackId: 'aaa_combo',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.10,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Combo_Backhand_2'
  }),
  combo_slam_3: Object.freeze({
    attackId: 'aaa_combo',
    staminaDamage: 68,
    damageLevel: 'heavy',
    activeWindowSec: 0.12,
    canParry: false,
    trackingCutoff01: 0.70,
    label: 'Combo_Slam_3'
  }),
  sweep_combo_1: Object.freeze({
    attackId: 'sweep_combo',
    staminaDamage: 32,
    damageLevel: 'light',
    activeWindowSec: 0.09,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Sweep_Combo_1'
  }),
  sweep_combo_2: Object.freeze({
    attackId: 'sweep_combo',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.10,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Sweep_Combo_2'
  }),
  delayed_crush_1: Object.freeze({
    attackId: 'delayed_crush',
    staminaDamage: 32,
    damageLevel: 'light',
    activeWindowSec: 0.08,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Delayed_Crush_1'
  }),
  delayed_crush_2: Object.freeze({
    attackId: 'delayed_crush',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.09,
    canParry: true,
    trackingCutoff01: 0.68,
    label: 'Delayed_Crush_2'
  }),
  delayed_crush_3: Object.freeze({
    attackId: 'delayed_crush',
    staminaDamage: 68,
    damageLevel: 'heavy',
    activeWindowSec: 0.12,
    canParry: false,
    trackingCutoff01: 0.70,
    label: 'Delayed_Crush_Slam'
  }),
  leap_slam: Object.freeze({
    attackId: 'leap_slam',
    staminaDamage: 68,
    damageLevel: 'heavy',
    activeWindowSec: 0.12,
    canParry: false,
    trackingCutoff01: 0.65,
    label: 'Leap_Slam'
  }),
  whirl_spin: Object.freeze({
    attackId: 'whirl_spin',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.10,
    canParry: false,
    trackingCutoff01: 0.68,
    label: 'Whirl_Spin'
  })
});

export const SOULS_BOSS_MULTI_PARRY = Object.freeze({
  staggerMax: 220,
  parryStaggerGain: 75,
  parriesToKneel: 3,
  blockReactStunSec: 1.35,
  blockReactSpeed: 1.18
});

export const SOULS_BOSS_GOAL_CFG = Object.freeze({
  neutralMinDist: 3.0,
  neutralMaxDist: 4.8,
  closeBackstepDist: 2.3,
  shieldBreakHoldSec: 1.5,
  flaskPunishCooldownSec: 4.8,
  farBranchDist: 8.5,
  behindAngleRad: 1.15,
  turnRateStalkRad: 3.2,
  turnRateWindupRad: 4.8,
  turnRateQuickTurnRad: 6.4,
  nominalWalkSpeed: 3.05
});

export const SOULS_BOSS_CROSSFADE_SEC = 0.22;

// Dark Souls 3 / Elden Ring Punish Windows & Anti-Greed traps (`Recover_Heft` 0.75-1.05s smooth breather).
//   tier 'heavy' -> open recover (2-3 player hits, x1.25 dmg, x1.45 stagger, golden tell)
//   tier 'light' -> short open recover (1-2 hits, x1.15 dmg, x1.25 stagger)
//   tier 'none'  -> NOT punishable: fast guard return + anti-greed counter-chain
export const SOULS_BOSS_PUNISH_PROFILES = Object.freeze({
  overhead_cleave: Object.freeze({
    tier: 'none', recoverP1: 0.26, recoverP2: 0.20, dmgMult: 1.0, staggerMult: 1.0,
    antiGreedDelay: 0.22, antiGreedRange: 4.7, hugRange: 4.1, recentHitSec: 0.65,
    recentHitChance: 0.90, hugChanceP1: 0.65, hugChanceP2: 0.85, counterWhirlWindup: 0.38
  }),
  sweep_combo_hit1: Object.freeze({ tier: 'none', hyperArmorUntilHit2: true }),
  sweep_combo: Object.freeze({
    tier: 'light', recoverP1: 0.82, recoverP2: 0.75, dmgMult: 1.15, staggerMult: 1.25,
    chainRange: 4.1, greedSec: 0.55, greedChance: 0.75, baseChance: 0.45
  }),
  delayed_crush: Object.freeze({ tier: 'heavy', recoverP1: 1.05, recoverP2: 0.94, dmgMult: 1.25, staggerMult: 1.45 }),
  aaa_combo: Object.freeze({ tier: 'heavy', recoverP1: 1.02, recoverP2: 0.90, dmgMult: 1.25, staggerMult: 1.45 }),
  leap_slam: Object.freeze({ tier: 'heavy', recoverP1: 1.00, recoverP2: 0.88, dmgMult: 1.25, staggerMult: 1.45 }),
  whirl_spin: Object.freeze({ tier: 'heavy', recoverP1: 1.04, recoverP2: 0.92, dmgMult: 1.25, staggerMult: 1.45 })
});

const PUNISH_DMG_MULT = Object.freeze({ heavy: 1.25, light: 1.15 });
const PUNISH_STAGGER_MULT = Object.freeze({ heavy: 1.45, light: 1.25 });

function clearSoulsBossPunishWindow(boss) {
  if (!boss) return;
  boss.soulsPunishWindow = null;
  boss.soulsPunishTimer = 0;
  boss.soulsPunishDmgMult = 1.0;
  boss.soulsPunishStaggerMult = 1.0;
}

export function getSoulsBossPunishState(boss) {
  const inOpenState = boss && (boss.soulsState === 'recover' || boss.soulsState === 'hit_react');
  const tier = inOpenState && (boss.soulsPunishTimer || 0) > 0 ? boss.soulsPunishWindow || null : null;
  return {
    tier,
    active: Boolean(tier),
    punishable: Boolean(tier),
    timer: tier ? Math.max(0, boss.soulsPunishTimer || 0) : 0,
    dmgMult: tier ? boss.soulsPunishDmgMult || PUNISH_DMG_MULT[tier] || 1.0 : 1.0,
    staggerMult: tier ? boss.soulsPunishStaggerMult || PUNISH_STAGGER_MULT[tier] || 1.0 : 1.0,
    chainCount: boss?.soulsChainCount || 0
  };
}

// Retained as a safe backward-compatible no-op export for callers (`combat.js`):
// Souls Boss no longer spawns any red danger circles or floor telegraph rings —
// players read pure 3D windup animations + physical dust/spark shockwaves on hammer impact!
export function cancelSoulsBossTelegraph(boss, elapsedTime = 0) {
  if (!boss) return;
  const clock = Number.isFinite(boss._aiClock) ? boss._aiClock : elapsedTime;
  if (boss._activeTelegraph && typeof boss._activeTelegraph.cancel === 'function') {
    if (!Number.isFinite(boss._activeTelegraphExpireAt) || clock < boss._activeTelegraphExpireAt - 0.02) {
      boss._activeTelegraph.cancel();
    }
  }
  boss._activeTelegraph = null;
  boss._activeTelegraphExpireAt = 0;
}

function playBossAttackClip(boss, clipName, speed = 1.0, blendInSec = SOULS_BOSS_CROSSFADE_SEC) {
  boss.model?.handle?.setClipOverride?.(null);
  if (typeof boss.model?.handle?.playBossClip === 'function') {
    return boss.model.handle.playBossClip(clipName, speed, blendInSec);
  }
  if (typeof boss.model?.handle?.playAttackAnim === 'function') {
    boss.model.handle.playAttackAnim(clipName, 0, speed, blendInSec);
    return { ok: true, duration: (SOULS_BOSS_CLIP_TIMINGS[clipName]?.duration || 1.0) / Math.max(0.1, speed) };
  }
  return { ok: false, duration: 1.0 };
}

const easeAttackDrive = (u) => {
  const c = clamp(u, 0, 1);
  return 0.55 * (c * c * (3 - 2 * c)) + 0.45 * (c * c);
};

const easeOutQuad = (u) => {
  const c = clamp(u, 0, 1);
  return 1 - (1 - c) * (1 - c);
};

function sampleWindowStep(prevT, currT, startSec, endSec, totalDist, easeFn) {
  if (currT <= startSec || prevT >= endSec || endSec <= startSec || !totalDist) return 0;
  const u0 = clamp((prevT - startSec) / (endSec - startSec), 0, 1);
  const u1 = clamp((currT - startSec) / (endSec - startSec), 0, 1);
  if (u1 <= u0) return 0;
  return totalDist * (easeFn(u1) - easeFn(u0));
}

function clampBossToSoulsHallFallback(x, z, bossRadius) {
  const cx = SOULS_CASTLE_CONSTANTS?.BOSS_CENTER_X ?? 0;
  const cz = SOULS_CASTLE_CONSTANTS?.BOSS_CENTER_Z ?? -31.2;
  const hallR = Math.max(8.0, (SOULS_CASTLE_CONSTANTS?.BOSS_RADIUS ?? 16.0) - (bossRadius || 1.75) - 0.35);
  const sealZ = (SOULS_CASTLE_CONSTANTS?.BOSS_SEAL_Z ?? -16.2) - (bossRadius || 1.75) * 0.6;
  let rx = x;
  let rz = Math.min(z, sealZ);
  const ddx = rx - cx;
  const ddz = rz - cz;
  const d = Math.hypot(ddx, ddz);
  if (d > hallR && d > 1e-4) {
    rx = cx + (ddx / d) * hallR;
    rz = cz + (ddz / d) * hallR;
  }
  return { x: rx, z: rz };
}

export function advanceBossWithCollision(boss, dirX, dirZ, distStep, player, resolveObstaclesAndBounds) {
  if (!boss || !Number.isFinite(distStep) || Math.abs(distStep) < 1e-5) return 0;
  const dirLen = Math.hypot(dirX || 0, dirZ || 0);
  if (dirLen < 1e-5) return 0;
  const nx = dirX / dirLen;
  const nz = dirZ / dirLen;

  const prevX = boss.x;
  const prevZ = boss.z;
  let stepX = nx * distStep;
  let stepZ = nz * distStep;

  if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
    const minPlayerDist = (player.radius || 0.45) + (boss.radius || 1.75) * 0.92;
    const toPX = player.x - prevX;
    const toPZ = player.z - prevZ;
    const curDist = Math.hypot(toPX, toPZ);
    if (curDist > 1e-4) {
      const pux = toPX / curDist;
      const puz = toPZ / curDist;
      const inward = stepX * pux + stepZ * puz;
      if (inward > 0) {
        const room = Math.max(0, curDist - minPlayerDist);
        if (inward > room) {
          const excess = inward - room;
          stepX -= pux * excess;
          stepZ -= puz * excess;
        }
      }
    }
  }

  let candX = prevX + stepX;
  let candZ = prevZ + stepZ;

  // Guard diagonal/arc steps from dipping inside the minimum player separation radius
  if (player && Number.isFinite(player.x) && Number.isFinite(player.z)) {
    const minPlayerDist = (player.radius || 0.45) + (boss.radius || 1.75) * 0.92;
    const curDist = Math.hypot(player.x - prevX, player.z - prevZ);
    const awayX = candX - player.x;
    const awayZ = candZ - player.z;
    const candDist = Math.hypot(awayX, awayZ);
    if (candDist < minPlayerDist && candDist < curDist && candDist > 1e-4) {
      const targetDist = Math.min(minPlayerDist, curDist);
      candX = player.x + (awayX / candDist) * targetDist;
      candZ = player.z + (awayZ / candDist) * targetDist;
    }
  }

  const safe =
    typeof resolveObstaclesAndBounds === 'function'
      ? resolveObstaclesAndBounds(candX, candZ, boss.radius, ARENA_ENTITY_LIMIT)
      : boss.isSoulsBoss
        ? clampBossToSoulsHallFallback(candX, candZ, boss.radius)
        : {
            x: clamp(candX, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT),
            z: clamp(candZ, -ARENA_ENTITY_LIMIT, ARENA_ENTITY_LIMIT)
          };

  boss.x = safe.x;
  boss.z = safe.z;
  return Math.hypot(safe.x - prevX, safe.z - prevZ);
}

function triggerSoulsBossRecoil(boss, player, dist = 0.50, dur = 0.24) {
  if (!boss) return;
  let rdx = player && Number.isFinite(player.x) ? boss.x - player.x : -Math.sin(boss.facing || 0);
  let rdz = player && Number.isFinite(player.z) ? boss.z - player.z : -Math.cos(boss.facing || 0);
  const len = Math.hypot(rdx, rdz);
  if (len > 1e-4) {
    rdx /= len;
    rdz /= len;
  } else {
    rdx = -Math.sin(boss.facing || 0);
    rdz = -Math.cos(boss.facing || 0);
  }
  boss._soulsRecoil = { dirX: rdx, dirZ: rdz, dist, dur, elapsed: 0 };
}

function stepSoulsBossRecoil(boss, dt, player, resolveObstaclesAndBounds) {
  const r = boss?._soulsRecoil;
  if (!r || r.elapsed >= r.dur) {
    if (boss) boss._soulsRecoil = null;
    return 0;
  }
  const prevE = r.elapsed;
  const currE = Math.min(r.dur, prevE + dt);
  r.elapsed = currE;
  const step = sampleWindowStep(prevE, currE, 0, r.dur, r.dist, easeOutQuad);
  if (currE >= r.dur) {
    boss._soulsRecoil = null;
  }
  return advanceBossWithCollision(boss, r.dirX, r.dirZ, step, player, resolveObstaclesAndBounds);
}

function bossHasClip(boss, clipName) {
  if (!boss || !clipName) return false;
  const ac = boss.model?.obj?.userData?.animCtrl || boss.model?.handle?.animCtrl;
  if (ac && typeof ac.getAction === 'function') {
    return Boolean(ac.getAction(clipName));
  }
  return false;
}

function playBossWhooshSfx(audio, isHeavy = true) {
  if (typeof audio?.playBossHammerWhoosh === 'function') {
    audio.playBossHammerWhoosh();
  } else {
    audio?.playMeleeSwing?.(isHeavy);
  }
}

function playBossHammerGroundSfx(audio) {
  if (typeof audio?.playBossHammerGround === 'function') {
    audio.playBossHammerGround();
  } else if (typeof audio?.playBossHammerSlam === 'function') {
    audio.playBossHammerSlam();
  } else {
    audio?.playExplosion?.();
  }
}

function playBossHammerHitSfx(audio) {
  audio?.playBossHammerHit?.();
}

function playBossLeapSfx(audio) {
  audio?.playBossLeap?.();
}

function playBossRoarSfx(audio) {
  if (typeof audio?.playBossRoar === 'function') {
    audio.playBossRoar();
  } else {
    audio?.playBossSpawn?.();
  }
}

function segmentIntersectsBox2D(ax, az, bx, bz, cx, cz, halfW, halfD) {
  const dx = bx - ax;
  const dz = bz - az;
  let tMin = 0.04;
  let tMax = 0.96;
  const minX = cx - halfW;
  const maxX = cx + halfW;
  const minZ = cz - halfD;
  const maxZ = cz + halfD;

  if (Math.abs(dx) < 1e-6) {
    if (ax < minX || ax > maxX) return false;
  } else {
    let t1 = (minX - ax) / dx;
    let t2 = (maxX - ax) / dx;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  if (Math.abs(dz) < 1e-6) {
    if (az < minZ || az > maxZ) return false;
  } else {
    let t1 = (minZ - az) / dz;
    let t2 = (maxZ - az) / dz;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return tMax >= tMin;
}

export function hasBossLineOfSightToPlayer(boss, player, world, extraObstacles = null) {
  if (!boss || !player) return false;
  const obsList = Array.isArray(extraObstacles) ? extraObstacles : world?.obstacles;
  if (!Array.isArray(obsList) || obsList.length === 0) return true;

  const ax = boss.x;
  const az = boss.z;
  const bx = player.x;
  const bz = player.z;
  const segX = bx - ax;
  const segZ = bz - az;
  const segLenSq = segX * segX + segZ * segZ;
  if (segLenSq < 0.25) return true;

  const pad = 0.30;
  for (let i = 0; i < obsList.length; i++) {
    const o = obsList[i];
    if (!o || o.isBonfire) continue;
    if (o.height != null && o.height < 1.35) continue;

    if (o.halfW != null && o.halfD != null) {
      if (Math.max(o.halfW, o.halfD) < 0.55) continue;
      if (segmentIntersectsBox2D(ax, az, bx, bz, o.x, o.z, o.halfW + pad, o.halfD + pad)) {
        return false;
      }
    } else {
      const r = o.radius ?? o.r;
      if (!(r >= 0.55)) continue;
      const t = clamp(((o.x - ax) * segX + (o.z - az) * segZ) / segLenSq, 0.04, 0.96);
      const px = ax + segX * t;
      const pz = az + segZ * t;
      const distSq = (px - o.x) * (px - o.x) + (pz - o.z) * (pz - o.z);
      const rLim = r + pad;
      if (distSq < rLim * rLim) {
        return false;
      }
    }
  }
  return true;
}

export function computeBossObstacleSteering(boss, desiredDirX, desiredDirZ, world, extraObstacles = null) {
  const baseLen = Math.hypot(desiredDirX || 0, desiredDirZ || 0);
  if (!boss || baseLen < 1e-5) {
    return { x: desiredDirX || 0, z: desiredDirZ || 0, steered: false };
  }
  const dnx = desiredDirX / baseLen;
  const dnz = desiredDirZ / baseLen;
  const obsList = Array.isArray(extraObstacles) ? extraObstacles : world?.obstacles;
  if (!Array.isArray(obsList) || obsList.length === 0) {
    return { x: dnx, z: dnz, steered: false };
  }

  let steerX = dnx;
  let steerZ = dnz;
  let steered = false;
  const bossR = boss.radius || 1.75;
  const prefSign = boss.strafeDir === -1 ? -1 : 1;

  for (let i = 0; i < obsList.length; i++) {
    const o = obsList[i];
    if (!o || o.isBonfire) continue;

    let obsR = 0;
    if (o.halfW != null && o.halfD != null) {
      obsR = Math.hypot(o.halfW, o.halfD);
    } else {
      obsR = Number(o.radius ?? o.r ?? 0);
    }
    if (!(obsR >= 0.25)) continue;

    const toObsX = o.x - boss.x;
    const toObsZ = o.z - boss.z;
    const distToObs = Math.hypot(toObsX, toObsZ);
    const clearance = bossR + obsR + 1.25;
    if (distToObs >= clearance || distToObs < 1e-4) continue;

    const ox = toObsX / distToObs;
    const oz = toObsZ / distToObs;
    const approachDot = dnx * ox + dnz * oz;
    // Ignore obstacles well behind our travel direction unless we are already brushing them
    if (approachDot < -0.18 && distToObs > bossR + obsR + 0.35) continue;

    const proximity = clamp((clearance - distToObs) / Math.max(0.4, clearance - (bossR + obsR) * 0.5), 0, 1);
    const weight = proximity * proximity;

    // Two candidate tangents around the pillar/brazier
    const tLeftX = -oz;
    const tLeftZ = ox;
    const tRightX = oz;
    const tRightZ = -ox;
    const dotL = dnx * tLeftX + dnz * tLeftZ;
    const dotR = dnx * tRightX + dnz * tRightZ;
    let chosenTX;
    let chosenTZ;
    if (Math.abs(dotL - dotR) > 0.08) {
      chosenTX = dotL >= dotR ? tLeftX : tRightX;
      chosenTZ = dotL >= dotR ? tLeftZ : tRightZ;
    } else {
      // Dead-center pillar: pick consistent boss strafe side so boss never oscillates!
      chosenTX = prefSign > 0 ? tLeftX : tRightX;
      chosenTZ = prefSign > 0 ? tLeftZ : tRightZ;
    }

    // Smoothly blend radial push-out + tangent flow around the obstacle
    steerX += (-ox * 1.15 + chosenTX * 1.95) * weight;
    steerZ += (-oz * 1.15 + chosenTZ * 1.95) * weight;
    steered = true;
  }

  const outLen = Math.hypot(steerX, steerZ);
  if (outLen < 1e-4) {
    return { x: -dnz * prefSign, z: dnx * prefSign, steered: true };
  }
  return { x: steerX / outLen, z: steerZ / outLen, steered };
}

function stepBossTurn(boss, targetAng, maxRadPerSec, dt) {
  if (!boss || !Number.isFinite(targetAng) || !(dt > 0)) return boss?.facing || 0;
  const diff = normalizeAngle(targetAng - (boss.facing || 0));
  const maxRate = Math.max(0.5, Number(maxRadPerSec) || 3.2);
  const desiredVel = clamp(diff * 5.2, -maxRate, maxRate);
  const prevVel = Number.isFinite(boss._soulsAngVel) ? boss._soulsAngVel : 0;
  const blend = Math.min(1, dt * 11.5);
  const nextVel = prevVel + (desiredVel - prevVel) * blend;
  boss._soulsAngVel = nextVel;
  const step = nextVel * dt;
  if (Math.abs(step) >= Math.abs(diff)) {
    boss.facing = targetAng;
    boss._soulsAngVel *= 0.25;
  } else {
    boss.facing = normalizeAngle((boss.facing || 0) + step);
  }
  return boss.facing;
}

function recordSoulsBossMove(boss, moveId) {
  if (!boss || !moveId) return;
  if (!Array.isArray(boss.lastTwoMoves)) {
    boss.lastTwoMoves = [];
  }
  boss.lastTwoMoves.push(moveId);
  if (boss.lastTwoMoves.length > 2) {
    boss.lastTwoMoves.shift();
  }
}

export function startSoulsBossOpeningRoar(boss, elapsedTime, ctx) {
  if (!boss) return;
  const { audio, emitParticles, floatText } = ctx;
  const useCutscene = Boolean(ctx?.useCutsceneRiseRoar) && bossHasClip(boss, 'Cutscene_Rise_Roar');
  const clipName = useCutscene ? 'Cutscene_Rise_Roar' : 'Roar_Taunt';
  const cfg = useCutscene ? SOULS_BOSS_CLIP_TIMINGS.Cutscene_Rise_Roar : SOULS_BOSS_CLIP_TIMINGS.Roar_Taunt;
  const spd = useCutscene ? cfg.speed : cfg.speedOpening;

  boss.staggerMax = Math.max(boss.staggerMax || 0, SOULS_BOSS_MULTI_PARRY.staggerMax);
  boss.soulsState = 'roar_taunt';
  boss.soulsGoal = 'roar';
  boss.soulsActiveAttack = 'roar_taunt';
  boss.soulsMoveType = 'roar_taunt';
  boss.currentAttackMeta = null;
  boss.phase2Enraged = false;
  boss.lastTwoMoves = [];
  boss.soulsPlayerBlockTimer = 0;
  boss.soulsCloseExchangeTimer = 0;
  boss._soulsSmoothSpeed = 0;
  boss._soulsAngVel = 0;
  boss.soulsAttackElapsed = 0;
  boss.soulsPeakFired = false;
  boss.soulsRoarPeakAt = cfg.peakAt / spd;
  boss.soulsChained = false;
  boss.soulsBehindTimer = 0;
  boss.soulsParryCount = 0;
  boss.soulsFlaskPunishCd = 1.5;
  boss.strafeDir = Math.random() < 0.5 ? 1 : -1;
  boss.soulsStrafeTimer = 2.4 + Math.random() * 0.8;
  boss.soulsRhythmMode = 'stalk_advance';
  boss.soulsRhythmTimer = 1.6 + Math.random() * 0.8;
  boss.soulsMoveCd = { leap_slam: 1.2, whirl_spin: 2.0, delayed_crush: 1.5, aaa_combo: 0.6, sweep_combo: 0 };
  const res = boss.model?.handle?.playClampedClip?.(clipName, spd, SOULS_BOSS_CROSSFADE_SEC);
  boss.soulsAttackDur = res?.ok && res.duration > 0.2 ? res.duration : cfg.duration / spd;
  boss.soulsTimer = boss.soulsAttackDur;
  playBossRoarSfx(audio);
  emitParticles(boss.x, 2.2, boss.z, 0xfbbf24, 16, 5.5, 0.16);
  floatText('🔥 СУДИЯ РУИН ПРОБУДИЛСЯ!', boss.x, boss.z - 1.2, '#fbbf24');
}

// Act 3 of the Castle Boss Doors Cutscene: uses `Cutscene_Rise_Roar` (with seamless fallback to `Roar_Taunt`)
export function startSoulsBossCutsceneRiseRoar(boss, elapsedTime, ctx) {
  return startSoulsBossOpeningRoar(boss, elapsedTime, { ...(ctx || {}), useCutsceneRiseRoar: true });
}

export function startSoulsBossStaggerKneel(boss, elapsedTime, ctx) {
  if (!boss) return;
  const { audio, world, emitShockwave, emitParticles, floatText, triggerHitStop, resetEntityPoise } = ctx;
  const cfg = SOULS_BOSS_CLIP_TIMINGS.Stagger_Kneel;

  cancelSoulsBossTelegraph(boss, elapsedTime);
  clearSoulsBossPunishWindow(boss);
  boss.staggerMax = Math.max(boss.staggerMax || 0, SOULS_BOSS_MULTI_PARRY.staggerMax);
  boss.soulsChainCount = 0;
  boss.soulsParryCount = 0;
  boss.stagger = boss.staggerMax;
  boss.staggeredTimer = cfg.kneelSec;
  boss.staggerImmunityTimer = 0;
  boss.soulsState = 'stagger_kneel';
  boss.soulsGoal = 'stagger_kneel';
  boss.soulsActiveAttack = null;
  boss.soulsMoveType = null;
  boss.currentAttackMeta = null;
  boss.soulsChained = false;
  boss.soulsRiposteUsed = false;
  boss.soulsTimer = cfg.kneelSec;
  boss.stunTimer = 0;
  boss.vx = 0;
  boss.vz = 0;
  boss._soulsPrevState = 'stagger_kneel';
  triggerSoulsBossRecoil(boss, ctx?.player, 0.52, 0.24);

  boss.model?.handle?.setLocomotionState?.(null);
  boss.model?.handle?.setClipOverride?.(null);
  boss.model?.handle?.playClampedClip?.('Stagger_Kneel', cfg.speed, 0.16);
  if (boss.model?.obj && boss.model.obj.position.y > 0) {
    boss.model.obj.position.y = 0;
  }

  resetEntityPoise?.(boss, { grantImmunity: true });
  triggerHitStop?.(0.055, true);
  audio?.playBossRecoil?.();
  audio?.playArmorBreak?.('shield');
  audio?.playShieldBlock?.();
  world?.addScreenShake?.(0.50, 0.28);
  emitShockwave(boss.x, boss.z, 5.4, 0xfbbf24, 0.46);
  emitParticles(boss.x, 1.85, boss.z, 0xfde047, 28, 8.0, 0.18);
  floatText('⚡ СЛОМ СТОЙКИ! БОСС НА КОЛЕНЕ!', boss.x, boss.z - 0.9, '#fde047');
}

export function startSoulsBossRiposteVictim(boss, elapsedTime, ctx = {}) {
  if (!boss) return { ok: false, duration: 0 };
  const { audio, world, emitShockwave, emitParticles, floatText, resetEntityPoise } = ctx;
  const cfg = SOULS_BOSS_CLIP_TIMINGS.Riposte_Victim_Fall;

  cancelSoulsBossTelegraph(boss, elapsedTime);
  clearSoulsBossPunishWindow(boss);
  boss._soulsSmoothSpeed = 0;
  boss._soulsActiveStrafeClip = null;
  boss._soulsWalkOverrideActive = false;
  boss.model?.handle?.setLocomotionState?.(null);
  boss.model?.handle?.setClipOverride?.(null);

  boss.soulsState = 'riposte_victim';
  boss.soulsGoal = 'riposte_victim';
  boss.soulsActiveAttack = null;
  boss.soulsMoveType = null;
  boss.currentAttackMeta = null;
  boss.soulsChainCount = 0;
  boss.soulsRiposteUsed = true;
  boss.soulsRiposteInvuln = true;
  boss._soulsRiposteInitialized = true;
  boss.soulsRiposteElapsed = 0;
  boss.soulsRiposteFallImpactFired = false;
  boss.staggeredTimer = 0;
  boss.stunTimer = 0;
  boss.vx = 0;
  boss.vz = 0;
  boss._soulsPrevState = 'riposte_victim';

  const clipName = bossHasClip(boss, 'Riposte_Victim_Fall') ? 'Riposte_Victim_Fall' : 'Stagger_Recover';
  const res = boss.model?.handle?.playClampedClip?.(clipName, cfg.speed, 0.16);
  const dur =
    clipName === 'Riposte_Victim_Fall'
      ? (res?.ok && res.duration > 0.5 ? res.duration : cfg.duration / cfg.speed)
      : (res?.ok && res.duration > 0.2 ? res.duration : 1.1);
  boss.soulsTimer = dur;

  resetEntityPoise?.(boss, { grantImmunity: true });
  audio?.playBossRecoil?.();
  world?.addScreenShake?.(0.45, 0.24);
  emitShockwave?.(boss.x, boss.z, 4.4, 0xfbbf24, 0.36);
  emitParticles?.(boss.x, 1.8, boss.z, 0xfde047, 22, 7.2, 0.16);
  floatText?.('⚔️ КРИТИЧЕСКИЙ РИПОСТ!', boss.x, boss.z - 1.0, '#fde047');
  return { ok: true, duration: dur, clipName };
}

export function applySoulsBossParry(boss, elapsedTime, ctx = {}) {
  if (!boss) return { staggered: false, parryCount: 0, stagger: 0, staggerMax: SOULS_BOSS_MULTI_PARRY.staggerMax };
  const { audio, world, emitShockwave, emitParticles, floatText } = ctx;
  const mp = SOULS_BOSS_MULTI_PARRY;

  boss.staggerMax = Math.max(boss.staggerMax || 0, mp.staggerMax);
  cancelSoulsBossTelegraph(boss, elapsedTime);
  clearSoulsBossPunishWindow(boss);
  boss.soulsActiveAttack = null;
  boss.soulsMoveType = null;
  boss.currentAttackMeta = null;
  boss.soulsChainCount = 0;
  boss.soulsParryCount = (boss.soulsParryCount || 0) + 1;
  boss.stagger = Math.min(boss.staggerMax, (boss.stagger || 0) + mp.parryStaggerGain);

  // 3rd parry (220/220) -> full Stagger_Kneel for Critical Riposte!
  if (boss.stagger >= boss.staggerMax) {
    startSoulsBossStaggerKneel(boss, elapsedTime, ctx);
    return {
      staggered: true,
      parryCount: mp.parriesToKneel,
      stagger: boss.stagger,
      staggerMax: boss.staggerMax
    };
  }

  // Partial stance parry (+75/220) -> smooth Block_React + combo cancel + recoil!
  boss.soulsState = 'stalk';
  boss.soulsGoal = 'recover';
  boss.soulsTimer = 0.25;
  boss.stunTimer = Math.max(boss.stunTimer || 0, mp.blockReactStunSec);
  boss._soulsParryRecoilActive = true;
  triggerSoulsBossRecoil(boss, ctx?.player, 0.50, 0.24);
  boss.model?.handle?.setLocomotionState?.(null);
  boss.model?.handle?.setClipOverride?.(null);
  if (typeof boss.model?.handle?.playHitReact === 'function') {
    boss.model.handle.playHitReact({
      clipName: 'Block_React',
      speed: mp.blockReactSpeed,
      interruptAttack: true,
      blendInSec: 0.12,
      blendOutSec: 0.16
    });
  } else {
    boss.model?.handle?.playBossClip?.('Block_React', mp.blockReactSpeed, 0.12);
  }
  audio?.playBossRecoil?.();
  world?.addScreenShake?.(0.30, 0.16);
  emitShockwave?.(boss.x, boss.z, 3.8, 0xfbbf24, 0.30);
  emitParticles?.(boss.x, 1.8, boss.z, 0xfde047, 16, 6.2, 0.15);
  const shownParryIdx = Math.min(mp.parriesToKneel - 1, boss.soulsParryCount);
  floatText?.(`🛡️ ПАРИРОВАНИЕ (${shownParryIdx}/${mp.parriesToKneel})!`, boss.x, boss.z - 0.9, '#fde047');
  return {
    staggered: false,
    parryCount: boss.soulsParryCount,
    stagger: boss.stagger,
    staggerMax: boss.staggerMax
  };
}

export function updateSoulsBossAI(boss, dt, elapsedTime, ctx) {
  const {
    player,
    souls,
    world,
    audio,
    emitParticles,
    emitSlashArc,
    emitShockwave,
    emitTelegraphZone,
    floatText,
    applyDamageToPlayer,
    resolveObstaclesAndBounds,
    resetEntityPoise
  } = ctx;

  if (boss.isSoulsBoss && !(boss.staggerMax >= SOULS_BOSS_MULTI_PARRY.staggerMax)) {
    boss.staggerMax = SOULS_BOSS_MULTI_PARRY.staggerMax;
  }

  const dx = player.x - boss.x;
  const dz = player.z - boss.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const angToPlayer = Math.atan2(dx, dz);
  const relAngFromFront = Math.abs(normalizeAngle(angToPlayer - boss.facing));
  const slowMult = boss.frostTimer > 0 ? 1 - (1 - (boss.frostFactor || 0.75)) * 0.40 : 1.0;
  const moveSpeed = boss.speed * slowMult;
  const phase2 = boss.hp < boss.maxHp * 0.50;
  if (phase2 || boss._soulsPhase2Done) {
    boss.phase2Enraged = true;
  } else if (boss.phase2Enraged === undefined) {
    boss.phase2Enraged = false;
  }
  boss._aiClock = elapsedTime;
  const lastHitAt = Number.isFinite(boss.soulsLastHitAt) ? boss.soulsLastHitAt : -99;
  const sinceLastHit = elapsedTime - lastHitAt;
  const playerHealing = Boolean(ctx.playerHealing || (souls?.flaskDrinkTimer || 0) > 0);
  const playerBlockingClose = Boolean((ctx.playerBlocking || souls?.isBlocking) && dist <= 5.6);
  // Pure Elden Ring combat readability: zero red circles or warning popups before boss attacks!
  const floatAttackHint = () => {};

  if (!boss.soulsMoveCd) {
    boss.soulsMoveCd = { leap_slam: 0, whirl_spin: 0, delayed_crush: 0, aaa_combo: 0, sweep_combo: 0 };
  }
  if (!Array.isArray(boss.lastTwoMoves)) {
    boss.lastTwoMoves = [];
  }
  const cd = boss.soulsMoveCd;
  cd.leap_slam = Math.max(0, (cd.leap_slam || 0) - dt);
  cd.whirl_spin = Math.max(0, (cd.whirl_spin || 0) - dt);
  cd.delayed_crush = Math.max(0, (cd.delayed_crush || 0) - dt);
  cd.aaa_combo = Math.max(0, (cd.aaa_combo || 0) - dt);
  cd.sweep_combo = Math.max(0, (cd.sweep_combo || 0) - dt);
  boss.soulsFlaskPunishCd = Math.max(0, (boss.soulsFlaskPunishCd || 0) - dt);
  boss.soulsRollPunishCd = Math.max(0, (boss.soulsRollPunishCd || 0) - dt);
  boss._soulsFootstepTimer = Math.max(0, (boss._soulsFootstepTimer || 0) - dt);

  // Track panic roll-spam (rising edge of player roll within 3.2s window -> delayed roll-catch!)
  const playerRollingNow = Boolean(ctx.playerRolling || (player?.dashTimer || 0) > 0.05);
  if (!Array.isArray(boss._soulsRollTimes)) {
    boss._soulsRollTimes = [];
  }
  if (playerRollingNow && !boss._soulsPrevPlayerRolling) {
    boss._soulsRollTimes.push(elapsedTime);
    if (boss._soulsRollTimes.length > 6) boss._soulsRollTimes.shift();
  }
  boss._soulsPrevPlayerRolling = playerRollingNow;
  let recentRolls = 0;
  for (let i = boss._soulsRollTimes.length - 1; i >= 0; i--) {
    if (elapsedTime - boss._soulsRollTimes[i] <= 3.2) {
      recentRolls++;
    } else {
      boss._soulsRollTimes.splice(0, i + 1);
      break;
    }
  }

  // Track persistent player shield-hold for conscious stamina-breaker punish (>= 1.5s)
  if (playerBlockingClose) {
    boss.soulsPlayerBlockTimer = (boss.soulsPlayerBlockTimer || 0) + dt;
  } else {
    boss.soulsPlayerBlockTimer = Math.max(0, (boss.soulsPlayerBlockTimer || 0) - dt * 1.6);
  }

  // Track prolonged nose-to-nose trading so the boss triggers a tactical backstep
  if (dist < 2.65) {
    boss.soulsCloseExchangeTimer = (boss.soulsCloseExchangeTimer || 0) + dt;
  } else {
    boss.soulsCloseExchangeTimer = Math.max(0, (boss.soulsCloseExchangeTimer || 0) - dt * 1.4);
  }

  if (boss.strafeDir !== 1 && boss.strafeDir !== -1) {
    boss.strafeDir = Math.random() < 0.5 ? 1 : -1;
  }

  // IMPORTANT: pass resetSpeed=false while still in `stalk` so 60/120/144Hz speed ramp NEVER resets to 0!
  // Also keep `setClipOverride(null)` clear so `models.js` 4-way locomotion works with 100% smoothness!
  const clearWalkOverride = (resetSpeed = true) => {
    if (resetSpeed) {
      boss._soulsSmoothSpeed = 0;
      boss._soulsSmoothVx = 0;
      boss._soulsSmoothVz = 0;
      boss._soulsActiveStrafeClip = null;
      boss.model?.handle?.setLocomotionState?.(null);
    }
    if (boss._soulsWalkOverrideActive) {
      boss._soulsWalkOverrideActive = false;
      boss.model?.handle?.setClipOverride?.(null);
    }
  };

  const maxChainLinks = boss.phase2Enraged ? 2 : 1;
  const hallRadius = Math.max(11.0, Number(SOULS_CASTLE_CONSTANTS?.BOSS_RADIUS) || 16.0);
  const maxLeapRange = clamp(hallRadius * 1.12, 14.5, 19.0);
  const maxLeapStepDist = clamp(hallRadius * 0.78, 10.6, 13.6);

  const strikeHitPayload = (meta, extra = null) => ({
    parryable: Boolean(meta?.canParry),
    isHeavy: meta?.damageLevel === 'heavy',
    staminaDamage: meta?.staminaDamage ?? 48,
    damageLevel: meta?.damageLevel ?? 'heavy',
    activeWindowSec: meta?.activeWindowSec ?? 0.10,
    attackMeta: meta || null,
    ...(extra || {})
  });

  // Persistent crimson/gold embers in Phase 2 (stronger when phase2Enraged)
  if (boss.phase2Enraged && boss.soulsState !== 'stagger_kneel' && Math.random() < dt * 12) {
    emitParticles(
      boss.x + (Math.random() - 0.5) * 1.4,
      1.9 + Math.random() * 1.1,
      boss.z + (Math.random() - 0.5) * 1.4,
      Math.random() < 0.55 ? 0xf97316 : 0xef4444,
      1,
      2.8,
      0.14
    );
  }

  const prevSoulsState = boss._soulsPrevState;
  boss._soulsPrevState = boss.soulsState;
  if (boss.stunTimer <= 0) {
    boss._soulsParryRecoilActive = false;
  }

  // ------------------------------------------------------------------------
  // A. STANCE BREAK: KNEELING ON ONE KNEE (4.2s) -> STAGGER_RECOVER (0.933s)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'stagger_kneel') {
    clearWalkOverride();
    if (prevSoulsState !== 'stagger_kneel' && !boss._soulsRecoil) {
      triggerSoulsBossRecoil(boss, player, 0.52, 0.24);
      audio?.playBossRecoil?.();
    }
    stepSoulsBossRecoil(boss, dt, player, resolveObstaclesAndBounds);
    boss.vx *= 0.25;
    boss.vz *= 0.25;
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    boss.soulsGoal = 'stagger_kneel';
    if (Math.random() < dt * 14) {
      emitParticles(
        boss.x + (Math.random() - 0.5) * 1.1,
        1.75,
        boss.z + (Math.random() - 0.5) * 1.1,
        0xfde047,
        1,
        2.4,
        0.13
      );
    }
    if ((boss.staggeredTimer || 0) <= 0) {
      // Transition cleanly from clamped Stagger_Kneel -> Stagger_Recover
      const cfgRec = SOULS_BOSS_CLIP_TIMINGS.Stagger_Recover;
      const res = boss.model?.handle?.playClampedClip?.('Stagger_Recover', cfgRec.speed, 0.16);
      boss.soulsState = 'stagger_recover';
      boss.soulsTimer = res?.ok && res.duration > 0.15 ? res.duration : cfgRec.duration;
      boss.stagger = 0;
      boss.soulsParryCount = 0;
      boss.staggerImmunityTimer = 4.5;
      resetEntityPoise?.(boss, { grantImmunity: true });
    }
    return { isMoving: false };
  }

  if (boss.soulsState === 'stagger_recover') {
    clearWalkOverride(true);
    boss.vx = 0;
    boss.vz = 0;
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    if (boss.soulsTimer <= 0 || boss.model?.handle?.isClampedClipDone?.()) {
      boss.model?.handle?.clearClampedClip?.(true);
      boss.soulsState = 'stalk';
      boss.soulsGoal = 'circle_spacing';
      boss.soulsTimer = 0.55;
      resetEntityPoise?.(boss, { grantImmunity: true });
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // A2. CRITICAL RIPOSTE VICTIM (`Riposte_Victim_Fall` 3.60s: impaled -> back fall -> rise)
  // Full protection from extra attacks while falling & lying on the stone floor!
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'riposte_victim') {
    if (!boss._soulsRiposteInitialized) {
      startSoulsBossRiposteVictim(boss, elapsedTime, ctx);
    }
    clearWalkOverride(true);
    boss.vx = 0;
    boss.vz = 0;
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    boss.soulsGoal = 'riposte_victim';
    boss.soulsRiposteInvuln = true;
    boss.soulsRiposteElapsed = (boss.soulsRiposteElapsed || 0) + dt;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);

    const cfgRip = SOULS_BOSS_CLIP_TIMINGS.Riposte_Victim_Fall;
    if (!boss.soulsRiposteFallImpactFired && boss.soulsRiposteElapsed >= cfgRip.fallImpactAt) {
      boss.soulsRiposteFallImpactFired = true;
      playBossHammerGroundSfx(audio);
      world?.addScreenShake?.(0.38, 0.22);
      emitShockwave(boss.x, boss.z, 3.8, 0xd6d3d1, 0.34);
      emitParticles(boss.x, 0.35, boss.z, 0xd6d3d1, 18, 5.4, 0.15);
    }

    if (boss.soulsTimer <= 0 || boss.model?.handle?.isClampedClipDone?.()) {
      boss.model?.handle?.clearClampedClip?.(true);
      boss.soulsRiposteInvuln = false;
      boss._soulsRiposteInitialized = false;
      boss.stagger = 0;
      boss.soulsParryCount = 0;
      boss.staggerImmunityTimer = 5.0;
      boss.soulsState = 'stalk';
      boss.soulsGoal = 'circle_spacing';
      boss.soulsTimer = 0.50;
      resetEntityPoise?.(boss, { grantImmunity: true });
    }
    return { isMoving: false };
  }
  boss.soulsRiposteInvuln = false;
  boss._soulsRiposteInitialized = false;

  // ------------------------------------------------------------------------
  // B. OPENING ROAR (POST-THRONE) & PHASE 2 TRANSITION ROAR (<50% HP)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'roar_taunt' || boss.soulsState === 'phase2_roar') {
    clearWalkOverride();
    const isP2Roar = boss.soulsState === 'phase2_roar';
    const cfgRoar = SOULS_BOSS_CLIP_TIMINGS.Roar_Taunt;
    const spd = isP2Roar ? cfgRoar.speedPhase2 : cfgRoar.speedOpening;
    boss.vx *= 0.2;
    boss.vz *= 0.2;
    boss.currentAttackMeta = null;
    boss.soulsGoal = 'roar';
    stepBossTurn(boss, angToPlayer, 2.8, dt);
    boss.soulsAttackElapsed = (boss.soulsAttackElapsed || 0) + dt;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);

    const peakAtSec = Number.isFinite(boss.soulsRoarPeakAt) ? boss.soulsRoarPeakAt : cfgRoar.peakAt / spd;
    if (!boss.soulsPeakFired && boss.soulsAttackElapsed >= peakAtSec) {
      boss.soulsPeakFired = true;
      playBossRoarSfx(audio);
      world?.addScreenShake?.(isP2Roar ? 0.46 : 0.30, isP2Roar ? 0.30 : 0.22);
      emitShockwave(boss.x, boss.z, isP2Roar ? 8.6 : 7.2, isP2Roar ? 0xef4444 : 0xf59e0b, 0.52);
      emitParticles(boss.x, 2.3, boss.z, isP2Roar ? 0xf97316 : 0xfde047, isP2Roar ? 28 : 18, 7.6, 0.17);
    }

    if (boss.soulsTimer <= 0 || boss.model?.handle?.isClampedClipDone?.()) {
      boss.model?.handle?.clearClampedClip?.(true);
      boss.soulsState = 'stalk';
      boss.soulsGoal = 'circle_spacing';
      boss.soulsActiveAttack = null;
      boss.soulsMoveType = null;
      boss.soulsTimer = isP2Roar ? 0.28 : 0.48;
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // C. PARRY STUN / POISE MICRO-STUN (HIT_REACT)
  // ------------------------------------------------------------------------
  if (boss.stunTimer > 0) {
    clearWalkOverride();
    if (boss.stunTimer > 0.35 && !boss._soulsParryRecoilActive) {
      boss._soulsParryRecoilActive = true;
      triggerSoulsBossRecoil(boss, player, 0.50, 0.24);
      audio?.playBossRecoil?.();
    }
    stepSoulsBossRecoil(boss, dt, player, resolveObstaclesAndBounds);
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    stepBossTurn(boss, angToPlayer, 1.4, dt);
    return { isMoving: false };
  }

  if (boss.soulsState === 'hit_react') {
    clearWalkOverride();
    if (prevSoulsState !== 'hit_react') {
      triggerSoulsBossRecoil(boss, player, 0.48, 0.24);
      audio?.playBossRecoil?.();
    }
    stepSoulsBossRecoil(boss, dt, player, resolveObstaclesAndBounds);
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    if ((boss.soulsPunishTimer || 0) > 0) {
      boss.soulsPunishTimer = Math.max(0, boss.soulsPunishTimer - dt);
    }
    stepBossTurn(boss, angToPlayer, 2.0, dt);
    if (boss.soulsTimer <= 0 && (boss.poiseMicroStunTimer || 0) <= 0) {
      if (boss.soulsPunishWindow && (boss.soulsPunishTimer || 0) > 0) {
        // Flinch never shortens an earned punish window: resume the remaining open recover
        boss.soulsState = 'recover';
        boss.soulsTimer = boss.soulsPunishTimer;
      } else {
        clearSoulsBossPunishWindow(boss);
        boss.soulsState = 'stalk';
        boss.soulsGoal = 'circle_spacing';
        boss.soulsTimer = 0.20;
      }
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // Helper: Launch one of the 5 tactical Souls attacks (0.14s smooth crossfade)
  // ------------------------------------------------------------------------
  const launchAttack = (moveId, launchOpts = null) => {
    clearWalkOverride();
    clearSoulsBossPunishWindow(boss);
    boss._soulsRecoil = null;
    boss.soulsLastMove = moveId;
    if (launchOpts?.goalTag !== 'combo_branch') {
      recordSoulsBossMove(boss, moveId);
    }
    boss.soulsMoveType = moveId;
    boss.soulsActiveAttack = moveId;
    boss.soulsGoal = launchOpts?.goalTag || 'attack';
    boss.soulsAttackElapsed = 0;
    boss.soulsHit1Done = false;
    boss.soulsHit2Done = false;
    boss.soulsHit3Done = false;
    boss.soulsTelegraph2Done = false;
    boss.soulsTelegraph3Done = false;
    boss.soulsAntiGreedHugRolled = false;
    boss.soulsAntiGreedHitRolledAt = -99;
    boss.soulsSweepChainRolled = false;
    boss.soulsBranchRolled = false;
    boss.soulsBehindTimer = 0;
    boss.soulsStrikeDirX = Math.sin(boss.facing);
    boss.soulsStrikeDirZ = Math.cos(boss.facing);

    if (moveId === 'overhead_cleave') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Heavy_Cleave;
      const isQuickTurn = Boolean(launchOpts?.quickTurnaround);
      const clipSpeed = isQuickTurn ? 1.24 : cfg.speed;
      boss.soulsState = 'overhead_cleave';
      boss.soulsChained = false;
      boss.soulsClipSpeed = clipSpeed;
      boss.soulsQuickTurn = isQuickTurn;
      boss.currentAttackMeta = isQuickTurn ? SOULS_BOSS_ATTACK_META.quick_cleave : SOULS_BOSS_ATTACK_META.overhead_cleave;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsImpactAt = cfg.impactAt / clipSpeed;
      stepBossTurn(boss, angToPlayer, isQuickTurn ? SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad : SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Heavy_Cleave', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.2, 0.13);
      return;
    }

    if (moveId === 'sweep_combo') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Sweep_Combo;
      boss.soulsState = 'sweep_combo';
      boss.soulsClipSpeed = cfg.speed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.sweep_combo_1;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / cfg.speed;
      boss.soulsHit1At = cfg.hit1At / cfg.speed;
      boss.soulsHit2At = cfg.hit2At / cfg.speed;
      cd.sweep_combo = phase2 ? 2.4 : 3.2;
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Sweep_Combo', cfg.speed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.2, 0.13);
      return;
    }

    if (moveId === 'aaa_combo') {
      if (!bossHasClip(boss, 'Combo_Sweep_1')) {
        return launchAttack('delayed_crush', launchOpts);
      }
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Combo_Sweep_1;
      boss.soulsState = 'aaa_combo';
      boss.soulsComboStage = 1;
      boss.soulsComboStageElapsed = 0;
      boss.soulsComboStageHitDone = false;
      boss.soulsClipSpeed = cfg.speed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_sweep_1;
      cd.aaa_combo = phase2 ? 3.2 : 4.2;
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const res = playBossAttackClip(boss, 'Combo_Sweep_1', cfg.speed, SOULS_BOSS_CROSSFADE_SEC);
      const realDur = res?.ok && res.duration > 0.2 ? res.duration : (cfg.endAt || cfg.duration) / cfg.speed;
      boss.soulsComboStageDur = Math.min(realDur, (cfg.endAt || cfg.duration) / cfg.speed + 0.06);
      boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg.impactAt / (cfg.endAt || cfg.duration));
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.4, 0.13);
      return;
    }

    if (moveId === 'delayed_crush') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Delayed_Crush;
      boss.soulsState = 'delayed_crush';
      boss.soulsClipSpeed = cfg.speed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_1;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / cfg.speed;
      boss.soulsHit1At = cfg.hit1At / cfg.speed;
      boss.soulsHit2At = cfg.hit2At / cfg.speed;
      boss.soulsLockAt = cfg.lockAt / cfg.speed;
      boss.soulsImpactAt = cfg.impactAt / cfg.speed;
      cd.delayed_crush = phase2 ? 3.4 : 4.2;
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Delayed_Crush', cfg.speed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 3.5, 0.13);
      return;
    }

    if (moveId === 'leap_slam') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Leap_Slam;
      boss.soulsState = 'leap_slam';
      boss.soulsClipSpeed = cfg.speed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.leap_slam;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / cfg.speed;
      boss.soulsTakeoffAt = cfg.takeoffAt / cfg.speed;
      boss.soulsFlightStartAt = (cfg.flightStartAt ?? cfg.takeoffAt) / cfg.speed;
      boss.soulsLandMoveEndAt = cfg.landMoveEndAt / cfg.speed;
      boss.soulsImpactAt = cfg.impactAt / cfg.speed;
      boss.soulsLeapSfxPlayed = false;
      cd.leap_slam = phase2 ? 3.6 : 4.6;
      boss.facing = angToPlayer;
      boss.leapStartX = boss.x;
      boss.leapStartZ = boss.z;
      const leapDist = clamp(dist - 1.05, 3.2, maxLeapStepDist);
      const rawEndX = boss.x + (dx / dist) * leapDist;
      const rawEndZ = boss.z + (dz / dist) * leapDist;
      const safeEnd = resolveObstaclesAndBounds
        ? resolveObstaclesAndBounds(rawEndX, rawEndZ, boss.radius, ARENA_ENTITY_LIMIT)
        : clampBossToSoulsHallFallback(rawEndX, rawEndZ, boss.radius);
      boss.leapEndX = safeEnd.x;
      boss.leapEndZ = safeEnd.z;
      playBossAttackClip(boss, 'Leap_Slam', cfg.speed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.35, boss.z, 0xd6d3d1, 12, 4.4, 0.14);
      return;
    }

    if (moveId === 'whirl_spin') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Whirl_Spin;
      const windupSec =
        Number.isFinite(Number(launchOpts?.windupSec)) && Number(launchOpts.windupSec) > 0.1
          ? Number(launchOpts.windupSec)
          : cfg.windupSec;
      boss.soulsState = 'whirl_windup';
      boss.soulsClipSpeed = cfg.speed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.whirl_spin;
      boss.soulsTimer = windupSec;
      cd.whirl_spin = phase2 ? 4.2 : 5.4;
      boss.spinHitTimer = 0;
      boss.spinVfxTimer = 0;
      // Smooth crossfade without harsh cancelAttackAnim() pose reset!
      boss.model?.handle?.setClipOverride?.('Whirl_Spin', 0.65);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.35, boss.z, 0xd6d3d1, 10, 3.8, 0.14);
    }
  };

  const enterRecover = (recoverSec, punishTier = null) => {
    cancelSoulsBossTelegraph(boss, elapsedTime);
    clearWalkOverride(true);
    boss.model?.handle?.setClipOverride?.(null);

    boss.soulsState = 'recover';
    boss.soulsGoal = 'recover';
    boss.soulsActiveAttack = null;
    boss.soulsMoveType = null;
    boss.currentAttackMeta = null;
    boss.soulsChained = false;
    boss.soulsTimer = recoverSec;
    const tier = punishTier === 'heavy' || punishTier === 'light' ? punishTier : null;
    boss.soulsPunishWindow = tier;
    boss.soulsPunishTimer = tier ? recoverSec : 0;
    boss.soulsPunishDmgMult = tier ? PUNISH_DMG_MULT[tier] : 1.0;
    boss.soulsPunishStaggerMult = tier ? PUNISH_STAGGER_MULT[tier] : 1.0;
    boss.soulsPunishTagShown = false;
    if (tier) {
      boss.soulsChainCount = 0;
    }

    // Smooth 0.22s crossfade directly from outgoing attack pose into `Recover_Heft` (ZERO cancelAttackAnim snap!)
    if (bossHasClip(boss, 'Recover_Heft')) {
      const cfgHeft = SOULS_BOSS_CLIP_TIMINGS.Recover_Heft;
      const heftSpeed = clamp((cfgHeft.duration || 0.95) / Math.max(0.75, Math.min(recoverSec, 1.08)), 0.85, 1.22);
      playBossAttackClip(boss, 'Recover_Heft', heftSpeed, SOULS_BOSS_CROSSFADE_SEC);
      boss._soulsRecoverHeftPlaying = true;
    } else {
      boss._soulsRecoverHeftPlaying = false;
    }

    if (tier === 'heavy') {
      // Subtle warm golden ember exhale so skilled players read the breather naturally
      emitParticles(boss.x, 0.55, boss.z, 0xfde047, 10, 3.0, 0.13);
    }
  };

  // Elden Ring Animation-State Reading (Flask Punish): checks pillar LOS & >=4.5s cooldown
  const tryFlaskPunish = () => {
    if (!playerHealing) return false;
    if ((boss.soulsFlaskPunishCd || 0) > 0) return false;
    if (dist > maxLeapRange) return false;
    if (!hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)) return false;

    boss.soulsFlaskPunishCd = SOULS_BOSS_GOAL_CFG.flaskPunishCooldownSec;
    boss.soulsChainCount = 0;
    if (dist > 5.2 && cd.leap_slam <= 0) {
      launchAttack('leap_slam', { goalTag: 'flask_punish', silentText: true });
    } else if (dist > 5.0 && cd.delayed_crush <= 0) {
      launchAttack('delayed_crush', { goalTag: 'flask_punish', silentText: true });
    } else {
      launchAttack('overhead_cleave', {
        quickTurnaround: relAngFromFront > 0.95,
        goalTag: 'flask_punish'
      });
    }
    floatAttackHint('⚡ ПЕРЕХВАТ ФЛЯГИ!', boss.x, boss.z - 1.0, '#fb923c');
    return true;
  };

  // Elden Ring `luabnd` Dynamic Combo Branching based on live distance & angle at end of attack
  // Phase 1 caps at 1 link; Phase 2 Enraged escalates up to 2 links (heavy finishers always open recover)
  const tryComboBranch = (fromMove) => {
    if ((boss.soulsChainCount || 0) >= maxChainLinks) return false;
    const goalCfg = SOULS_BOSS_GOAL_CFG;

    // 1. Player behind or flanking -> quick turnaround Heavy_Cleave (or Whirl_Spin if rear-hugged)
    if (relAngFromFront > goalCfg.behindAngleRad && dist <= 5.4) {
      boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
      emitParticles(boss.x, 0.25, boss.z, 0xd6d3d1, 8, 3.6, 0.12);
      if (relAngFromFront > 1.68 && cd.whirl_spin <= 0 && Math.random() < 0.45) {
        launchAttack('whirl_spin', {
          windupSec: SOULS_BOSS_PUNISH_PROFILES.overhead_cleave.counterWhirlWindup,
          goalTag: 'combo_branch',
          silentText: true
        });
      } else {
        launchAttack('overhead_cleave', { quickTurnaround: true, goalTag: 'combo_branch' });
      }
      return true;
    }

    // 2. Player retreated far (> 8.5m) with clear LOS -> Leap_Slam gap-closer!
    if (dist > goalCfg.farBranchDist && dist <= maxLeapRange && cd.leap_slam <= 0 && hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)) {
      boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.0, 0.13);
      launchAttack('leap_slam', { goalTag: 'combo_branch', silentText: true });
      return true;
    }

    // 3. Mid-range branch -> Sweep_Combo or delayed roll-catch Delayed_Crush
    if (dist >= 3.2 && dist <= 7.6) {
      if (fromMove === 'overhead_cleave') {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.2, 0.13);
        if ((recentRolls >= 2 || dist > 4.6 || Math.random() < (phase2 ? 0.55 : 0.35)) && cd.delayed_crush <= 0) {
          launchAttack('delayed_crush', { goalTag: 'combo_branch', silentText: true });
        } else {
          launchAttack('sweep_combo', { goalTag: 'combo_branch' });
        }
        return true;
      }
      if (fromMove === 'sweep_combo' && cd.delayed_crush <= 0) {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.2, 0.13);
        launchAttack('delayed_crush', { goalTag: 'combo_branch', silentText: true });
        return true;
      }
    }
    return false;
  };

  const triggerPhase2Roar = () => {
    clearWalkOverride();
    cancelSoulsBossTelegraph(boss, elapsedTime);
    clearSoulsBossPunishWindow(boss);
    boss.soulsChainCount = 0;
    boss._soulsPhase2Done = true;
    boss.phase2Enraged = true;
    const cfgRoar = SOULS_BOSS_CLIP_TIMINGS.Roar_Taunt;
    boss.soulsState = 'phase2_roar';
    boss.soulsGoal = 'roar';
    boss.soulsActiveAttack = 'phase2_roar';
    boss.soulsMoveType = 'phase2_roar';
    boss.currentAttackMeta = null;
    boss.soulsAttackElapsed = 0;
    boss.soulsPeakFired = false;
    boss.soulsRoarPeakAt = cfgRoar.peakAt / cfgRoar.speedPhase2;
    boss.model?.handle?.setClipOverride?.(null);
    const res = boss.model?.handle?.playClampedClip?.('Roar_Taunt', cfgRoar.speedPhase2, SOULS_BOSS_CROSSFADE_SEC);
    boss.soulsAttackDur = res?.ok && res.duration > 0.2 ? res.duration : cfgRoar.duration / cfgRoar.speedPhase2;
    boss.soulsTimer = boss.soulsAttackDur;
    playBossRoarSfx(audio);
    world?.addScreenShake?.(0.40, 0.26);
    emitShockwave(boss.x, boss.z, 7.2, 0xef4444, 0.48);
    emitParticles(boss.x, 1.8, boss.z, 0xf97316, 24, 7.2, 0.16);
    floatText('🔥 ЯРОСТЬ СУДИИ РУИН!', boss.x, boss.z - 1.2, '#f97316');
  };

  // ------------------------------------------------------------------------
  // D0. AAA FLUID 3-HIT COMBO (`Combo_Sweep_1` -> `Combo_Backhand_2` -> `Combo_Slam_3`)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'aaa_combo') {
    const stage = boss.soulsComboStage || 1;
    const prevStageT = boss.soulsComboStageElapsed || 0;
    boss.soulsComboStageElapsed = prevStageT + dt;
    const st = boss.soulsComboStageElapsed;
    const stageDur = Math.max(0.25, boss.soulsComboStageDur || 0.95);
    const impactAt = Math.max(0.15, boss.soulsComboStageImpactAt || stageDur * 0.52);

    const cfgKey = stage === 1 ? 'Combo_Sweep_1' : stage === 2 ? 'Combo_Backhand_2' : 'Combo_Slam_3';
    const cfg = SOULS_BOSS_CLIP_TIMINGS[cfgKey];
    const trackCutoff = impactAt * (cfg.trackingCutoff01 || 0.68);

    if (!boss.soulsComboStageHitDone && st < trackCutoff) {
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    // Weighty physical forward drive synced to each strike stage
    const lungeDist = stage === 1 ? 1.8 : stage === 2 ? 2.1 : 2.5;
    const step = sampleWindowStep(prevStageT, st, impactAt * 0.36, impactAt * 1.05, lungeDist, easeAttackDrive);
    if (step > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        step,
        player,
        resolveObstaclesAndBounds
      );
    }

    if (!boss.soulsComboStageHitDone && st >= impactAt) {
      boss.soulsComboStageHitDone = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
      const pDx = player.x - boss.x;
      const pDz = player.z - boss.z;
      const pDist = Math.hypot(pDx, pDz);
      const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));

      if (stage === 1) {
        const reach = 4.45;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.24, 0.14);
        emitSlashArc(boss.x, boss.z, sAng, reach, Math.PI * 1.04, 0xef4444, { duration: 0.24, y: 1.35, sweepRad: 0.56 });
        emitParticles(boss.x + boss.soulsStrikeDirX * 2.1, 1.25, boss.z + boss.soulsStrikeDirZ * 2.1, 0xf97316, 12, 5.2, 0.14);
        if (pDist <= reach + player.radius * 0.5 && (relA <= Math.PI * 0.54 || pDist <= 2.35)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 0.90), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_sweep_1));
        }
      } else if (stage === 2) {
        const reach = 4.55;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.32, 0.16);
        emitSlashArc(boss.x, boss.z, sAng, reach, Math.PI * 1.10, 0xf97316, { duration: 0.25, y: 1.38, sweepRad: -0.58 });
        emitParticles(boss.x + boss.soulsStrikeDirX * 2.2, 1.30, boss.z + boss.soulsStrikeDirZ * 2.2, 0xfbbf24, 14, 5.8, 0.14);
        if (pDist <= reach + player.radius * 0.5 && (relA <= Math.PI * 0.56 || pDist <= 2.4)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 1.08), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_backhand_2));
        }
      } else {
        const impX = boss.x + boss.soulsStrikeDirX * 2.15;
        const impZ = boss.z + boss.soulsStrikeDirZ * 2.15;
        const slamR = 4.20;
        playBossHammerGroundSfx(audio);
        world?.addScreenShake?.(0.52, 0.28);
        emitShockwave(impX, impZ, slamR * 0.85, 0xd6d3d1, 0.36);
        emitShockwave(impX, impZ, slamR * 0.55, 0xfbbf24, 0.28);
        emitParticles(impX, 0.45, impZ, 0xf97316, 24, 7.6, 0.16);
        emitParticles(impX, 0.25, impZ, 0xd6d3d1, 16, 5.4, 0.14);
        if (Math.hypot(player.x - impX, player.z - impZ) <= slamR + player.radius * 0.55) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 1.32), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_slam_3));
        }
      }
    }

    // Seamless modular branching & stage chaining with smooth 0.20s crossfade (zero pose snaps!)
    if (st >= stageDur) {
      if (stage === 1) {
        if (dist > 8.0 && dist <= maxLeapRange && cd.leap_slam <= 0 && hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)) {
          launchAttack('leap_slam', { goalTag: 'combo_branch', silentText: true });
          return { isMoving: false };
        }
        if (relAngFromFront > 1.38 && dist <= 5.0 && cd.whirl_spin <= 0 && Math.random() < 0.55) {
          launchAttack('whirl_spin', {
            windupSec: SOULS_BOSS_PUNISH_PROFILES.overhead_cleave.counterWhirlWindup,
            goalTag: 'combo_branch',
            silentText: true
          });
          return { isMoving: false };
        }
      }
      if (stage === 1 && dist <= 7.4 && bossHasClip(boss, 'Combo_Backhand_2')) {
        const cfg2 = SOULS_BOSS_CLIP_TIMINGS.Combo_Backhand_2;
        boss.soulsComboStage = 2;
        boss.soulsComboStageElapsed = 0;
        boss.soulsComboStageHitDone = false;
        boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_backhand_2;
        const res2 = playBossAttackClip(boss, 'Combo_Backhand_2', cfg2.speed, 0.20);
        const realDur2 = res2?.ok && res2.duration > 0.2 ? res2.duration : (cfg2.endAt || cfg2.duration) / cfg2.speed;
        boss.soulsComboStageDur = Math.min(realDur2, (cfg2.endAt || cfg2.duration) / cfg2.speed + 0.06);
        boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg2.impactAt / (cfg2.endAt || cfg2.duration));
        audio?.playBossFootstep?.();
        return { isMoving: false };
      }
      // In Phase 1 occasionally break after Hit 2 (25%) for varied rhythm; Phase 2, roll-spam, or close/greedy always slams Stage 3!
      const continueToStage3 =
        boss.phase2Enraged ||
        recentRolls >= 2 ||
        dist <= 5.2 ||
        (sinceLastHit >= 0 && sinceLastHit <= 0.75) ||
        Math.random() < 0.75;
      if (stage === 2 && dist <= 7.8 && continueToStage3 && bossHasClip(boss, 'Combo_Slam_3')) {
        const cfg3 = SOULS_BOSS_CLIP_TIMINGS.Combo_Slam_3;
        boss.soulsComboStage = 3;
        boss.soulsComboStageElapsed = 0;
        boss.soulsComboStageHitDone = false;
        boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_slam_3;
        const res3 = playBossAttackClip(boss, 'Combo_Slam_3', cfg3.speed, 0.20);
        const realDur3 = res3?.ok && res3.duration > 0.2 ? res3.duration : (cfg3.endAt || cfg3.duration) / cfg3.speed;
        boss.soulsComboStageDur = Math.min(realDur3, (cfg3.endAt || cfg3.duration) / cfg3.speed + 0.06);
        boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg3.impactAt / (cfg3.endAt || cfg3.duration));
        audio?.playBossFootstep?.();
        return { isMoving: false };
      }
      const pAC = SOULS_BOSS_PUNISH_PROFILES.aaa_combo;
      const tier = stage >= 3 ? pAC.tier : 'light';
      const recSec = stage >= 3 ? (phase2 ? pAC.recoverP2 : pAC.recoverP1) : (phase2 ? 0.72 : 0.84);
      enterRecover(recSec, tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // D. ATTACK 1 — OVERHEAD CLEAVE (`Heavy_Cleave`, parryable, fair 66% tracking cutoff)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'overhead_cleave') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Heavy_Cleave;
    const clipSpeed = boss.soulsClipSpeed || cfg.speed;
    const prevT = boss.soulsAttackElapsed;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const trackCutoffClipT = cfg.impactAt * cfg.trackingCutoff01;

    if (!boss.soulsHit1Done && clipT < trackCutoffClipT) {
      stepBossTurn(
        boss,
        angToPlayer,
        boss.soulsQuickTurn ? SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad : SOULS_BOSS_GOAL_CFG.turnRateWindupRad,
        dt
      );
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    // Weighty shoulder lunge into cleave (+2.2m @ 0.48..1.05s) + follow-through inertia (+0.45m @ 1.05..1.35s)
    const cleaveStep =
      sampleWindowStep(prevClipT, clipT, 0.48, 1.05, 2.2, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 1.05, 1.35, 0.45, easeOutQuad);
    if (cleaveStep > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        cleaveStep,
        player,
        resolveObstaclesAndBounds
      );
    }

    if (!boss.soulsHit1Done && t >= boss.soulsImpactAt) {
      boss.soulsHit1Done = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
      const reach = 4.35;
      const impX = boss.x + boss.soulsStrikeDirX * 2.0;
      const impZ = boss.z + boss.soulsStrikeDirZ * 2.0;
      playBossWhooshSfx(audio, true);
      playBossHammerGroundSfx(audio);
      world?.addScreenShake?.(0.32, 0.18);
      emitSlashArc(boss.x, boss.z, sAng, reach, Math.PI * 0.72, 0xf97316, { duration: 0.24, y: 1.35 });
      emitShockwave(impX, impZ, 2.75, 0xd6d3d1, 0.28);
      emitParticles(impX, 0.35, impZ, 0xf97316, 14, 5.4, 0.14);
      emitParticles(impX, 0.20, impZ, 0xd6d3d1, 10, 4.2, 0.13);

      const pDx = player.x - boss.x;
      const pDz = player.z - boss.z;
      const pDist = Math.hypot(pDx, pDz);
      const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));
      if (pDist <= reach + player.radius * 0.5 && (relA <= Math.PI * 0.42 || pDist <= 2.35)) {
        const dmg = boss.soulsQuickTurn ? Math.round(boss.damage * 0.90) : boss.damage;
        playBossHammerHitSfx(audio);
        applyDamageToPlayer(dmg, boss, strikeHitPayload(boss.currentAttackMeta));
      }
    }

    // Elden Ring Anti-Greed & Dynamic Combo Branching: Heavy_Cleave is NOT punishable.
    const pOH = SOULS_BOSS_PUNISH_PROFILES.overhead_cleave;
    if (
      boss.soulsHit1Done &&
      boss.soulsState === 'overhead_cleave' &&
      (boss.soulsChainCount || 0) < maxChainLinks &&
      t >= boss.soulsImpactAt + pOH.antiGreedDelay
    ) {
      let wantBranch = false;
      const greedyHitAfterImpact =
        sinceLastHit >= 0 &&
        sinceLastHit <= pOH.recentHitSec &&
        lastHitAt !== boss.soulsAntiGreedHitRolledAt;
      if (greedyHitAfterImpact && dist <= pOH.antiGreedRange) {
        boss.soulsAntiGreedHitRolledAt = lastHitAt;
        wantBranch = Math.random() < pOH.recentHitChance;
      }
      if (!wantBranch && !boss.soulsAntiGreedHugRolled) {
        boss.soulsAntiGreedHugRolled = true;
        if (relAngFromFront > SOULS_BOSS_GOAL_CFG.behindAngleRad && dist <= 5.4) {
          wantBranch = Math.random() < (phase2 ? 0.85 : 0.70);
        } else if (dist > SOULS_BOSS_GOAL_CFG.farBranchDist && dist <= maxLeapRange && cd.leap_slam <= 0) {
          wantBranch = Math.random() < (phase2 ? 0.72 : 0.50);
        } else if (dist <= pOH.hugRange) {
          wantBranch = Math.random() < (phase2 ? pOH.hugChanceP2 : pOH.hugChanceP1);
        } else if (dist <= 7.2 && phase2) {
          wantBranch = Math.random() < 0.42;
        }
      }
      if (wantBranch && tryComboBranch('overhead_cleave')) {
        return { isMoving: false };
      }
    }

    if (t >= boss.soulsAttackDur) {
      enterRecover(phase2 ? pOH.recoverP2 : pOH.recoverP1, null);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // E. ATTACK 2 — SWEEP COMBO (`Sweep_Combo`, 2 parryable hits w/ 68% tracking cutoff)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'sweep_combo') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Sweep_Combo;
    const prevT = boss.soulsAttackElapsed;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * cfg.speed;
    const clipT = t * cfg.speed;
    const hit1TrackEnd = cfg.hit1At * cfg.trackingCutoff01;
    const hit2TrackEnd = cfg.hit1At + (cfg.hit2At - cfg.hit1At) * cfg.trackingCutoff01;

    // Fair 68% tracking cutoff before each locked sweep strike
    if (!boss.soulsHit1Done && clipT < hit1TrackEnd) {
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && clipT < hit2TrackEnd) {
      // Roll-catch pivot during backswing pause, then hard-locked for final 32%
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    // Hit 1: forward step-lunge (+2.0m @ 1.30..2.02s) + subtle right-side swing arc drift (+0.42m)
    const sweepFwd1 = sampleWindowStep(prevClipT, clipT, 1.30, 2.02, 2.0, easeAttackDrive);
    const sweepArc1 = sampleWindowStep(prevClipT, clipT, 1.38, 2.02, 0.42, easeOutQuad);
    if (sweepFwd1 > 0 || sweepArc1 > 0) {
      const perpX = boss.soulsStrikeDirZ;
      const perpZ = -boss.soulsStrikeDirX;
      const moveX = boss.soulsStrikeDirX * sweepFwd1 + perpX * sweepArc1;
      const moveZ = boss.soulsStrikeDirZ * sweepFwd1 + perpZ * sweepArc1;
      const moveMag = Math.hypot(moveX, moveZ);
      if (moveMag > 1e-5) {
        advanceBossWithCollision(boss, moveX, moveZ, moveMag, player, resolveObstaclesAndBounds);
      }
    }

    // Hit 2: powerful forward surge (+2.6m @ 2.50..3.00s) + inertia slide (+0.55m @ 3.00..3.35s)
    const sweepStep2 =
      sampleWindowStep(prevClipT, clipT, 2.50, 3.00, 2.6, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 3.00, 3.35, 0.55, easeOutQuad);
    if (sweepStep2 > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        sweepStep2,
        player,
        resolveObstaclesAndBounds
      );
    }

    if (!boss.soulsHit1Done) {
      if (t >= boss.soulsHit1At) {
        boss.soulsHit1Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach1 = 4.4;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.24, 0.14);
        emitSlashArc(boss.x, boss.z, sAng, reach1, Math.PI * 1.04, 0xef4444, { duration: 0.24, y: 1.35, sweepRad: 0.55 });
        emitParticles(boss.x + boss.soulsStrikeDirX * 2.2, 1.25, boss.z + boss.soulsStrikeDirZ * 2.2, 0xf97316, 10, 5.0, 0.13);

        const pDx = player.x - boss.x;
        const pDz = player.z - boss.z;
        const pDist = Math.hypot(pDx, pDz);
        const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));
        if (pDist <= reach1 + player.radius * 0.5 && (relA <= Math.PI * 0.54 || pDist <= 2.35)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 0.92), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.sweep_combo_1));
        }

        // Advance active attack metadata to Hit 2 (pure 3D animation read — zero floor circles!)
        if (boss.soulsState === 'sweep_combo' && boss.stunTimer <= 0) {
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.sweep_combo_2;
        }
      }
    } else if (!boss.soulsHit2Done) {
      if (t >= boss.soulsHit2At) {
        boss.soulsHit2Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach2 = 4.55;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.34, 0.18);
        emitSlashArc(boss.x, boss.z, sAng, reach2, Math.PI * 1.12, 0xf97316, { duration: 0.25, y: 1.40, sweepRad: -0.60 });
        emitParticles(boss.x + boss.soulsStrikeDirX * 2.3, 1.30, boss.z + boss.soulsStrikeDirZ * 2.3, 0xfbbf24, 14, 5.8, 0.14);

        const pDx = player.x - boss.x;
        const pDz = player.z - boss.z;
        const pDist = Math.hypot(pDx, pDz);
        const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));
        if (pDist <= reach2 + player.radius * 0.5 && (relA <= Math.PI * 0.58 || pDist <= 2.4)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 1.12), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.sweep_combo_2));
        }
      }
    }

    // After Hit 2: Dynamic Combo Branching based on live angle & distance (behind/mid/far)
    const pSW = SOULS_BOSS_PUNISH_PROFILES.sweep_combo;
    if (
      boss.soulsHit2Done &&
      !boss.soulsSweepChainRolled &&
      boss.soulsState === 'sweep_combo' &&
      (boss.soulsChainCount || 0) < maxChainLinks &&
      t >= boss.soulsHit2At + 0.18
    ) {
      boss.soulsSweepChainRolled = true;
      const behindFlank = relAngFromFront > SOULS_BOSS_GOAL_CFG.behindAngleRad && dist <= 5.4;
      const retreatedFar = dist > SOULS_BOSS_GOAL_CFG.farBranchDist && dist <= maxLeapRange && cd.leap_slam <= 0;
      const closeFront = phase2 && dist <= pSW.chainRange && relAngFromFront <= 1.10;
      const greedyBetweenHits =
        sinceLastHit >= 0 && sinceLastHit <= pSW.greedSec + Math.max(0, t - boss.soulsHit1At);
      const greedyRecent = sinceLastHit >= 0 && sinceLastHit <= pSW.greedSec;
      const shouldRoll =
        (behindFlank && Math.random() < (phase2 ? 0.72 : 0.50)) ||
        (retreatedFar && Math.random() < (phase2 ? 0.70 : 0.45)) ||
        ((closeFront || (phase2 && greedyBetweenHits && dist <= 5.6)) &&
          Math.random() < (greedyRecent ? pSW.greedChance : pSW.baseChance));
      if (shouldRoll && tryComboBranch('sweep_combo')) {
        return { isMoving: false };
      }
    }

    if (t >= boss.soulsAttackDur) {
      enterRecover(phase2 ? pSW.recoverP2 : pSW.recoverP1, pSW.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // F. ATTACK 3 — DELAYED CRUSH (`Delayed_Crush`, 3-hit combo w/ 68-70% tracking cutoff)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'delayed_crush') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Delayed_Crush;
    const prevT = boss.soulsAttackElapsed;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * cfg.speed;
    const clipT = t * cfg.speed;
    const hit1TrackEnd = cfg.hit1At * cfg.trackingCutoff01;
    const hit2TrackEnd = cfg.hit1At + (cfg.hit2At - cfg.hit1At) * cfg.trackingCutoff01;
    const hit3TrackEnd = cfg.hit2At + (cfg.impactAt - cfg.hit2At) * 0.70;

    // Fair 68-70% tracking cutoff before each strike locks hard
    if (!boss.soulsHit1Done && clipT < hit1TrackEnd) {
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && clipT < hit2TrackEnd) {
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit2Done && !boss.soulsHit3Done && clipT < hit3TrackEnd) {
      stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    // 3-stage relentless forward drive: Hit 1 (+1.6m), Hit 2 (+2.1m), Hit 3 crushing surge (+2.8m)
    const crushStep =
      sampleWindowStep(prevClipT, clipT, 0.62, 1.05, 1.6, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 1.25, 1.66, 2.1, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 2.10, 2.72, 2.8, easeAttackDrive);
    if (crushStep > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        crushStep,
        player,
        resolveObstaclesAndBounds
      );
    }

    if (!boss.soulsHit1Done) {
      if (t >= boss.soulsHit1At) {
        boss.soulsHit1Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach1 = 4.25;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.22, 0.12);
        emitSlashArc(boss.x, boss.z, sAng, reach1, Math.PI * 0.95, 0xf59e0b, { duration: 0.22, y: 1.25, sweepRad: 0.52 });
        const pDx = player.x - boss.x;
        const pDz = player.z - boss.z;
        const pDist = Math.hypot(pDx, pDz);
        const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));
        if (pDist <= reach1 + player.radius * 0.5 && (relA <= Math.PI * 0.50 || pDist <= 2.3)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 0.85), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_1));
        }
        if (boss.soulsState === 'delayed_crush' && boss.stunTimer <= 0) {
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_2;
        }
      }
    } else if (!boss.soulsHit2Done) {
      if (t >= boss.soulsHit2At) {
        boss.soulsHit2Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach2 = 4.4;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.26, 0.14);
        emitSlashArc(boss.x, boss.z, sAng, reach2, Math.PI * 1.05, 0xf97316, { duration: 0.24, y: 1.35, sweepRad: -0.58 });
        const pDx = player.x - boss.x;
        const pDz = player.z - boss.z;
        const pDist = Math.hypot(pDx, pDz);
        const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sAng));
        if (pDist <= reach2 + player.radius * 0.5 && (relA <= Math.PI * 0.54 || pDist <= 2.35)) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 0.95), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_2));
        }
        if (boss.soulsState === 'delayed_crush' && boss.stunTimer <= 0) {
          boss.soulsTelegraph3Done = true;
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_3;
        }
      }
    } else if (!boss.soulsHit3Done) {
      if (Math.random() < dt * 16) {
        emitParticles(
          boss.x + boss.soulsStrikeDirX * 0.5 + (Math.random() - 0.5) * 0.9,
          3.45,
          boss.z + boss.soulsStrikeDirZ * 0.5 + (Math.random() - 0.5) * 0.9,
          0xfbbf24,
          2,
          3.6,
          0.14
        );
      }
      if (t >= boss.soulsImpactAt) {
        boss.soulsHit3Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const impX = boss.x + boss.soulsStrikeDirX * 2.15;
        const impZ = boss.z + boss.soulsStrikeDirZ * 2.15;
        const slamR = 4.25;
        playBossHammerGroundSfx(audio);
        world?.addScreenShake?.(0.50, 0.28);
        emitShockwave(impX, impZ, slamR * 0.85, 0xd6d3d1, 0.36);
        emitShockwave(impX, impZ, slamR * 0.55, 0xfbbf24, 0.28);
        emitParticles(impX, 0.45, impZ, 0xf97316, 26, 7.6, 0.16);
        emitParticles(impX, 0.25, impZ, 0xd6d3d1, 18, 5.4, 0.14);

        if (Math.hypot(player.x - impX, player.z - impZ) <= slamR + player.radius * 0.55) {
          playBossHammerHitSfx(audio);
          applyDamageToPlayer(Math.round(boss.damage * 1.35), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_3));
        }
      }
    }

    if (t >= boss.soulsAttackDur) {
      const pDC = SOULS_BOSS_PUNISH_PROFILES.delayed_crush;
      enterRecover(phase2 ? pDC.recoverP2 : pDC.recoverP1, pDC.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // G. ATTACK 4 — LEAP SLAM (`Leap_Slam`, gap-closer & Estus punish, 65% tracking cutoff)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'leap_slam') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Leap_Slam;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;

    const flightStart = boss.soulsFlightStartAt ?? boss.soulsTakeoffAt;
    const trackEnd = flightStart * cfg.trackingCutoff01;
    // Fire heavy leap whoosh/roar strictly on the physical takeoff frame (`takeoffAt`)
    if (!boss.soulsLeapSfxPlayed && t >= (boss.soulsTakeoffAt || 0)) {
      boss.soulsLeapSfxPlayed = true;
      playBossLeapSfx(audio);
    }
    if (t < flightStart) {
      // Fair 65% crouch tracking cutoff, then hard-locked landing trajectory
      if (t < trackEnd) {
        stepBossTurn(boss, Math.atan2(boss.leapEndX - boss.x, boss.leapEndZ - boss.z), SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      }
    } else if (t <= boss.soulsLandMoveEndAt) {
      // Pillar-safe airborne horizontal flight synced strictly to Leap_Slam flight window (flightStartAt..landMoveEndAt)
      const u = clamp((t - flightStart) / Math.max(0.05, boss.soulsLandMoveEndAt - flightStart), 0, 1);
      const ease = u * u * (3 - 2 * u);
      const candX = boss.leapStartX + (boss.leapEndX - boss.leapStartX) * ease;
      const candZ = boss.leapStartZ + (boss.leapEndZ - boss.leapStartZ) * ease;
      const safeAir = resolveObstaclesAndBounds
        ? resolveObstaclesAndBounds(candX, candZ, boss.radius, ARENA_ENTITY_LIMIT)
        : clampBossToSoulsHallFallback(candX, candZ, boss.radius);
      boss.x = safeAir.x;
      boss.z = safeAir.z;
      stepBossTurn(boss, Math.atan2(boss.leapEndX - boss.leapStartX, boss.leapEndZ - boss.leapStartZ), 6.5, dt);
    }

    if (!boss.soulsHit1Done && t >= boss.soulsImpactAt) {
      boss.soulsHit1Done = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      // Zero teleport snap: settle smoothly at resolved landing coordinates!
      const slamR = 3.9;
      playBossHammerGroundSfx(audio);
      world?.addScreenShake?.(0.52, 0.28);
      emitShockwave(boss.x, boss.z, slamR * 0.85, 0xd6d3d1, 0.36);
      emitShockwave(boss.x, boss.z, slamR * 0.55, 0xf97316, 0.28);
      emitParticles(boss.x, 0.45, boss.z, 0xf97316, 26, 7.8, 0.17);
      emitParticles(boss.x, 0.25, boss.z, 0xd6d3d1, 16, 5.4, 0.14);

      if (Math.hypot(player.x - boss.x, player.z - boss.z) <= slamR + player.radius * 0.55) {
        playBossHammerHitSfx(audio);
        applyDamageToPlayer(Math.round(boss.damage * 1.28), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.leap_slam));
      }
    }

    if (t >= boss.soulsAttackDur) {
      const pLS = SOULS_BOSS_PUNISH_PROFILES.leap_slam;
      enterRecover(phase2 ? pLS.recoverP2 : pLS.recoverP1, pLS.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // H. ATTACK 5 — WHIRL SPIN (`Whirl_Spin`, heavy cyclone spin & ground slam finish)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'whirl_windup') {
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    boss.model?.handle?.setClipOverride?.('Whirl_Spin', 0.55);
    stepBossTurn(boss, angToPlayer, 3.6, dt);
    if (Math.random() < dt * 20) {
      emitParticles(boss.x, 1.35, boss.z, 0xf59e0b, 2, 3.8, 0.14);
    }
    if (boss.soulsTimer <= 0) {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Whirl_Spin;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const spinDur = phase2 ? cfg.p2SpinSec : cfg.p1SpinSec;
      boss.soulsState = 'whirl_spin';
      boss.soulsTimer = spinDur;
      // Weighty cyclone carry rotation synchronized with reworked Whirl_Spin clip (no goofy 10 rad/s spin!)
      boss.soulsSpinAngVel = phase2 ? 5.6 : 4.6;
      boss.spinHitTimer = 0;
      boss.spinVfxTimer = 0;
      playBossWhooshSfx(audio, true);
      audio?.playBossFootstep?.();
      emitShockwave(boss.x, boss.z, 4.3, 0xf59e0b, 0.34);
    }
    return { isMoving: false };
  }

  if (boss.soulsState === 'whirl_spin') {
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    boss.spinHitTimer = Math.max(0, (boss.spinHitTimer || 0) - dt);
    boss.spinVfxTimer = Math.max(0, (boss.spinVfxTimer || 0) - dt);
    boss.model?.handle?.setClipOverride?.('Whirl_Spin', phase2 ? 1.22 : 1.05);

    boss.facing += dt * (boss.soulsSpinAngVel || (phase2 ? 5.6 : 4.6));
    const driftSpeed = moveSpeed * (phase2 ? 0.56 : 0.34);
    if (dist > 2.2) {
      advanceBossWithCollision(boss, dx, dz, driftSpeed * dt, player, resolveObstaclesAndBounds);
    }

    if (boss.spinVfxTimer <= 0) {
      boss.spinVfxTimer = 0.26;
      playBossWhooshSfx(audio, false);
      emitSlashArc(boss.x, boss.z, boss.facing, 4.3, Math.PI * 1.45, 0xf97316, { duration: 0.20, y: 1.35 });
      emitParticles(boss.x, 1.0, boss.z, 0xfbbf24, 6, 5.0, 0.13);
    }

    if (dist <= 4.3 + player.radius * 0.45 && boss.spinHitTimer <= 0) {
      boss.spinHitTimer = 0.48;
      world?.addScreenShake?.(0.32, 0.16);
      playBossHammerHitSfx(audio);
      applyDamageToPlayer(Math.round(boss.damage * 0.92), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.whirl_spin));
    }

    if (boss.soulsTimer <= 0) {
      playBossHammerGroundSfx(audio);
      emitShockwave(boss.x, boss.z, 3.8, 0xd97706, 0.32);
      const pWS = SOULS_BOSS_PUNISH_PROFILES.whirl_spin;
      enterRecover(phase2 ? pWS.recoverP2 : pWS.recoverP1, pWS.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // I. RECOVER (Fair Dark Souls Punish Window: Hyper-Armor OFF)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'recover') {
    clearWalkOverride();
    boss.soulsActiveAttack = null;
    boss.currentAttackMeta = null;
    boss.soulsGoal = 'recover';
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    if ((boss.soulsPunishTimer || 0) > 0) {
      boss.soulsPunishTimer = Math.max(0, boss.soulsPunishTimer - dt);
    }
    stepBossTurn(boss, angToPlayer, 2.2, dt);

    // Heavy punish window: warm golden exhale sparks so the player reads "OPEN!"
    if (boss.soulsPunishWindow === 'heavy' && Math.random() < dt * 10) {
      emitParticles(
        boss.x + (Math.random() - 0.5) * 1.3,
        1.2 + Math.random() * 1.6,
        boss.z + (Math.random() - 0.5) * 1.3,
        Math.random() < 0.6 ? 0xfde047 : 0xfbbf24,
        1,
        2.2,
        0.13
      );
    }

    if (boss.soulsTimer <= 0) {
      clearSoulsBossPunishWindow(boss);
      boss._soulsRecoverHeftPlaying = false;
      if (phase2 && !boss._soulsPhase2Done) {
        triggerPhase2Roar();
        return { isMoving: false };
      }
      // Animation-State Reading immediately post-recover: punish greedy mid-fight heal!
      if (tryFlaskPunish()) {
        return { isMoving: false };
      }
      boss.soulsState = 'stalk';
      boss.soulsChainCount = 0;
      // Immediate purposeful stalking pressure right out of Recover_Heft (zero empty standing pause!)
      boss.soulsTimer = boss.phase2Enraged ? 0.26 + Math.random() * 0.24 : 0.40 + Math.random() * 0.32;
      if ((boss.soulsStrafeTimer || 0) <= 0.4) {
        if (Math.random() < 0.45) boss.strafeDir = -boss.strafeDir;
        boss.soulsStrafeTimer = 2.4 + Math.random() * 0.8;
      }
      if (dist < SOULS_BOSS_GOAL_CFG.closeBackstepDist || (boss.soulsCloseExchangeTimer || 0) >= 1.45) {
        boss.soulsRhythmMode = 'tactical_backstep';
        boss.soulsRhythmTimer = 0.62 + Math.random() * 0.25;
        boss.soulsCloseExchangeTimer = 0;
        boss.soulsGoal = 'tactical_backstep';
      } else if (dist > SOULS_BOSS_GOAL_CFG.neutralMaxDist) {
        boss.soulsRhythmMode = 'stalk_advance';
        boss.soulsRhythmTimer = 1.6 + Math.random() * 0.8;
        boss.soulsGoal = 'stalk_advance';
      } else {
        boss.soulsRhythmMode = 'circle_strafe';
        boss.soulsRhythmTimer = 2.4 + Math.random() * 0.8;
        boss.soulsGoal = 'circle_strafe';
      }
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // J. GOAL STACK NEUTRAL — SMOOTH 4-WAY LOCOMOTION, OBSTACLE STEERING & PRESSURE
  // ------------------------------------------------------------------------
  if (phase2 && !boss._soulsPhase2Done) {
    triggerPhase2Roar();
    return { isMoving: false };
  }

  boss.soulsActiveAttack = null;
  boss.currentAttackMeta = null;
  boss.soulsChainCount = 0;
  if (boss.soulsPunishWindow) clearSoulsBossPunishWindow(boss);
  // Ensure `setClipOverride` stays 100% clear in neutral so `models.js` 4-way locomotion runs conflict-free!
  if (boss._soulsWalkOverrideActive) {
    boss._soulsWalkOverrideActive = false;
  }
  boss.model?.handle?.setClipOverride?.(null);
  boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
  // Heavy, commanding neutral turn inertia (3.2 rad/s — zero jitter!)
  stepBossTurn(boss, angToPlayer, SOULS_BOSS_GOAL_CFG.turnRateStalkRad, dt);

  // Track anti-backstab timer when player hugs flank or circles behind boss
  if (dist <= 4.8 && relAngFromFront > 1.30) {
    boss.soulsBehindTimer = (boss.soulsBehindTimer || 0) + dt;
  } else {
    boss.soulsBehindTimer = Math.max(0, (boss.soulsBehindTimer || 0) - dt * 1.4);
  }

  // Goal Priority 1: Animation-State Reading (Flask Punish w/ LOS & >=4.5s cooldown)
  if (tryFlaskPunish()) {
    return { isMoving: false };
  }

  // Goal Priority 2: Smart Shield-Hold Counter (player holds block >= 1.5s up close)
  if (
    (boss.soulsPlayerBlockTimer || 0) >= SOULS_BOSS_GOAL_CFG.shieldBreakHoldSec &&
    dist <= 5.8 &&
    boss.soulsTimer <= 0.35
  ) {
    boss.soulsPlayerBlockTimer = 0;
    const prevMove = boss.lastTwoMoves[boss.lastTwoMoves.length - 1];
    if (cd.delayed_crush <= 0 && prevMove !== 'delayed_crush') {
      launchAttack('delayed_crush', { goalTag: 'guard_break_punish' });
    } else if (prevMove !== 'overhead_cleave') {
      launchAttack('overhead_cleave', { goalTag: 'guard_break_punish' });
    } else if (cd.delayed_crush <= 0) {
      launchAttack('delayed_crush', { goalTag: 'guard_break_punish' });
    } else {
      launchAttack('sweep_combo', { goalTag: 'guard_break_punish' });
    }
    return { isMoving: false };
  }

  // Goal Priority 2b: Panic Roll-Spam Punish (>=2 player rolls in 3.2s -> delayed roll-catch!)
  if (
    recentRolls >= 2 &&
    (boss.soulsRollPunishCd || 0) <= 0 &&
    dist <= 6.8 &&
    boss.soulsTimer <= 0.28
  ) {
    boss.soulsRollPunishCd = 4.0;
    boss._soulsRollTimes.length = 0;
    if (cd.delayed_crush <= 0) {
      launchAttack('delayed_crush', { goalTag: 'roll_catch_punish', silentText: true });
    } else if (cd.aaa_combo <= 0 && bossHasClip(boss, 'Combo_Sweep_1')) {
      launchAttack('aaa_combo', { goalTag: 'roll_catch_punish', silentText: true });
    } else {
      launchAttack('sweep_combo', { goalTag: 'roll_catch_punish' });
    }
    return { isMoving: false };
  }

  // Goal Priority 3: Smooth, Deliberate Pressure (no direction flip faster than 2.4–3.2s, zero standing stalls!)
  boss.soulsStrafeTimer = (boss.soulsStrafeTimer || 0) - dt;
  if (boss.soulsStrafeTimer <= 0) {
    boss.strafeDir = -boss.strafeDir;
    boss.soulsStrafeTimer = 2.4 + Math.random() * 0.8;
  }

  const goalCfg = SOULS_BOSS_GOAL_CFG;
  if (
    boss.soulsRhythmMode !== 'tactical_backstep' &&
    (dist < goalCfg.closeBackstepDist || (boss.soulsCloseExchangeTimer || 0) >= 1.65)
  ) {
    boss.soulsRhythmMode = 'tactical_backstep';
    boss.soulsRhythmTimer = 0.62 + Math.random() * 0.25;
    boss.soulsCloseExchangeTimer = 0;
  } else if (boss.soulsRhythmMode === 'tactical_backstep') {
    boss.soulsRhythmTimer = (boss.soulsRhythmTimer || 0) - dt;
    if (boss.soulsRhythmTimer <= 0 || dist >= 3.9) {
      boss.soulsRhythmMode = dist > goalCfg.neutralMaxDist ? 'stalk_advance' : 'circle_strafe';
      boss.soulsRhythmTimer = 2.4 + Math.random() * 0.8;
    }
  } else {
    // Hysteresis between `stalk_advance` (> 4.8m) and `circle_strafe` ([3.0, 4.8m]) so goals never chatter!
    if (dist > goalCfg.neutralMaxDist + 0.25) {
      boss.soulsRhythmMode = 'stalk_advance';
    } else if (dist < goalCfg.neutralMaxDist - 0.35 && boss.soulsTimer > 0.22) {
      boss.soulsRhythmMode = 'circle_strafe';
    }
  }

  const radX = dx / dist;
  const radZ = dz / dist;
  const tanX = -radZ * boss.strafeDir;
  const tanZ = radX * boss.strafeDir;

  let moveX = 0;
  let moveZ = 0;
  let desiredSpeed = 0;

  if (boss.soulsRhythmMode === 'tactical_backstep' && dist < 4.2) {
    // Smooth diagonal backstep to clear nose-to-nose crowding
    boss.soulsGoal = 'tactical_backstep';
    moveX = -radX * 0.78 + tanX * 0.62;
    moveZ = -radZ * 0.78 + tanZ * 0.62;
    desiredSpeed = moveSpeed * (boss.phase2Enraged ? 0.82 : 0.74);
  } else if (boss.soulsRhythmMode === 'stalk_advance' || dist > goalCfg.neutralMaxDist || boss.soulsTimer <= 0.18) {
    // Smooth predatory stalk forward (`stalk_advance` when dist > 4.8m or closing for an imminent swing!)
    boss.soulsGoal = 'stalk_advance';
    const radialPull = dist > 3.1 ? 0.94 : 0.42;
    moveX = radX * radialPull + tanX * 0.24;
    moveZ = radZ * radialPull + tanZ * 0.24;
    desiredSpeed = moveSpeed * (boss.phase2Enraged ? 1.02 : 0.90);
  } else {
    // Continuous predatory arc circle (`circle_strafe` in [3.0, 4.8m]) — NEVER freezes at neutralMinDist!
    boss.soulsGoal = 'circle_strafe';
    const radialCorr = clamp((dist - 3.85) * 0.28, -0.26, 0.32);
    moveX = radX * radialCorr + tanX * 0.94;
    moveZ = radZ * radialCorr + tanZ * 0.94;
    desiredSpeed = moveSpeed * (boss.phase2Enraged ? 0.80 : 0.70);
  }

  let isMoving = false;
  let actualSpeed = 0;
  let actualVx = 0;
  let actualVz = 0;
  let steerDirX = 0;
  let steerDirZ = 0;
  const prevBossX = boss.x;
  const prevBossZ = boss.z;
  const rawMoveLen = Math.hypot(moveX, moveZ);
  if (desiredSpeed > 0.05 && rawMoveLen > 1e-4) {
    // Apply obstacle steering around columns, braziers & lanterns so boss never headbutts walls
    const steered = computeBossObstacleSteering(
      boss,
      moveX / rawMoveLen,
      moveZ / rawMoveLen,
      world,
      ctx.obstacles
    );
    steerDirX = steered.x;
    steerDirZ = steered.z;
    const desiredStep = desiredSpeed * dt;
    let moved = advanceBossWithCollision(
      boss,
      steered.x,
      steered.z,
      desiredStep,
      player,
      resolveObstaclesAndBounds
    );
    // Wall-slide fallback: if curved arena wall blocked forward step, flip strafe arc cleanly
    if (moved < desiredStep * 0.25 && desiredStep > 0.005) {
      boss.strafeDir = -boss.strafeDir;
      boss.soulsStrafeTimer = 2.4 + Math.random() * 0.8;
      const altTanX = -radZ * boss.strafeDir;
      const altTanZ = radX * boss.strafeDir;
      const altSteer = computeBossObstacleSteering(boss, altTanX, altTanZ, world, ctx.obstacles);
      steerDirX = altSteer.x;
      steerDirZ = altSteer.z;
      moved += advanceBossWithCollision(
        boss,
        altSteer.x,
        altSteer.z,
        desiredStep * 0.75,
        player,
        resolveObstaclesAndBounds
      );
    }
    const safeDt = Math.max(dt, 0.001);
    actualSpeed = moved / safeDt;
    actualVx = (boss.x - prevBossX) / safeDt;
    actualVz = (boss.z - prevBossZ) / safeDt;
  }

  // Frame-rate invariant exponential velocity smoothing (`1 - exp(-10*dt)`) — NEVER zeroed inside `stalk`!
  const prevSmoothSpd = Number.isFinite(boss._soulsSmoothSpeed) ? boss._soulsSmoothSpeed : 0;
  const smoothAlpha = 1 - Math.exp(-10.0 * Math.max(0, dt));
  boss._soulsSmoothSpeed = prevSmoothSpd + (actualSpeed - prevSmoothSpd) * smoothAlpha;
  boss._soulsSmoothVx = (boss._soulsSmoothVx || 0) + (actualVx - (boss._soulsSmoothVx || 0)) * smoothAlpha;
  boss._soulsSmoothVz = (boss._soulsSmoothVz || 0) + (actualVz - (boss._soulsSmoothVz || 0)) * smoothAlpha;
  const walkSpeedRatio = clamp(boss._soulsSmoothSpeed / goalCfg.nominalWalkSpeed, 0.45, 1.32);
  const wasMoving = Boolean(boss._soulsPrevMoving);
  isMoving = wasMoving ? boss._soulsSmoothSpeed > 0.22 : boss._soulsSmoothSpeed > 0.34;
  boss._soulsPrevMoving = isMoving;

  let strafeAnimMode = 'idle';
  let locoClip = 'Idle';

  if (isMoving) {
    // Character-local +X is Left, +Z is Forward when rotation.y === boss.facing
    const cosF = Math.cos(boss.facing);
    const sinF = Math.sin(boss.facing);
    const leftDot = steerDirX * cosF - steerDirZ * sinF;
    const fwdDot = steerDirX * sinF + steerDirZ * cosF;
    const absLeftDot = Math.abs(leftDot);

    let activeStrafe = boss._soulsActiveStrafeClip || null;
    if (fwdDot < -0.52) {
      activeStrafe = 'backstep';
    } else if (activeStrafe && activeStrafe !== 'backstep') {
      if (absLeftDot < 0.42) {
        activeStrafe = null;
      } else if (leftDot > 0.58 && activeStrafe !== 'strafe_left') {
        activeStrafe = 'strafe_left';
      } else if (leftDot < -0.58 && activeStrafe !== 'strafe_right') {
        activeStrafe = 'strafe_right';
      }
    } else if (absLeftDot > 0.58) {
      activeStrafe = leftDot > 0 ? 'strafe_left' : 'strafe_right';
    } else {
      activeStrafe = null;
    }
    boss._soulsActiveStrafeClip = activeStrafe;
    strafeAnimMode = activeStrafe || 'combat_walk';
    locoClip =
      strafeAnimMode === 'strafe_left'
        ? 'Strafe_Left'
        : strafeAnimMode === 'strafe_right'
          ? 'Strafe_Right'
          : strafeAnimMode === 'backstep'
            ? (bossHasClip(boss, 'Walk_Backward') ? 'Walk_Backward' : 'Walking')
            : 'Walking';

    // Drive native 4-way locomotion in `models.js` with `setClipOverride` cleanly NULL!
    boss.model?.handle?.setLocomotionState?.({
      strafeAnimMode,
      vx: boss._soulsSmoothVx,
      vz: boss._soulsSmoothVz,
      isMoving: true,
      speedMult: walkSpeedRatio,
      actualSpeed: boss._soulsSmoothSpeed
    });
    if (boss._soulsFootstepTimer <= 0) {
      boss._soulsFootstepTimer = clamp(0.56 / Math.max(0.55, walkSpeedRatio), 0.36, 0.85);
      audio?.playBossFootstep?.();
    }
  } else {
    boss.model?.handle?.setLocomotionState?.({
      strafeAnimMode: 'idle',
      vx: 0,
      vz: 0,
      isMoving: false,
      speedMult: 0,
      actualSpeed: 0
    });
  }

  // Goal Priority 4: Varied Tactical Move Selection w/ `lastTwoMoves` anti-repeat
  if (boss.soulsTimer <= 0) {
    const prevMove1 = boss.lastTwoMoves[boss.lastTwoMoves.length - 1] || null;
    const prevMove2 = boss.lastTwoMoves.length >= 2 ? boss.lastTwoMoves[0] : null;

    // 1. Far gap-closer (> 6.4m) with clear LOS -> Leap Slam!
    if (
      dist > 6.4 &&
      dist <= maxLeapRange &&
      cd.leap_slam <= 0 &&
      prevMove1 !== 'leap_slam' &&
      hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)
    ) {
      launchAttack('leap_slam');
      return { isMoving: false };
    }

    // 2. Anti-backstab / flank read -> Whirl Spin or fast turnaround Heavy_Cleave
    if (dist <= 5.0 && relAngFromFront > goalCfg.behindAngleRad) {
      if (
        cd.whirl_spin <= 0 &&
        prevMove1 !== 'whirl_spin' &&
        ((boss.soulsBehindTimer || 0) >= 0.80 || (dist <= 3.8 && relAngFromFront > 1.72))
      ) {
        launchAttack('whirl_spin');
        return { isMoving: false };
      }
      if (prevMove1 !== 'overhead_cleave') {
        launchAttack('overhead_cleave', { quickTurnaround: true });
        return { isMoving: false };
      }
    }

    // 3. Tactical Close / Mid-Range Selection (dist <= 6.2m) — zero consecutive repeats!
    if (dist <= 6.2) {
      const rawPool = [];
      if (dist <= 5.0) rawPool.push({ id: 'overhead_cleave', weight: 28 });
      if (dist <= 5.8 && cd.aaa_combo <= 0 && bossHasClip(boss, 'Combo_Sweep_1')) {
        rawPool.push({ id: 'aaa_combo', weight: 38 });
      }
      if (dist <= 5.6 && cd.sweep_combo <= 0) rawPool.push({ id: 'sweep_combo', weight: 28 });
      if (dist <= 6.2 && cd.delayed_crush <= 0) rawPool.push({ id: 'delayed_crush', weight: dist > 4.2 ? 38 : 26 });
      if (boss.phase2Enraged && dist <= 4.6 && cd.whirl_spin <= 0) rawPool.push({ id: 'whirl_spin', weight: 24 });

      let filtered = rawPool.filter((c) => c.id !== prevMove1);
      if (filtered.length === 0) {
        filtered = rawPool.length > 0 ? rawPool : [{ id: 'overhead_cleave', weight: 1 }];
      }

      const candidates = filtered.map((c) => ({
        id: c.id,
        weight: c.weight * (c.id === prevMove2 ? 0.40 : 1.0)
      }));

      let total = 0;
      for (let i = 0; i < candidates.length; i++) total += candidates[i].weight;
      let roll = Math.random() * total;
      let picked = candidates[candidates.length - 1].id;
      for (let i = 0; i < candidates.length; i++) {
        roll -= candidates[i].weight;
        if (roll <= 0) {
          picked = candidates[i].id;
          break;
        }
      }
      launchAttack(picked);
      return { isMoving: false };
    }
  }

  return {
    isMoving,
    moveSpeedRatio: walkSpeedRatio,
    actualSpeed: boss._soulsSmoothSpeed,
    locoClip,
    strafeAnimMode
  };
}
