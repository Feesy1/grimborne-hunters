// 5 Distinct Act Boss State Machines (Full Bosses, Co-Bosses, Mini-Bosses & Endless Bosses).
// Extracted from js/combat.js (Stage 4 Wave 2 modular split).
import {
  TWO_PI,
  ARENA_ENTITY_LIMIT,
  MAX_ACTIVE_ENEMIES,
  clamp,
  normalizeAngle,
  lerpAngle
} from './bridge.js?v=20261124z95';
import { SOULS_CASTLE_CONSTANTS } from '../souls/soulsCastleLayout.js?v=20261124z95';

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
  Heavy_Cleave: Object.freeze({ duration: 3.200, endAt: 1.78, impactAt: 1.017, speed: 1.14, trackingCutoff01: 0.85 }),
  Sweep_Combo: Object.freeze({ duration: 4.667, endAt: 3.65, hit1At: 2.050, hit2At: 2.950, speed: 1.24, trackingCutoff01: 0.86 }),
  Delayed_Crush: Object.freeze({ duration: 4.200, endAt: 3.38, hit1At: 1.033, hit2At: 1.650, lockAt: 2.52, impactAt: 2.700, speed: 1.14, trackingCutoff01: 0.86 }),
  Combo_Sweep_1: Object.freeze({ duration: 1.250, endAt: 1.08, impactAt: 0.600, speed: 1.12, trackingCutoff01: 0.86 }),
  Combo_Backhand_2: Object.freeze({ duration: 1.150, endAt: 1.00, impactAt: 0.460, speed: 1.14, trackingCutoff01: 0.87 }),
  Combo_Slam_3: Object.freeze({ duration: 1.450, endAt: 1.38, impactAt: 0.933, speed: 1.10, trackingCutoff01: 0.85 }),
  Leap_Slam: Object.freeze({
    duration: 4.150,
    endAt: 4.050,
    takeoffAt: 0.420,
    flightStartAt: 0.560,
    apexAt: 1.180,
    landMoveEndAt: 1.720,
    impactAt: 1.750,
    extractSec: 2.250,
    extractClipSpanSec: 2.300,
    extractSpeed: 1.0,
    speed: 1.16,
    trackingCutoff01: 0.85
  }),
  Whirl_Spin: Object.freeze({ duration: 1.200, windupSec: 0.50, p1SpinSec: 2.25, p2SpinSec: 2.55, speed: 1.08, trackingCutoff01: 0.85 }),
  Rising_Upcut: Object.freeze({
    duration: 2.050,
    endAt: 2.020,
    windupEndAt: 0.640,
    impactAt: 0.800,
    activeEndAt: 1.020,
    speed: 1.06,
    trackingCutoff01: 0.82
  }),
  Ram_Thrust_Hook: Object.freeze({
    duration: 2.350,
    endAt: 2.300,
    hit1WindupEndAt: 0.580,
    hit1At: 0.720,
    hit1EndAt: 0.900,
    hit2WindupEndAt: 1.280,
    hit2At: 1.440,
    hit2EndAt: 1.640,
    speed: 1.06,
    trackingCutoff01: 0.84
  }),
  Recover_Heft: Object.freeze({ duration: 0.950, speed: 1.08 }),
  Whirl_End: Object.freeze({ duration: 0.950, speed: 1.00 }),
  Walk_Backward: Object.freeze({ duration: 1.200, speed: 1.04 }),
  Strafe_Left: Object.freeze({ duration: 1.100, speed: 1.06 }),
  Strafe_Right: Object.freeze({ duration: 1.100, speed: 1.06 }),
  Cutscene_Rise_Roar: Object.freeze({ duration: 2.400, peakAt: 1.15, speed: 1.0 }),
  Roar_Taunt: Object.freeze({ duration: 2.033, peakAt: 0.50, speedOpening: 1.08, speedPhase2: 1.18 }),
  Stagger_Kneel: Object.freeze({ duration: 1.000, kneelSec: 4.00, speed: 1.0 }),
  Stagger_Recover: Object.freeze({ duration: 1.650, speed: 1.0 }),
  Riposte_Victim_Fall: Object.freeze({ duration: 4.650, impaleAt: 0.56, yankAt: 1.32, fallImpactAt: 1.76, riseStartAt: 2.55, speed: 1.0 }),
  Hit_React: Object.freeze({ duration: 0.440, speed: 1.35 }),
  Hit_React_Left: Object.freeze({ duration: 0.440, speed: 1.35 }),
  Hit_React_Gut: Object.freeze({ duration: 0.480, speed: 1.35 }),
  Block_React: Object.freeze({ duration: 1.333, speed: 1.20 })
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
    damageLevel: 'knockdown',
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
    damageLevel: 'knockdown',
    activeWindowSec: 0.12,
    canParry: false,
    trackingCutoff01: 0.70,
    label: 'Delayed_Crush_Slam'
  }),
  leap_slam: Object.freeze({
    attackId: 'leap_slam',
    staminaDamage: 68,
    damageLevel: 'knockdown',
    activeWindowSec: 0.14,
    canParry: false,
    canBlock: false,
    unblockable: true,
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
  }),
  rising_upcut: Object.freeze({
    attackId: 'rising_upcut',
    staminaDamage: 46,
    damageLevel: 'heavy',
    activeWindowSec: 0.14,
    canParry: true,
    canBlock: true,
    trackingCutoff01: 0.68,
    label: 'Rising_Upcut'
  }),
  ram_thrust_hook: Object.freeze({
    attackId: 'ram_thrust_hook',
    staminaDamage: 44,
    damageLevel: 'heavy',
    activeWindowSec: 0.14,
    canParry: true,
    canBlock: true,
    trackingCutoff01: 0.68,
    label: 'Ram_Thrust_Hook'
  }),
  ram_thrust_hook_1: Object.freeze({
    attackId: 'ram_thrust_hook',
    staminaDamage: 42,
    damageLevel: 'heavy',
    activeWindowSec: 0.14,
    canParry: true,
    canBlock: true,
    trackingCutoff01: 0.68,
    label: 'Ram_Thrust_1'
  }),
  ram_thrust_hook_2: Object.freeze({
    attackId: 'ram_thrust_hook',
    staminaDamage: 48,
    damageLevel: 'heavy',
    activeWindowSec: 0.15,
    canParry: true,
    canBlock: true,
    trackingCutoff01: 0.68,
    label: 'Ram_Hook_2'
  })
});

export const SOULS_BOSS_MULTI_PARRY = Object.freeze({
  staggerMax: 220,
  parryStaggerGain: 75,
  parriesToKneel: 3,
  blockReactStunSec: 1.12,
  blockReactSpeed: 1.18
});

export const SOULS_BOSS_GOAL_CFG = Object.freeze({
  neutralMinDist: 2.5,
  neutralMaxDist: 4.3,
  closeBackstepDist: 0.0, // Disabled: Boss punishes close hugging instead of retreating politely!
  shieldBreakHoldSec: 1.25,
  flaskPunishCooldownSec: 3.4,
  farBranchDist: 7.4,
  behindAngleRad: 0.92,
  turnRateStalkRad: 5.2,
  turnRateWindupRad: 7.6,
  turnRateQuickTurnRad: 10.8,
  nominalWalkSpeed: 3.65
});

export const SOULS_BOSS_CROSSFADE_SEC = 0.16;

// Dark Souls 3 + Elden Ring + Lies of P Punish Windows & Anti-Greed traps:
//   tier 'heavy' -> crisp earned punish (1-2 heavy/light hits, x1.25 dmg, x1.45 stagger)
//   tier 'light' -> tight punish (1 hit, x1.15 dmg, x1.25 stagger)
//   tier 'none'  -> NOT punishable: fast anti-greed counter-chain!
export const SOULS_BOSS_PUNISH_PROFILES = Object.freeze({
  overhead_cleave: Object.freeze({
    tier: 'light', recoverP1: 0.88, recoverP2: 0.68, dmgMult: 1.15, staggerMult: 1.25,
    antiGreedDelay: 0.22, antiGreedRange: 4.8, hugRange: 4.2, recentHitSec: 0.55,
    recentHitChance: 0.62, hugChanceP1: 0.36, hugChanceP2: 0.48, counterWhirlWindup: 0.36
  }),
  sweep_combo_hit1: Object.freeze({ tier: 'none', hyperArmorUntilHit2: true }),
  sweep_combo: Object.freeze({
    tier: 'light', recoverP1: 1.06, recoverP2: 0.84, dmgMult: 1.15, staggerMult: 1.25,
    chainRange: 4.5, greedSec: 0.52, greedChance: 0.58, baseChance: 0.30
  }),
  delayed_crush: Object.freeze({ tier: 'heavy', recoverP1: 1.42, recoverP2: 1.15, dmgMult: 1.25, staggerMult: 1.45 }),
  aaa_combo: Object.freeze({ tier: 'heavy', recoverP1: 1.38, recoverP2: 1.12, dmgMult: 1.25, staggerMult: 1.45 }),
  leap_slam: Object.freeze({ tier: 'heavy', recoverP1: 2.25, recoverP2: 2.25, extractSec: 2.25, dmgMult: 1.25, staggerMult: 1.45 }),
  whirl_spin: Object.freeze({ tier: 'heavy', recoverP1: 1.28, recoverP2: 1.04, dmgMult: 1.25, staggerMult: 1.45 }),
  rising_upcut: Object.freeze({ tier: 'light', recoverP1: 0.72, recoverP2: 0.56, dmgMult: 1.15, staggerMult: 1.25 }),
  ram_thrust_hook: Object.freeze({ tier: 'light', recoverP1: 0.86, recoverP2: 0.68, dmgMult: 1.15, staggerMult: 1.25 })
});

export const SOULS_BOSS_PUNISH_CFG = SOULS_BOSS_PUNISH_PROFILES;

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
  const inOpenState =
    boss &&
    (boss.soulsState === 'recover' ||
      boss.soulsState === 'hit_react' ||
      (boss.soulsState === 'leap_slam' && Boolean(boss.soulsHit1Done)));
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
  boss.model?.handle?.clearCutsceneClip?.(blendInSec);
  boss.model?.handle?.clearClampedClip?.(true, blendInSec);
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

function triggerSoulsBossRecoil(boss, player, dist = 0.16, dur = 0.20) {
  if (!boss) return;
  const clampedDist = Math.min(0.22, Math.max(0, Number(dist) || 0.16));
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
  boss._soulsRecoil = { dirX: rdx, dirZ: rdz, dist: clampedDist, dur, elapsed: 0 };
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

function ensureBossRecentMovesRing(boss) {
  if (!boss) return [];
  if (!Array.isArray(boss._recentMoves)) {
    boss._recentMoves = Array.isArray(boss.lastTwoMoves) ? boss.lastTwoMoves.slice(-2) : [];
  }
  if (boss.lastTwoMoves !== boss._recentMoves) {
    boss.lastTwoMoves = boss._recentMoves;
  }
  return boss._recentMoves;
}

function recordSoulsBossMove(boss, moveId) {
  if (!boss || !moveId) return;
  const ring = ensureBossRecentMovesRing(boss);
  ring.push(moveId);
  while (ring.length > 2) {
    ring.shift();
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
  boss._phase2ArenaFireWaveTriggered = false;
  boss._soulsAirborne = false;
  boss._recentMoves = [];
  boss.lastTwoMoves = boss._recentMoves;
  boss.soulsPlayerBlockTimer = 0;
  boss.soulsCloseExchangeTimer = 0;
  boss._soulsSmoothSpeed = 0;
  boss._soulsAngVel = 0;
  boss.soulsAttackElapsed = 0;
  boss.soulsPeakFired = false;
  boss.soulsRoarPeakAt = useCutscene ? Math.min(0.24, cfg.peakAt / spd) : 0.08;
  boss.soulsChained = false;
  boss.soulsBehindTimer = 0;
  boss.soulsParryCount = 0;
  boss.soulsFlaskPunishCd = 1.5;
  boss.strafeDir = Math.random() < 0.5 ? 1 : -1;
  boss.soulsStrafeTimer = 2.4 + Math.random() * 0.8;
  boss.soulsRhythmMode = 'stalk_advance';
  boss.soulsRhythmTimer = 1.6 + Math.random() * 0.8;
  boss.soulsMoveCd = {
    leap_slam: 1.2,
    whirl_spin: 2.0,
    delayed_crush: 1.5,
    aaa_combo: 0.6,
    sweep_combo: 0,
    rising_upcut: 0,
    ram_thrust_hook: 0.4,
    ash_fissure: 0
  };
  const res = boss.model?.handle?.playClampedClip?.(clipName, spd, SOULS_BOSS_CROSSFADE_SEC);
  boss.soulsAttackDur = res?.ok && res.duration > 0.2 ? res.duration : cfg.duration / spd;
  boss.soulsTimer = boss.soulsAttackDur;
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
  boss._soulsActiveSwing = null;
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
  audio?.stopBossRoar?.(0.16);
  boss.model?.handle?.setBossMouthOpen?.(0);
  audio?.playBossRecoil?.();
  audio?.playArmorBreak?.('shield');
  world?.addScreenShake?.(0.50, 0.28);
  emitShockwave(boss.x, boss.z, 5.4, 0xfbbf24, 0.46);
  emitParticles(boss.x, 1.85, boss.z, 0xfde047, 28, 8.0, 0.18);
  floatText('СЛОМ СТОЙКИ! БОСС НА КОЛЕНЕ!', boss.x, boss.z - 0.9, '#fde047');
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
  boss._soulsActiveSwing = null;
  boss.soulsMoveType = null;
  boss.currentAttackMeta = null;
  boss.soulsChainCount = 0;
  boss.soulsRiposteUsed = true;
  boss.soulsRiposteInvuln = true;
  boss._soulsRiposteInitialized = true;
  boss.soulsRiposteElapsed = 0;
  boss.soulsRiposteFallImpactFired = false;
  // Atomic stance reset immediately on riposte start (kills infinite Riposte -> 1 R1 -> Riposte loop!)
  boss.stagger = 0;
  boss.soulsParryCount = 0;
  boss.staggeredTimer = 0;
  boss.parriedRiposteTimer = 0;
  boss.staggerImmunityTimer = 6.5;
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
  audio?.stopBossRoar?.(0.16);
  boss.model?.handle?.setBossMouthOpen?.(0);
  audio?.playBossRecoil?.();
  world?.addScreenShake?.(0.45, 0.24);
  emitShockwave?.(boss.x, boss.z, 4.4, 0xfbbf24, 0.36);
  emitParticles?.(boss.x, 1.8, boss.z, 0xfde047, 22, 7.2, 0.16);
  floatText?.('КРИТИЧЕСКИЙ РИПОСТ!', boss.x, boss.z - 1.0, '#fde047');
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
  boss._soulsActiveSwing = null;
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
  if (typeof boss.model?.handle?.triggerHitReact === 'function') {
    boss.model.handle.triggerHitReact({
      playClip: true,
      clipName: 'Block_React',
      speed: mp.blockReactSpeed,
      interruptAttack: true,
      blendInSec: 0.10,
      blendOutSec: 0.16,
      joltScale: 0.85
    });
  } else {
    boss.model?.handle?.playBossClip?.('Block_React', mp.blockReactSpeed, 0.12);
  }
  audio?.playBossRecoil?.();
  world?.addScreenShake?.(0.30, 0.16);
  emitShockwave?.(boss.x, boss.z, 3.8, 0xfbbf24, 0.30);
  emitParticles?.(boss.x, 1.8, boss.z, 0xfde047, 16, 6.2, 0.15);
  const shownParryIdx = Math.min(mp.parriesToKneel - 1, boss.soulsParryCount);
  floatText?.(`ПАРИРОВАНИЕ (${shownParryIdx}/${mp.parriesToKneel})`, boss.x, boss.z - 0.9, '#fde047');
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
    bossHazards,
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
  const pvx = Number(player.moveVelX ?? player.vx ?? 0) || 0;
  const pvz = Number(player.moveVelZ ?? player.vz ?? 0) || 0;
  const angToPlayer = Math.atan2(dx, dz);
  // Subtle lateral strafe lead for windup tracking so 1mm side-walking never makes colossal swings whiff!
  const pSpd = Math.hypot(pvx, pvz);
  const leadSecBoss = pSpd > 0.8 ? clamp(0.08 + dist * 0.022, 0.08, 0.17) : 0;
  const angToPlayerLead = leadSecBoss > 0
    ? Math.atan2((player.x + pvx * leadSecBoss) - boss.x, (player.z + pvz * leadSecBoss) - boss.z)
    : angToPlayer;
  const relAngFromFront = Math.abs(normalizeAngle(angToPlayer - boss.facing));
  const slowMult = boss.frostTimer > 0 ? 1 - (1 - (boss.frostFactor || 0.75)) * 0.40 : 1.0;
  const moveSpeed = Math.max(3.55, boss.speed * 1.22) * slowMult;
  const phase2 = boss.hp < boss.maxHp * 0.50;
  const p2SpdMult = boss.phase2Enraged || boss._soulsPhase2Done ? 1.14 : 1.0;
  if (boss._soulsPhase2Done) {
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
    boss.soulsMoveCd = {
      leap_slam: 0,
      whirl_spin: 0,
      delayed_crush: 0,
      aaa_combo: 0,
      sweep_combo: 0,
      rising_upcut: 0,
      ram_thrust_hook: 0,
      ash_fissure: 0
    };
  }
  const recentMoves = ensureBossRecentMovesRing(boss);
  if (boss.soulsState !== 'leap_slam') {
    boss._soulsAirborne = false;
  }
  const cd = boss.soulsMoveCd;
  cd.leap_slam = Math.max(0, (cd.leap_slam || 0) - dt);
  cd.whirl_spin = Math.max(0, (cd.whirl_spin || 0) - dt);
  cd.delayed_crush = Math.max(0, (cd.delayed_crush || 0) - dt);
  cd.aaa_combo = Math.max(0, (cd.aaa_combo || 0) - dt);
  cd.sweep_combo = Math.max(0, (cd.sweep_combo || 0) - dt);
  cd.rising_upcut = Math.max(0, (cd.rising_upcut || 0) - dt);
  cd.ram_thrust_hook = Math.max(0, (cd.ram_thrust_hook || 0) - dt);
  cd.ash_fissure = Math.max(0, (cd.ash_fissure || 0) - dt);
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
  const maxLeapRange = clamp(hallRadius * 1.18, 15.0, 20.0);
  const maxLeapStepDist = clamp(hallRadius * 0.84, 11.2, 14.2);

  const strikeHitPayload = (meta, extra = null) => ({
    parryable: Boolean(meta?.canParry),
    canParry: Boolean(meta?.canParry),
    canBlock: meta?.canBlock !== false,
    unblockable: Boolean(meta?.unblockable),
    isHeavy: meta?.damageLevel === 'heavy' || meta?.damageLevel === 'knockdown',
    staminaDamage: meta?.staminaDamage ?? 48,
    damageLevel: meta?.damageLevel ?? 'heavy',
    activeWindowSec: meta?.activeWindowSec ?? 0.13,
    attackMeta: meta || null,
    ...(extra || {})
  });

  // Multi-frame active hitbox helper (115-150ms continuous sweep instead of 1-frame 16ms snap!)
  const armBossActiveSwing = (spec) => {
    boss._soulsActiveSwing = {
      elapsed: 0,
      dur: Math.max(0.11, Number(spec.dur) || 0.13),
      hitDone: false,
      ...spec
    };
  };

  const tickBossActiveSwing = () => {
    const sw = boss._soulsActiveSwing;
    if (!sw) return;
    if (
      boss.hp <= 0 ||
      boss.stunTimer > 0 ||
      boss.soulsState === 'stagger_kneel' ||
      boss.soulsState === 'riposte_victim' ||
      sw.hitDone ||
      sw.elapsed > sw.dur
    ) {
      boss._soulsActiveSwing = null;
      return;
    }
    let connected = false;
    if (sw.kind === 'slam') {
      const dSlam = Math.hypot(player.x - sw.impX, player.z - sw.impZ);
      connected = dSlam <= sw.radius + player.radius * 0.58;
    } else {
      const pDx = player.x - boss.x;
      const pDz = player.z - boss.z;
      const pDist = Math.hypot(pDx, pDz);
      const relA = Math.abs(normalizeAngle(Math.atan2(pDx, pDz) - sw.sAng));
      connected = pDist <= sw.reach + player.radius * 0.58 && (relA <= sw.halfCone || pDist <= (sw.bodyGrace || 2.45));
    }
    if (connected) {
      sw.hitDone = true;
      applyDamageToPlayer(sw.damage, boss, sw.payload);
    }
    sw.elapsed += dt;
  };

  // Phase 2 NEW ATTACK #1: «Пепельный Разлом» — 4 staggered volcanic fissures traveling along hammer line!
  // (`shape: 'line'` fire road — keeps full existing duration untouched per ТЗ 4.5!)
  const spawnPhase2MoltenFissure = (originX, originZ, dirX, dirZ) => {
    if (!Array.isArray(bossHazards)) return;
    const dLen = Math.hypot(dirX || 0, dirZ || 0) || 1;
    const fdx = (dirX || 0) / dLen;
    const fdz = dLen > 1e-4 ? (dirZ || 0) / dLen : 1;
    const steps = [3.0, 5.8, 8.6, 11.4];
    for (let i = 0; i < steps.length; i++) {
      const rawX = originX + fdx * steps[i];
      const rawZ = originZ + fdz * steps[i];
      const safe = clampBossToSoulsHallFallback(rawX, rawZ, 1.2);
      bossHazards.push({
        x: safe.x,
        z: safe.z,
        dirX: fdx,
        dirZ: fdz,
        radius: 2.55,
        timer: 0.22 + i * 0.16,
        damage: Math.round(boss.damage * 1.02),
        color: 0xf97316,
        shape: 'line',
        kind: 'fissure',
        isAshFissure: true,
        sourceEnemy: boss,
        label: 'Ash_Fissure',
        attackMeta: { staminaDamage: 54, damageLevel: 'knockdown', canParry: false, label: 'Ash_Fissure' }
      });
    }
    emitParticles(originX + fdx * 2.2, 0.35, originZ + fdz * 2.2, 0xfde047, 18, 6.8, 0.16);
  };

  // Phase 2 NEW ATTACK #3: «Вулканический Афтершок» — circular burning fire field (`duration: 1.0s` per ТЗ 4.5
  // so melee punish windows around Boss slams/whirls are NEVER blocked by lingering floor fire!).
  const spawnPhase2VolcanicAftershock = (cx, cz) => {
    if (!Array.isArray(bossHazards)) return;
    const safe = clampBossToSoulsHallFallback(cx, cz, 1.4);
    bossHazards.push({
      x: safe.x,
      z: safe.z,
      dirX: 0,
      dirZ: 1,
      radius: 5.15,
      timer: 0.58,
      duration: 1.0,
      burnDuration: 1.0,
      shape: 'circle',
      kind: 'circle',
      damage: Math.round(boss.damage * 1.15),
      color: 0xea580c,
      isAftershock: true,
      sourceEnemy: boss,
      label: 'Volcanic_Aftershock',
      attackMeta: { staminaDamage: 62, damageLevel: 'knockdown', canParry: false, label: 'Volcanic_Aftershock' }
    });
    emitShockwave(safe.x, safe.z, 4.9, 0xf59e0b, 0.54);
  };

  // Tick any active multi-frame Boss weapon hitbox right at start of frame!
  tickBossActiveSwing();

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
      boss.parriedRiposteTimer = 0;
      boss.staggeredTimer = 0;
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
    if (isP2Roar && !boss._phase2ArenaFireWaveTriggered) {
      boss._phase2ArenaFireWaveTriggered = true;
      if (typeof ctx?.onPhase2ArenaFireWave === 'function') {
        ctx.onPhase2ArenaFireWave(boss.x, boss.z);
      } else {
        world?.triggerPhase2ArenaFireWave?.(boss.x, boss.z);
      }
    }
    const cfgRoar = SOULS_BOSS_CLIP_TIMINGS.Roar_Taunt;
    const spd = isP2Roar ? cfgRoar.speedPhase2 : cfgRoar.speedOpening;
    boss.vx *= 0.2;
    boss.vz *= 0.2;
    boss.currentAttackMeta = null;
    boss.soulsGoal = 'roar';
    stepBossTurn(boss, angToPlayer, 2.8, dt);
    boss.soulsAttackElapsed = (boss.soulsAttackElapsed || 0) + dt;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);

    const peakAtSec = Number.isFinite(boss.soulsRoarPeakAt) ? boss.soulsRoarPeakAt : 0.08;
    if (!boss.soulsPeakFired && boss.soulsAttackElapsed >= peakAtSec) {
      boss.soulsPeakFired = true;
      playBossRoarSfx(audio);
      world?.addScreenShake?.(isP2Roar ? 0.46 : 0.30, isP2Roar ? 0.30 : 0.22);
      emitShockwave(boss.x, boss.z, isP2Roar ? 8.6 : 7.2, isP2Roar ? 0xef4444 : 0xf59e0b, 0.52);
      emitParticles(boss.x, 2.3, boss.z, isP2Roar ? 0xf97316 : 0xfde047, isP2Roar ? 28 : 18, 7.6, 0.17);
    }

    if (boss.soulsTimer <= 0 || boss.model?.handle?.isClampedClipDone?.()) {
      audio?.stopBossRoar?.(0.16);
      boss.model?.handle?.setBossMouthOpen?.(0);
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
      audio?.stopBossRoar?.(0.16);
      boss.model?.handle?.setBossMouthOpen?.(0);
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
    boss.model?.handle?.setClipOverride?.(null);
    boss._soulsActiveSwing = null;
    if (prevSoulsState !== 'hit_react') {
      audio?.stopBossRoar?.(0.16);
      boss.model?.handle?.setBossMouthOpen?.(0);
      triggerSoulsBossRecoil(boss, player, 0.10, 0.18);
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
    boss._soulsActiveSwing = null;
    boss._soulsRecoil = null;
    boss._soulsDelayHoldRem = 0;
    boss._soulsDelayHoldArmed = false;
    boss._soulsDelaySnapped = false;
    boss._soulsForceFissure = Boolean(launchOpts?.forceFissure || moveId === 'ash_fissure');
    const effMoveId = moveId === 'ash_fissure' ? 'overhead_cleave' : moveId;
    boss.soulsLastMove = moveId;
    boss._soulsLaunchSeq = (boss._soulsLaunchSeq || 0) + 1;
    recordSoulsBossMove(boss, moveId);
    boss.soulsMoveType = effMoveId;
    boss.soulsActiveAttack = effMoveId;
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

    // Surprise fast spin-backhand counter (Phase 1 flank / Phase 2 post-leap mix-up!)
    if (effMoveId === 'backhand_counter' && bossHasClip(boss, 'Combo_Backhand_2')) {
      const cfg2 = SOULS_BOSS_CLIP_TIMINGS.Combo_Backhand_2;
      const spd2 = cfg2.speed * p2SpdMult * 1.06;
      boss.soulsState = 'aaa_combo';
      boss.soulsMoveType = 'combo_backhand_2';
      boss.soulsComboStage = 2;
      boss.soulsComboStageElapsed = 0;
      boss.soulsComboStageHitDone = false;
      boss.soulsClipSpeed = spd2;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_backhand_2;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad, 0.05);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const res2 = playBossAttackClip(boss, 'Combo_Backhand_2', spd2, 0.14);
      const realDur2 = res2?.ok && res2.duration > 0.2 ? res2.duration : (cfg2.endAt || cfg2.duration) / spd2;
      boss.soulsComboStageDur = Math.min(realDur2, (cfg2.endAt || cfg2.duration) / spd2 + 0.05);
      boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg2.impactAt / (cfg2.endAt || cfg2.duration));
      audio?.playBossFootstep?.();
      return;
    }

    // Instant Phase 2 Cyclone-to-Slam finisher (launches straight into Combo_Slam_3!)
    if (effMoveId === 'cyclone_slam' && bossHasClip(boss, 'Combo_Slam_3')) {
      const cfg3 = SOULS_BOSS_CLIP_TIMINGS.Combo_Slam_3;
      const spd3 = cfg3.speed * p2SpdMult;
      boss.soulsState = 'aaa_combo';
      boss.soulsMoveType = 'combo_slam_3';
      boss.soulsComboStage = 3;
      boss.soulsComboStageElapsed = 0;
      boss.soulsComboStageHitDone = false;
      boss.soulsClipSpeed = spd3;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_slam_3;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad, 0.06);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const res3 = playBossAttackClip(boss, 'Combo_Slam_3', spd3, 0.16);
      const realDur3 = res3?.ok && res3.duration > 0.2 ? res3.duration : (cfg3.endAt || cfg3.duration) / spd3;
      boss.soulsComboStageDur = Math.min(realDur3, (cfg3.endAt || cfg3.duration) / spd3 + 0.05);
      boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg3.impactAt / (cfg3.endAt || cfg3.duration));
      boss._soulsDelayHoldArmed = true;
      boss._soulsDelayHoldRem = 0.18 + Math.random() * 0.22;
      audio?.playBossFootstep?.();
      return;
    }

    if (effMoveId === 'overhead_cleave') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Heavy_Cleave;
      const isQuickTurn = Boolean(launchOpts?.quickTurnaround);
      const clipSpeed = (isQuickTurn ? 1.32 : cfg.speed) * p2SpdMult;
      boss.soulsState = 'overhead_cleave';
      boss.soulsChained = false;
      boss.soulsClipSpeed = clipSpeed;
      boss.soulsQuickTurn = isQuickTurn;
      boss.currentAttackMeta = isQuickTurn ? SOULS_BOSS_ATTACK_META.quick_cleave : SOULS_BOSS_ATTACK_META.overhead_cleave;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsImpactAt = cfg.impactAt / clipSpeed;
      // Variable Elden Ring / Lies of P delayed hold on Heavy_Cleave (45% chance or on roll-spam!)
      if (!isQuickTurn && (recentRolls >= 1 || Math.random() < 0.45)) {
        boss._soulsDelayHoldArmed = true;
        boss._soulsDelayHoldRem = 0.16 + Math.random() * 0.28;
      }
      if (moveId === 'ash_fissure') {
        cd.ash_fissure = 4.2;
      }
      stepBossTurn(boss, angToPlayerLead, isQuickTurn ? SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad : SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Heavy_Cleave', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.2, 0.13);
      return;
    }

    if (effMoveId === 'sweep_combo') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Sweep_Combo;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'sweep_combo';
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.sweep_combo_1;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsHit1At = cfg.hit1At / clipSpeed;
      boss.soulsHit2At = cfg.hit2At / clipSpeed;
      cd.sweep_combo = phase2 ? 2.0 : 2.8;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Sweep_Combo', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.2, 0.13);
      return;
    }

    if (effMoveId === 'aaa_combo') {
      if (!bossHasClip(boss, 'Combo_Sweep_1')) {
        return launchAttack('delayed_crush', launchOpts);
      }
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Combo_Sweep_1;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'aaa_combo';
      boss.soulsMoveType = 'combo_sweep_1';
      boss.soulsComboStage = 1;
      boss.soulsComboStageElapsed = 0;
      boss.soulsComboStageHitDone = false;
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_sweep_1;
      cd.aaa_combo = phase2 ? 2.4 : 3.4;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const res = playBossAttackClip(boss, 'Combo_Sweep_1', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      const realDur = res?.ok && res.duration > 0.2 ? res.duration : (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsComboStageDur = Math.min(realDur, (cfg.endAt || cfg.duration) / clipSpeed + 0.05);
      boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg.impactAt / (cfg.endAt || cfg.duration));
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 8, 3.4, 0.13);
      return;
    }

    if (effMoveId === 'delayed_crush') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Delayed_Crush;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'delayed_crush';
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_1;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsHit1At = cfg.hit1At / clipSpeed;
      boss.soulsHit2At = cfg.hit2At / clipSpeed;
      boss.soulsLockAt = cfg.lockAt / clipSpeed;
      boss.soulsImpactAt = cfg.impactAt / clipSpeed;
      // Signature Lies of P / Elden Ring variable hang before Hit 3 slam!
      boss._soulsDelayHoldArmed = true;
      boss._soulsDelayHoldRem = 0.20 + Math.random() * 0.36;
      cd.delayed_crush = phase2 ? 2.6 : 3.5;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      playBossAttackClip(boss, 'Delayed_Crush', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 3.5, 0.13);
      return;
    }

    if (effMoveId === 'rising_upcut') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Rising_Upcut;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'rising_upcut';
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.rising_upcut;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsImpactAt = cfg.impactAt / clipSpeed;
      boss._upcutSparkTimer = 0;
      cd.rising_upcut = phase2 ? 2.2 : 3.0;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.08, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const clipToPlay = !boss?.model || bossHasClip(boss, 'Rising_Upcut') ? 'Rising_Upcut' : 'Combo_Sweep_1';
      playBossAttackClip(boss, clipToPlay, clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.26, boss.z, 0xd6d3d1, 8, 3.4, 0.13);
      return;
    }

    if (effMoveId === 'ram_thrust_hook') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Ram_Thrust_Hook;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'ram_thrust_hook';
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.ram_thrust_hook_1;
      boss.soulsAttackDur = (cfg.endAt || cfg.duration) / clipSpeed;
      boss.soulsHit1At = cfg.hit1At / clipSpeed;
      boss.soulsHit2At = cfg.hit2At / clipSpeed;
      cd.ram_thrust_hook = phase2 ? 2.5 : 3.4;
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.12, 0.04);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
      const clipToPlay = !boss?.model || bossHasClip(boss, 'Ram_Thrust_Hook') ? 'Ram_Thrust_Hook' : 'Sweep_Combo';
      playBossAttackClip(boss, clipToPlay, clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.28, boss.z, 0xd6d3d1, 10, 3.6, 0.13);
      return;
    }

    if (effMoveId === 'leap_slam') {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Leap_Slam;
      const clipSpeed = cfg.speed * p2SpdMult;
      boss.soulsState = 'leap_slam';
      boss.soulsClipSpeed = clipSpeed;
      boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.leap_slam;
      boss.soulsTakeoffAt = cfg.takeoffAt / clipSpeed;
      boss.soulsFlightStartAt = (cfg.flightStartAt ?? cfg.takeoffAt) / clipSpeed;
      boss.soulsLandMoveEndAt = cfg.landMoveEndAt / clipSpeed;
      boss.soulsImpactAt = cfg.impactAt / clipSpeed;
      // Post-impact stuck-hammer 4-heave extraction (`1.75..4.05s`) plays at 1.0x speed for a full ~2.25s punish window!
      boss.soulsAttackDur = boss.soulsImpactAt + (cfg.extractClipSpanSec || 2.30);
      boss.soulsLeapSfxPlayed = false;
      boss._soulsAirborne = false;
      boss._leapWrenchMask = 0;
      boss._leapCraterX = boss.x;
      boss._leapCraterZ = boss.z;
      cd.leap_slam = phase2 ? 3.4 : 4.4;
      stepBossTurn(boss, angToPlayerLead, 11.5, Math.max(dt, 0.06));
      boss.leapStartX = boss.x;
      boss.leapStartZ = boss.z;
      const leapDist = clamp(dist - 0.85, 3.0, maxLeapStepDist);
      const rawEndX = boss.x + (dx / dist) * leapDist;
      const rawEndZ = boss.z + (dz / dist) * leapDist;
      const safeEnd = resolveObstaclesAndBounds
        ? resolveObstaclesAndBounds(rawEndX, rawEndZ, boss.radius, ARENA_ENTITY_LIMIT)
        : clampBossToSoulsHallFallback(rawEndX, rawEndZ, boss.radius);
      boss.leapEndX = safeEnd.x;
      boss.leapEndZ = safeEnd.z;
      playBossAttackClip(boss, 'Leap_Slam', clipSpeed, SOULS_BOSS_CROSSFADE_SEC);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.35, boss.z, 0xd6d3d1, 12, 4.4, 0.14);
      return;
    }

    if (effMoveId === 'whirl_spin') {
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
      // Smoothly hand off any active one-shot attack (e.g., Heavy_Cleave / Combo_Sweep_1 tail) directly
      // into looping Whirl_Spin with strict wSum === 1.000 so outgoing tails NEVER block Whirl_Spin!
      if (typeof boss.model?.handle?.handoffToClipOverride === 'function') {
        boss.model.handle.handoffToClipOverride('Whirl_Spin', 0.65, 0.20);
      } else {
        boss.model?.handle?.cancelAttackAnim?.();
        boss.model?.handle?.setClipOverride?.('Whirl_Spin', 0.65);
      }
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.35, boss.z, 0xd6d3d1, 10, 3.8, 0.14);
    }
  };

  if (boss._qaForceMove && boss.soulsState !== 'stagger_kneel' && boss.soulsState !== 'riposte_victim') {
    const forcedMove = boss._qaForceMove;
    boss._qaForceMove = null;
    if (cd[forcedMove] !== undefined) cd[forcedMove] = 0;
    launchAttack(forcedMove, { silentText: true });
    return { isMoving: false };
  }

  const enterRecover = (recoverSec, punishTier = null, recoverClipOverride = null) => {
    cancelSoulsBossTelegraph(boss, elapsedTime);
    clearWalkOverride(true);
    boss.model?.handle?.setClipOverride?.(null);

    boss.soulsState = 'recover';
    boss.soulsGoal = 'recover';
    boss.soulsPosturePhase = 'recover';
    boss.soulsPosturePhase01 = 0;
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

    // Play dedicated Whirl_End braking recovery after Whirl_Spin (eliminates sudden vertical snap!),
    // or clean Recover_Heft when recoverSec >= 0.45s; for short breathers hand off smoothly to Idle.
    const chosenRecClip =
      recoverClipOverride && bossHasClip(boss, recoverClipOverride)
        ? recoverClipOverride
        : (recoverSec >= 0.45 && bossHasClip(boss, 'Recover_Heft') ? 'Recover_Heft' : null);
    if (chosenRecClip) {
      const cfgRec = SOULS_BOSS_CLIP_TIMINGS[chosenRecClip] || SOULS_BOSS_CLIP_TIMINGS.Recover_Heft;
      const recSpeed = clamp((cfgRec.duration || 0.95) / Math.max(0.45, recoverSec), 0.78, 1.85);
      const fadeSec = chosenRecClip === 'Whirl_End' ? 0.14 : SOULS_BOSS_CROSSFADE_SEC;
      playBossAttackClip(boss, chosenRecClip, recSpeed, fadeSec);
      boss._soulsRecoverHeftPlaying = true;
    } else {
      boss.model?.handle?.handoffToBase?.('Idle', 1.0, 0.24);
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

    const prevMove = recentMoves[recentMoves.length - 1] || null;
    boss.soulsFlaskPunishCd = SOULS_BOSS_GOAL_CFG.flaskPunishCooldownSec;
    boss.soulsChainCount = 0;
    if (dist > 6.4 && cd.leap_slam <= 0 && prevMove !== 'leap_slam') {
      launchAttack('leap_slam', { goalTag: 'flask_punish', silentText: true });
    } else if (dist >= 4.4 && dist <= 8.6 && cd.ram_thrust_hook <= 0 && prevMove !== 'ram_thrust_hook') {
      launchAttack('ram_thrust_hook', { goalTag: 'flask_punish', silentText: true });
    } else if (dist > 5.0 && cd.delayed_crush <= 0 && prevMove !== 'delayed_crush') {
      launchAttack('delayed_crush', { goalTag: 'flask_punish', silentText: true });
    } else if (cd.rising_upcut <= 0 && prevMove !== 'rising_upcut') {
      launchAttack('rising_upcut', { goalTag: 'flask_punish', silentText: true });
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

    // 1. Player behind or flanking -> quick turnaround Heavy_Cleave, Rising_Upcut, or Whirl_Spin if rear-hugged
    if (relAngFromFront > goalCfg.behindAngleRad && dist <= 5.4) {
      boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
      emitParticles(boss.x, 0.25, boss.z, 0xd6d3d1, 8, 3.6, 0.12);
      if (relAngFromFront > 1.68 && cd.whirl_spin <= 0 && fromMove !== 'whirl_spin' && Math.random() < 0.45) {
        launchAttack('whirl_spin', {
          windupSec: SOULS_BOSS_PUNISH_PROFILES.overhead_cleave.counterWhirlWindup,
          goalTag: 'combo_branch',
          silentText: true
        });
      } else if (fromMove === 'overhead_cleave' && cd.rising_upcut <= 0) {
        launchAttack('rising_upcut', { goalTag: 'combo_branch', silentText: true });
      } else {
        launchAttack('overhead_cleave', { quickTurnaround: true, goalTag: 'combo_branch' });
      }
      return true;
    }

    // 2. Player retreated far (> 7.4m) with clear LOS -> Ram_Thrust_Hook or Leap_Slam gap-closer!
    if (dist > goalCfg.farBranchDist && dist <= maxLeapRange && hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)) {
      if (dist <= 8.6 && cd.ram_thrust_hook <= 0 && fromMove !== 'ram_thrust_hook' && Math.random() < 0.50) {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.0, 0.13);
        launchAttack('ram_thrust_hook', { goalTag: 'combo_branch', silentText: true });
        return true;
      }
      if (cd.leap_slam <= 0 && fromMove !== 'leap_slam') {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.0, 0.13);
        launchAttack('leap_slam', { goalTag: 'combo_branch', silentText: true });
        return true;
      }
    }

    // 3. Mid-range branch -> Rising_Upcut, Ram_Thrust_Hook, Sweep_Combo, or delayed roll-catch Delayed_Crush
    if (dist >= 3.0 && dist <= 7.6) {
      if (fromMove === 'overhead_cleave') {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.2, 0.13);
        if (dist <= 5.4 && cd.rising_upcut <= 0 && Math.random() < 0.42) {
          launchAttack('rising_upcut', { goalTag: 'combo_branch', silentText: true });
        } else if (dist > 4.6 && cd.ram_thrust_hook <= 0 && Math.random() < 0.45) {
          launchAttack('ram_thrust_hook', { goalTag: 'combo_branch', silentText: true });
        } else if ((recentRolls >= 2 || dist > 4.6 || Math.random() < (phase2 ? 0.55 : 0.35)) && cd.delayed_crush <= 0) {
          launchAttack('delayed_crush', { goalTag: 'combo_branch', silentText: true });
        } else {
          launchAttack('sweep_combo', { goalTag: 'combo_branch' });
        }
        return true;
      }
      if (fromMove === 'sweep_combo') {
        if (dist <= 5.6 && cd.rising_upcut <= 0 && Math.random() < 0.50) {
          boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
          emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.2, 0.13);
          launchAttack('rising_upcut', { goalTag: 'combo_branch', silentText: true });
          return true;
        }
        if (cd.delayed_crush <= 0) {
          boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
          emitParticles(boss.x, 0.30, boss.z, 0xd6d3d1, 10, 4.2, 0.13);
          launchAttack('delayed_crush', { goalTag: 'combo_branch', silentText: true });
          return true;
        }
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
    boss.soulsRoarPeakAt = 0.08;
    boss.model?.handle?.setClipOverride?.(null);
    const res = boss.model?.handle?.playClampedClip?.('Roar_Taunt', cfgRoar.speedPhase2, SOULS_BOSS_CROSSFADE_SEC);
    boss.soulsAttackDur = res?.ok && res.duration > 0.2 ? res.duration : cfgRoar.duration / cfgRoar.speedPhase2;
    boss.soulsTimer = boss.soulsAttackDur;
    if (!boss._phase2ArenaFireWaveTriggered) {
      boss._phase2ArenaFireWaveTriggered = true;
      if (typeof ctx?.onPhase2ArenaFireWave === 'function') {
        ctx.onPhase2ArenaFireWave(boss.x, boss.z);
      } else {
        world?.triggerPhase2ArenaFireWave?.(boss.x, boss.z);
      }
    }
    world?.addScreenShake?.(0.40, 0.26);
    emitShockwave(boss.x, boss.z, 7.2, 0xef4444, 0.48);
    emitParticles(boss.x, 1.8, boss.z, 0xf97316, 24, 7.2, 0.16);
    floatText('🔥 ЯРОСТЬ СУДИИ РУИН!', boss.x, boss.z - 1.2, '#f97316');
  };

  // ------------------------------------------------------------------------
  // D0b. NEW MOVE #1 — RISING UPCUT (`Rising_Upcut` 2.05s: 2.6m diagonal lunge + stone spark scrape!)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'rising_upcut') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Rising_Upcut;
    const clipSpeed = boss.soulsClipSpeed || cfg.speed;
    const prevT = boss.soulsAttackElapsed || 0;
    boss.soulsAttackElapsed = prevT + dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const trackCutoffClipT = cfg.impactAt * cfg.trackingCutoff01;

    if (!boss.soulsHit1Done && clipT < trackCutoffClipT) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.10, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    if (clipT < cfg.windupEndAt) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp(clipT / cfg.windupEndAt, 0, 1);
    } else if (clipT <= cfg.activeEndAt) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.windupEndAt) / Math.max(0.05, cfg.activeEndAt - cfg.windupEndAt), 0, 1);
    } else {
      boss.soulsPosturePhase = 'recover';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.activeEndAt) / Math.max(0.1, (cfg.endAt || cfg.duration) - cfg.activeEndAt), 0, 1);
    }

    // Diagonal forward-right step (2.6m lunge synced 1:1 to [0.20s .. 0.84s] foot stride in Rift_Boss_Tripo.glb!)
    const fx = boss.soulsStrikeDirX;
    const fz = boss.soulsStrikeDirZ;
    const lungeDirX = fx * 0.98 - fz * 0.18;
    const lungeDirZ = fz * 0.98 + fx * 0.18;
    const upcutStep = sampleWindowStep(prevClipT, clipT, 0.20, 0.84, 2.60, easeAttackDrive);
    if (upcutStep > 0) {
      advanceBossWithCollision(boss, lungeDirX, lungeDirZ, upcutStep, player, resolveObstaclesAndBounds);
    }
    if (prevClipT < 0.56 && clipT >= 0.56) {
      audio?.playBossFootstep?.();
    }

    // Low-right stone spark scrape along the flagstones (`0.42..0.78s` clip time)
    if (clipT >= 0.42 && clipT <= 0.78) {
      boss._upcutSparkTimer = (boss._upcutSparkTimer || 0) - dt;
      if (boss._upcutSparkTimer <= 0) {
        boss._upcutSparkTimer = 0.045;
        const scrapeX = boss.x + fx * 1.35 - fz * 0.55;
        const scrapeZ = boss.z + fz * 1.35 + fx * 0.55;
        emitParticles(scrapeX, 0.12, scrapeZ, boss.phase2Enraged ? 0xf97316 : 0xfbbf24, 5, 4.6, 0.12);
        emitParticles(scrapeX, 0.08, scrapeZ, 0xd6d3d1, 3, 2.8, 0.11);
      }
    }

    if (!boss.soulsHit1Done && t >= boss.soulsImpactAt) {
      boss.soulsHit1Done = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(fx, fz);
      const sparkX = boss.x + fx * 2.05;
      const sparkZ = boss.z + fz * 2.05;
      playBossWhooshSfx(audio, true);
      world?.addScreenShake?.(0.34, 0.18);
      emitShockwave(sparkX, sparkZ, 3.3, boss.phase2Enraged ? 0xf97316 : 0xfbbf24, 0.30);
      emitParticles(sparkX, 0.85, sparkZ, boss.phase2Enraged ? 0xf97316 : 0xfde047, 18, 6.4, 0.14);
      emitParticles(sparkX, 0.25, sparkZ, 0xd6d3d1, 10, 4.2, 0.13);
      armBossActiveSwing({
        kind: 'arc',
        sAng,
        reach: 4.70,
        halfCone: Math.PI * 0.58,
        bodyGrace: 2.55,
        dur: 0.16,
        damage: Math.round(boss.damage * 1.12),
        payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.rising_upcut)
      });
      tickBossActiveSwing();
    }

    if (t >= boss.soulsAttackDur) {
      const pRU = SOULS_BOSS_PUNISH_PROFILES.rising_upcut;
      enterRecover(phase2 ? pRU.recoverP2 : pRU.recoverP1, pRU.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // D0c. NEW MOVE #2 — RAM THRUST & HOOK (`Ram_Thrust_Hook` 2.35s: 3.8m battering-ram lunge -> wide 3.6m+ hook!)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'ram_thrust_hook') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Ram_Thrust_Hook;
    const clipSpeed = boss.soulsClipSpeed || cfg.speed;
    const prevT = boss.soulsAttackElapsed || 0;
    boss.soulsAttackElapsed = prevT + dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const hit1TrackEnd = cfg.hit1At * cfg.trackingCutoff01;
    const hit2TrackEnd = cfg.hit1EndAt + (cfg.hit2At - cfg.hit1EndAt) * cfg.trackingCutoff01;

    if (!boss.soulsHit1Done && clipT < hit1TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.12, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && clipT < hit2TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.18, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    if (clipT < cfg.hit1WindupEndAt) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp(clipT / cfg.hit1WindupEndAt, 0, 1);
    } else if (clipT <= cfg.hit1EndAt) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.hit1WindupEndAt) / Math.max(0.05, cfg.hit1EndAt - cfg.hit1WindupEndAt), 0, 1);
    } else if (clipT < cfg.hit2WindupEndAt) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.hit1EndAt) / Math.max(0.06, cfg.hit2WindupEndAt - cfg.hit1EndAt), 0, 1);
    } else if (clipT <= cfg.hit2EndAt) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.hit2WindupEndAt) / Math.max(0.05, cfg.hit2EndAt - cfg.hit2WindupEndAt), 0, 1);
    } else {
      boss.soulsPosturePhase = 'recover';
      boss.soulsPosturePhase01 = clamp((clipT - cfg.hit2EndAt) / Math.max(0.1, (cfg.endAt || cfg.duration) - cfg.hit2EndAt), 0, 1);
    }

    // Stage 1 linear 3.8m battering-ram lunge [0.50..0.88s] + Stage 2 pivot step 0.50m [1.20..1.50s] synced 1:1 to GLB!
    const ramStep1 = sampleWindowStep(prevClipT, clipT, 0.50, 0.88, 3.80, easeAttackDrive);
    const ramStep2 = sampleWindowStep(prevClipT, clipT, 1.20, 1.50, 0.50, easeAttackDrive);
    const totalRamStep = ramStep1 + ramStep2;
    if (totalRamStep > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        totalRamStep,
        player,
        resolveObstaclesAndBounds
      );
    }
    if ((prevClipT < 0.70 && clipT >= 0.70) || (prevClipT < 1.38 && clipT >= 1.38)) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.5, 0.14, boss.z + boss.soulsStrikeDirZ * 0.5, 0xd6d3d1, 7, 3.2, 0.12);
    }

    if (!boss.soulsHit1Done && t >= boss.soulsHit1At) {
      boss.soulsHit1Done = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
      playBossWhooshSfx(audio, true);
      world?.addScreenShake?.(0.30, 0.15);
      emitParticles(
        boss.x + boss.soulsStrikeDirX * 2.2,
        1.25,
        boss.z + boss.soulsStrikeDirZ * 2.2,
        boss.phase2Enraged ? 0xf97316 : 0xd6d3d1,
        12,
        5.4,
        0.13
      );
      armBossActiveSwing({
        kind: 'arc',
        sAng,
        reach: 4.60,
        halfCone: Math.PI * 0.44,
        bodyGrace: 2.50,
        dur: 0.15,
        damage: Math.round(boss.damage * 1.02),
        payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.ram_thrust_hook_1)
      });
      tickBossActiveSwing();
      if (boss.soulsState === 'ram_thrust_hook' && boss.stunTimer <= 0) {
        boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.ram_thrust_hook_2;
      }
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && t >= boss.soulsHit2At) {
      boss.soulsHit2Done = true;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
      playBossWhooshSfx(audio, true);
      world?.addScreenShake?.(0.36, 0.18);
      emitShockwave(boss.x + boss.soulsStrikeDirX * 1.6, boss.z + boss.soulsStrikeDirZ * 1.6, 3.6, boss.phase2Enraged ? 0xf59e0b : 0xa8a29e, 0.30);
      if (boss.phase2Enraged) {
        emitParticles(boss.x + boss.soulsStrikeDirX * 2.2, 1.25, boss.z + boss.soulsStrikeDirZ * 2.2, 0xfbbf24, 16, 6.0, 0.14);
      }
      armBossActiveSwing({
        kind: 'arc',
        sAng,
        reach: 4.85,
        halfCone: Math.PI * 0.68,
        bodyGrace: 2.62,
        dur: 0.16,
        damage: Math.round(boss.damage * 1.16),
        payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.ram_thrust_hook_2)
      });
      tickBossActiveSwing();
    }

    if (t >= boss.soulsAttackDur) {
      const pRTH = SOULS_BOSS_PUNISH_PROFILES.ram_thrust_hook;
      enterRecover(phase2 ? pRTH.recoverP2 : pRTH.recoverP1, pRTH.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // D0. AAA FLUID 3-HIT COMBO (`Combo_Sweep_1` -> `Combo_Backhand_2` -> `Combo_Slam_3`)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'aaa_combo') {
    const stage = boss.soulsComboStage || 1;
    const prevStageT = boss.soulsComboStageElapsed || 0;
    const stageDur = Math.max(0.25, boss.soulsComboStageDur || 0.95);
    const impactAt = Math.max(0.15, boss.soulsComboStageImpactAt || stageDur * 0.52);

    const cfgKey = stage === 1 ? 'Combo_Sweep_1' : stage === 2 ? 'Combo_Backhand_2' : 'Combo_Slam_3';
    const cfg = SOULS_BOSS_CLIP_TIMINGS[cfgKey];
    const baseStageSpd = boss.soulsClipSpeed || cfg.speed;
    const trackCutoff = impactAt * (cfg.trackingCutoff01 || 0.68);

    // Variable-velocity Elden Ring / Lies of P apex hang -> snap acceleration on Combo_Slam_3!
    let effStageDt = dt;
    if (stage === 3 && !boss.soulsComboStageHitDone && boss._soulsDelayHoldArmed) {
      const hangStart = impactAt * 0.56;
      const hangEnd = impactAt * 0.84;
      if (prevStageT >= hangStart && prevStageT < hangEnd && (boss._soulsDelayHoldRem || 0) > 0 && !boss._soulsDelaySnapped) {
        boss._soulsDelayHoldRem = Math.max(0, boss._soulsDelayHoldRem - dt);
        // Slow dramatic hang (0.38x) while tracking player's panic roll!
        const hangSpd = baseStageSpd * 0.38;
        boss.model?.handle?.setActiveAttackTimeScale?.(hangSpd);
        effStageDt = dt * 0.38;
        stepBossTurn(boss, angToPlayerLead, 5.8, dt);
        boss.soulsStrikeDirX = Math.sin(boss.facing);
        boss.soulsStrikeDirZ = Math.cos(boss.facing);
        if (boss.phase2Enraged && Math.random() < dt * 22) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 0.6, 3.2, boss.z + boss.soulsStrikeDirZ * 0.6, 0xfde047, 1, 3.2, 0.13);
        }
      } else if (prevStageT >= hangEnd || (prevStageT >= hangStart && (boss._soulsDelayHoldRem || 0) <= 0)) {
        if (!boss._soulsDelaySnapped) {
          boss._soulsDelaySnapped = true;
          boss.model?.handle?.setActiveAttackTimeScale?.(baseStageSpd * 1.48);
        }
        effStageDt = dt * 1.48;
      }
    }
    boss.soulsComboStageElapsed = prevStageT + effStageDt;
    const st = boss.soulsComboStageElapsed;

    if (!boss.soulsComboStageHitDone && st < trackCutoff) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.08, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    // Weighty physical forward drive synced to each strike stage
    const windEndA = Math.max(0.05, impactAt * 0.80);
    const actEndA = Math.min(stageDur, impactAt + 0.16);
    if (st < windEndA) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp(st / windEndA, 0, 1);
    } else if (st <= actEndA) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((st - windEndA) / Math.max(0.05, actEndA - windEndA), 0, 1);
    } else {
      boss.soulsPosturePhase = 'recover';
      boss.soulsPosturePhase01 = clamp((st - actEndA) / Math.max(0.05, stageDur - actEndA), 0, 1);
    }
    // Exact 1:1 root-motion step synced to Rift_Boss_Tripo.glb inverse-root boot strides (ZERO frozen-foot gliding!)
    const clipSpdNow = boss.soulsClipSpeed || cfg.speed;
    const prevClipSt = prevStageT * clipSpdNow;
    const currClipSt = boss.soulsComboStageElapsed * clipSpdNow;
    const stepT0 = stage === 1 ? 0.20 : stage === 2 ? 0.14 : 0.32;
    const stepT1 = stage === 1 ? 0.58 : stage === 2 ? 0.45 : 0.90;
    const lungeDist = stage === 1 ? 0.92 : stage === 2 ? 0.96 : 1.08;
    const step = sampleWindowStep(prevClipSt, currClipSt, stepT0, stepT1, lungeDist, easeAttackDrive);
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
    if (prevClipSt < stepT1 && currClipSt >= stepT1) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.45, 0.14, boss.z + boss.soulsStrikeDirZ * 0.45, 0xd6d3d1, 6, 2.8, 0.12);
    }

    if (!boss.soulsComboStageHitDone && boss.soulsComboStageElapsed >= impactAt) {
      boss.soulsComboStageHitDone = true;
      boss.model?.handle?.setActiveAttackTimeScale?.(boss.soulsClipSpeed || cfg.speed);
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);

      if (stage === 1) {
        const reach = 4.65;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.24, 0.14);
        if (boss.phase2Enraged) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 2.1, 1.25, boss.z + boss.soulsStrikeDirZ * 2.1, 0xf97316, 10, 5.0, 0.13);
        }
        armBossActiveSwing({
          kind: 'arc', sAng, reach, halfCone: Math.PI * 0.62, bodyGrace: 2.55, dur: 0.15,
          damage: Math.round(boss.damage * 0.92), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_sweep_1)
        });
        tickBossActiveSwing();
      } else if (stage === 2) {
        const reach = 4.75;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.32, 0.16);
        if (boss.phase2Enraged) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 2.2, 1.30, boss.z + boss.soulsStrikeDirZ * 2.2, 0xfbbf24, 12, 5.4, 0.14);
        }
        armBossActiveSwing({
          kind: 'arc', sAng, reach, halfCone: Math.PI * 0.64, bodyGrace: 2.60, dur: 0.15,
          damage: Math.round(boss.damage * 1.08), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_backhand_2)
        });
        tickBossActiveSwing();
      } else {
        const impX = boss.x + boss.soulsStrikeDirX * 2.15;
        const impZ = boss.z + boss.soulsStrikeDirZ * 2.15;
        const slamR = 4.40;
        playBossHammerGroundSfx(audio);
        world?.addScreenShake?.(0.54, 0.28);
        world?.spawnBossGroundFracture?.({
          x: impX,
          z: impZ,
          radius: slamR,
          shape: 'circle',
          kind: 'circle',
          molten: Boolean(boss.phase2Enraged),
          duration: boss.phase2Enraged ? 1.0 : 2.20
        });
        emitShockwave(impX, impZ, slamR * 0.95, boss.phase2Enraged ? 0xf97316 : 0xa8a29e, 0.42);
        if (boss.phase2Enraged) {
          emitParticles(impX, 0.45, impZ, 0xf97316, 26, 7.8, 0.16);
        }
        emitParticles(impX, 0.28, impZ, 0xd6d3d1, 22, 6.2, 0.15);
        armBossActiveSwing({
          kind: 'slam', impX, impZ, radius: slamR, dur: 0.15,
          damage: Math.round(boss.damage * 1.32), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.combo_slam_3)
        });
        tickBossActiveSwing();
        // Phase 2 NEW SIGNATURE: Cyclone Slam leaves Burning Fire Circle; Combo_Slam_3 leaves Molten Fissure Road!
        if (boss.phase2Enraged) {
          if (boss.soulsLastMove === 'cyclone_slam') {
            spawnPhase2VolcanicAftershock(impX, impZ);
          } else {
            spawnPhase2MoltenFissure(impX, impZ, boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
          }
        }
      }
    }

    // Seamless modular branching & stage chaining with smooth 0.16s crossfade
    if (boss.soulsComboStageElapsed >= stageDur) {
      if (stage === 1) {
        if (dist > 7.6 && dist <= maxLeapRange && cd.leap_slam <= 0 && hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles)) {
          launchAttack('leap_slam', { goalTag: 'combo_branch', silentText: true });
          return { isMoving: false };
        }
        if (relAngFromFront > 1.25 && dist <= 5.2 && cd.whirl_spin <= 0 && Math.random() < 0.60) {
          launchAttack('whirl_spin', {
            windupSec: SOULS_BOSS_PUNISH_PROFILES.overhead_cleave.counterWhirlWindup,
            goalTag: 'combo_branch',
            silentText: true
          });
          return { isMoving: false };
        }
      }
      if (stage === 1 && dist <= 7.8 && bossHasClip(boss, 'Combo_Backhand_2')) {
        const cfg2 = SOULS_BOSS_CLIP_TIMINGS.Combo_Backhand_2;
        const spd2 = cfg2.speed * p2SpdMult;
        boss.soulsComboStage = 2;
        boss.soulsMoveType = 'combo_backhand_2';
        boss.soulsComboStageElapsed = 0;
        boss.soulsComboStageHitDone = false;
        boss.soulsClipSpeed = spd2;
        boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_backhand_2;
        const res2 = playBossAttackClip(boss, 'Combo_Backhand_2', spd2, 0.16);
        const realDur2 = res2?.ok && res2.duration > 0.2 ? res2.duration : (cfg2.endAt || cfg2.duration) / spd2;
        boss.soulsComboStageDur = Math.min(realDur2, (cfg2.endAt || cfg2.duration) / spd2 + 0.05);
        boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg2.impactAt / (cfg2.endAt || cfg2.duration));
        audio?.playBossFootstep?.();
        return { isMoving: false };
      }
      const continueToStage3 =
        boss.phase2Enraged ||
        recentRolls >= 1 ||
        dist <= 5.6 ||
        (sinceLastHit >= 0 && sinceLastHit <= 0.75) ||
        Math.random() < 0.80;
      if (stage === 2 && dist <= 8.2 && continueToStage3 && bossHasClip(boss, 'Combo_Slam_3')) {
        const cfg3 = SOULS_BOSS_CLIP_TIMINGS.Combo_Slam_3;
        const spd3 = cfg3.speed * p2SpdMult;
        boss.soulsComboStage = 3;
        boss.soulsMoveType = 'combo_slam_3';
        boss.soulsComboStageElapsed = 0;
        boss.soulsComboStageHitDone = false;
        boss.soulsClipSpeed = spd3;
        boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.combo_slam_3;
        // Randomly delay Stage 3 slam on roll-spam or 50% of casts (breaks dodge muscle memory!)
        boss._soulsDelayHoldArmed = recentRolls >= 1 || Math.random() < 0.50;
        boss._soulsDelayHoldRem = boss._soulsDelayHoldArmed ? (0.18 + Math.random() * 0.26) : 0;
        boss._soulsDelaySnapped = false;
        const res3 = playBossAttackClip(boss, 'Combo_Slam_3', spd3, 0.16);
        const realDur3 = res3?.ok && res3.duration > 0.2 ? res3.duration : (cfg3.endAt || cfg3.duration) / spd3;
        boss.soulsComboStageDur = Math.min(realDur3, (cfg3.endAt || cfg3.duration) / spd3 + 0.05);
        boss.soulsComboStageImpactAt = boss.soulsComboStageDur * (cfg3.impactAt / (cfg3.endAt || cfg3.duration));
        audio?.playBossFootstep?.();
        return { isMoving: false };
      }
      const pAC = SOULS_BOSS_PUNISH_PROFILES.aaa_combo;
      const tier = stage >= 3 ? pAC.tier : 'light';
      const recSec = stage >= 3 ? (phase2 ? pAC.recoverP2 : pAC.recoverP1) : (phase2 ? 0.46 : 0.62);
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
    let effDt = dt;
    // Variable-velocity delayed roll-catch hang on Heavy_Cleave windup apex!
    if (!boss.soulsHit1Done && boss._soulsDelayHoldArmed) {
      const hangStart = boss.soulsImpactAt * 0.54;
      const hangEnd = boss.soulsImpactAt * 0.82;
      if (prevT >= hangStart && prevT < hangEnd && (boss._soulsDelayHoldRem || 0) > 0 && !boss._soulsDelaySnapped) {
        boss._soulsDelayHoldRem = Math.max(0, boss._soulsDelayHoldRem - dt);
        effDt = dt * 0.36;
        boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed * 0.36);
        if (boss.phase2Enraged && Math.random() < dt * 18) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 0.6, 2.8, boss.z + boss.soulsStrikeDirZ * 0.6, 0xfde047, 1, 3.0, 0.13);
        }
      } else if (prevT >= hangEnd || (prevT >= hangStart && (boss._soulsDelayHoldRem || 0) <= 0)) {
        if (!boss._soulsDelaySnapped) {
          boss._soulsDelaySnapped = true;
          boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed * 1.45);
        }
        effDt = dt * 1.45;
      }
    }
    boss.soulsAttackElapsed += effDt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const trackCutoffClipT = cfg.impactAt * cfg.trackingCutoff01;

    if (!boss.soulsHit1Done && clipT < trackCutoffClipT) {
      stepBossTurn(
        boss,
        angToPlayerLead,
        boss.soulsQuickTurn ? SOULS_BOSS_GOAL_CFG.turnRateQuickTurnRad : SOULS_BOSS_GOAL_CFG.turnRateWindupRad,
        dt
      );
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    const windEndOH = Math.max(0.08, boss.soulsImpactAt * 0.82);
    const actEndOH = Math.min(boss.soulsAttackDur, boss.soulsImpactAt + 0.16);
    if (t < windEndOH) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp(t / windEndOH, 0, 1);
    } else if (t <= actEndOH) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((t - windEndOH) / Math.max(0.05, actEndOH - windEndOH), 0, 1);
    } else {
      boss.soulsPosturePhase = 'recover';
      boss.soulsPosturePhase01 = clamp((t - actEndOH) / Math.max(0.05, boss.soulsAttackDur - actEndOH), 0, 1);
    }
    // Exact 1:1 root-motion step synced to Heavy_Cleave Left-boot stomp [0.40s .. 0.98s] (1.05m, zero foot slip!)
    const cleaveStep = sampleWindowStep(prevClipT, clipT, 0.40, 0.98, 1.05, easeAttackDrive);
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
    if (prevClipT < 0.98 && clipT >= 0.98) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.5, 0.14, boss.z + boss.soulsStrikeDirZ * 0.5, 0xd6d3d1, 7, 3.0, 0.12);
    }

    if (!boss.soulsHit1Done && t >= boss.soulsImpactAt) {
      boss.soulsHit1Done = true;
      boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed);
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
      const reach = 4.65;
      const impX = boss.x + boss.soulsStrikeDirX * 2.0;
      const impZ = boss.z + boss.soulsStrikeDirZ * 2.0;
      playBossWhooshSfx(audio, true);
      playBossHammerGroundSfx(audio);
      world?.addScreenShake?.(0.38, 0.20);
      world?.spawnBossGroundFracture?.({
        x: impX,
        z: impZ,
        radius: 3.15,
        shape: 'circle',
        kind: 'circle',
        molten: Boolean(boss.phase2Enraged),
        duration: boss.phase2Enraged ? 1.0 : 2.05
      });
      emitShockwave(impX, impZ, 3.05, boss.phase2Enraged ? 0xf97316 : 0xa8a29e, 0.34);
      if (boss.phase2Enraged) {
        emitParticles(impX, 0.35, impZ, 0xf97316, 18, 6.0, 0.15);
      }
      emitParticles(impX, 0.22, impZ, 0xd6d3d1, 16, 4.8, 0.14);
      armBossActiveSwing({
        kind: 'arc', sAng, reach, halfCone: Math.PI * 0.50, bodyGrace: 2.55, dur: 0.15,
        damage: boss.soulsQuickTurn ? Math.round(boss.damage * 0.92) : boss.damage,
        payload: strikeHitPayload(boss.currentAttackMeta)
      });
      tickBossActiveSwing();
      // Phase 2 NEW ATTACK: Molten Fissure Wave on ash_fissure or non-quick Heavy_Cleave!
      if (boss.phase2Enraged && (boss._soulsForceFissure || !boss.soulsQuickTurn)) {
        spawnPhase2MoltenFissure(impX, impZ, boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
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
    const clipSpeed = boss.soulsClipSpeed || cfg.speed;
    const prevT = boss.soulsAttackElapsed;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const hit1TrackEnd = cfg.hit1At * cfg.trackingCutoff01;
    const hit2TrackEnd = cfg.hit1At + (cfg.hit2At - cfg.hit1At) * cfg.trackingCutoff01;

    // Late 86% tracking cutoff with lateral strafe lead before each locked sweep strike!
    if (!boss.soulsHit1Done && clipT < hit1TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.05, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && clipT < hit2TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.15, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    if (!boss.soulsHit1Done) {
      const w1 = Math.max(0.1, boss.soulsHit1At * 0.84);
      boss.soulsPosturePhase = t < w1 ? 'windup' : 'active';
      boss.soulsPosturePhase01 = t < w1 ? clamp(t / w1, 0, 1) : clamp((t - w1) / Math.max(0.05, boss.soulsHit1At - w1), 0, 1);
    } else if (!boss.soulsHit2Done) {
      const span2 = Math.max(0.15, boss.soulsHit2At - boss.soulsHit1At);
      const w2 = boss.soulsHit1At + span2 * 0.78;
      boss.soulsPosturePhase = t < w2 ? 'windup' : 'active';
      boss.soulsPosturePhase01 = t < w2 ? clamp((t - boss.soulsHit1At) / Math.max(0.08, w2 - boss.soulsHit1At), 0, 1) : clamp((t - w2) / Math.max(0.05, boss.soulsHit2At - w2), 0, 1);
    } else {
      const act2End = boss.soulsHit2At + 0.16;
      boss.soulsPosturePhase = t <= act2End ? 'active' : 'recover';
      boss.soulsPosturePhase01 = t <= act2End ? 1.0 : clamp((t - act2End) / Math.max(0.1, boss.soulsAttackDur - act2End), 0, 1);
    }
    // Exact 1:1 root-motion steps synced to Sweep_Combo:
    //   Step 1: Left boot [1.30s .. 1.98s] -> 0.96m
    //   Step 2: Right boot [2.38s .. 2.92s] -> 1.04m (zero lateral skating!)
    const sweepFwd1 = sampleWindowStep(prevClipT, clipT, 1.30, 1.98, 0.96, easeAttackDrive);
    if (sweepFwd1 > 0) {
      advanceBossWithCollision(
        boss,
        boss.soulsStrikeDirX,
        boss.soulsStrikeDirZ,
        sweepFwd1,
        player,
        resolveObstaclesAndBounds
      );
    }
    if (prevClipT < 1.98 && clipT >= 1.98) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.45, 0.14, boss.z + boss.soulsStrikeDirZ * 0.45, 0xd6d3d1, 6, 2.8, 0.12);
    }

    const sweepStep2 = sampleWindowStep(prevClipT, clipT, 2.38, 2.92, 1.04, easeAttackDrive);
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
    if (prevClipT < 2.92 && clipT >= 2.92) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.5, 0.14, boss.z + boss.soulsStrikeDirZ * 0.5, 0xd6d3d1, 7, 3.0, 0.12);
    }

    if (!boss.soulsHit1Done) {
      if (t >= boss.soulsHit1At) {
        boss.soulsHit1Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach1 = 4.65;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.24, 0.14);
        if (boss.phase2Enraged) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 2.2, 1.25, boss.z + boss.soulsStrikeDirZ * 2.2, 0xf97316, 10, 5.0, 0.13);
        }
        armBossActiveSwing({
          kind: 'arc', sAng, reach: reach1, halfCone: Math.PI * 0.62, bodyGrace: 2.55, dur: 0.15,
          damage: Math.round(boss.damage * 0.94), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.sweep_combo_1)
        });
        tickBossActiveSwing();

        if (boss.soulsState === 'sweep_combo' && boss.stunTimer <= 0) {
          boss.soulsMoveType = 'slash_backhand';
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.sweep_combo_2;
        }
      }
    } else if (!boss.soulsHit2Done) {
      if (t >= boss.soulsHit2At) {
        boss.soulsHit2Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        const reach2 = 4.80;
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.34, 0.18);
        if (boss.phase2Enraged) {
          emitParticles(boss.x + boss.soulsStrikeDirX * 2.3, 1.30, boss.z + boss.soulsStrikeDirZ * 2.3, 0xfbbf24, 14, 5.8, 0.14);
        }
        armBossActiveSwing({
          kind: 'arc', sAng, reach: reach2, halfCone: Math.PI * 0.65, bodyGrace: 2.60, dur: 0.15,
          damage: Math.round(boss.damage * 1.14), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.sweep_combo_2)
        });
        tickBossActiveSwing();
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
    const clipSpeed = boss.soulsClipSpeed || cfg.speed;
    const prevT = boss.soulsAttackElapsed;
    let effDt = dt;
    // Signature Elden Ring / Lies of P variable-velocity hang before Hit 3 slam -> snap crush!
    if (boss.soulsHit2Done && !boss.soulsHit3Done && boss._soulsDelayHoldArmed) {
      const hangStart = boss.soulsHit2At + (boss.soulsImpactAt - boss.soulsHit2At) * 0.42;
      const hangEnd = boss.soulsHit2At + (boss.soulsImpactAt - boss.soulsHit2At) * 0.78;
      if (prevT >= hangStart && prevT < hangEnd && (boss._soulsDelayHoldRem || 0) > 0 && !boss._soulsDelaySnapped) {
        boss._soulsDelayHoldRem = Math.max(0, boss._soulsDelayHoldRem - dt);
        effDt = dt * 0.34;
        boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed * 0.34);
        stepBossTurn(boss, angToPlayerLead, 6.2, dt);
        boss.soulsStrikeDirX = Math.sin(boss.facing);
        boss.soulsStrikeDirZ = Math.cos(boss.facing);
      } else if (prevT >= hangEnd || (prevT >= hangStart && (boss._soulsDelayHoldRem || 0) <= 0)) {
        if (!boss._soulsDelaySnapped) {
          boss._soulsDelaySnapped = true;
          boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed * 1.56);
        }
        effDt = dt * 1.56;
      }
    }
    boss.soulsAttackElapsed += effDt;
    const t = boss.soulsAttackElapsed;
    const prevClipT = prevT * clipSpeed;
    const clipT = t * clipSpeed;
    const hit1TrackEnd = cfg.hit1At * cfg.trackingCutoff01;
    const hit2TrackEnd = cfg.hit1At + (cfg.hit2At - cfg.hit1At) * cfg.trackingCutoff01;
    const hit3TrackEnd = cfg.hit2At + (cfg.impactAt - cfg.hit2At) * 0.86;

    if (!boss.soulsHit1Done && clipT < hit1TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit1Done && !boss.soulsHit2Done && clipT < hit2TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.1, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    } else if (boss.soulsHit2Done && !boss.soulsHit3Done && clipT < hit3TrackEnd) {
      stepBossTurn(boss, angToPlayerLead, SOULS_BOSS_GOAL_CFG.turnRateWindupRad * 1.1, dt);
      boss.soulsStrikeDirX = Math.sin(boss.facing);
      boss.soulsStrikeDirZ = Math.cos(boss.facing);
    }

    if (!boss.soulsHit1Done) {
      const w1 = Math.max(0.1, boss.soulsHit1At * 0.82);
      boss.soulsPosturePhase = t < w1 ? 'windup' : 'active';
      boss.soulsPosturePhase01 = t < w1 ? clamp(t / w1, 0, 1) : clamp((t - w1) / Math.max(0.05, boss.soulsHit1At - w1), 0, 1);
    } else if (!boss.soulsHit2Done) {
      const w2 = boss.soulsHit1At + Math.max(0.1, (boss.soulsHit2At - boss.soulsHit1At) * 0.78);
      boss.soulsPosturePhase = t < w2 ? 'windup' : 'active';
      boss.soulsPosturePhase01 = t < w2 ? clamp((t - boss.soulsHit1At) / Math.max(0.06, w2 - boss.soulsHit1At), 0, 1) : clamp((t - w2) / Math.max(0.05, boss.soulsHit2At - w2), 0, 1);
    } else if (!boss.soulsHit3Done) {
      const w3 = boss.soulsHit2At + Math.max(0.1, (boss.soulsImpactAt - boss.soulsHit2At) * 0.82);
      boss.soulsPosturePhase = t < w3 ? 'windup' : 'active';
      boss.soulsPosturePhase01 = t < w3 ? clamp((t - boss.soulsHit2At) / Math.max(0.08, w3 - boss.soulsHit2At), 0, 1) : clamp((t - w3) / Math.max(0.05, boss.soulsImpactAt - w3), 0, 1);
    } else {
      const act3End = boss.soulsImpactAt + 0.16;
      boss.soulsPosturePhase = t <= act3End ? 'active' : 'recover';
      boss.soulsPosturePhase01 = t <= act3End ? 1.0 : clamp((t - act3End) / Math.max(0.1, boss.soulsAttackDur - act3End), 0, 1);
    }
    // Exact 1:1 root-motion 3-step forward drive synced to Delayed_Crush Left -> Right -> Colossal Left Slam Stomp!
    const crushStep =
      sampleWindowStep(prevClipT, clipT, 0.52, 0.98, 0.88, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 1.20, 1.62, 0.94, easeAttackDrive) +
      sampleWindowStep(prevClipT, clipT, 2.06, 2.66, 1.08, easeAttackDrive);
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
    if (
      (prevClipT < 0.98 && clipT >= 0.98) ||
      (prevClipT < 1.62 && clipT >= 1.62) ||
      (prevClipT < 2.66 && clipT >= 2.66)
    ) {
      audio?.playBossFootstep?.();
      emitParticles(boss.x + boss.soulsStrikeDirX * 0.5, 0.14, boss.z + boss.soulsStrikeDirZ * 0.5, 0xd6d3d1, 7, 3.0, 0.12);
    }

    if (!boss.soulsHit1Done) {
      if (t >= boss.soulsHit1At) {
        boss.soulsHit1Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.22, 0.12);
        armBossActiveSwing({
          kind: 'arc', sAng, reach: 4.55, halfCone: Math.PI * 0.58, bodyGrace: 2.5, dur: 0.13,
          damage: Math.round(boss.damage * 0.88), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_1)
        });
        tickBossActiveSwing();
        if (boss.soulsState === 'delayed_crush' && boss.stunTimer <= 0) {
          boss.soulsMoveType = 'slash_backhand';
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_2;
        }
      }
    } else if (!boss.soulsHit2Done) {
      if (t >= boss.soulsHit2At) {
        boss.soulsHit2Done = true;
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const sAng = Math.atan2(boss.soulsStrikeDirX, boss.soulsStrikeDirZ);
        playBossWhooshSfx(audio, true);
        world?.addScreenShake?.(0.26, 0.14);
        armBossActiveSwing({
          kind: 'arc', sAng, reach: 4.70, halfCone: Math.PI * 0.62, bodyGrace: 2.55, dur: 0.13,
          damage: Math.round(boss.damage * 0.98), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_2)
        });
        tickBossActiveSwing();
        if (boss.soulsState === 'delayed_crush' && boss.stunTimer <= 0) {
          boss.soulsTelegraph3Done = true;
          boss.soulsMoveType = 'delayed_crush';
          boss.currentAttackMeta = SOULS_BOSS_ATTACK_META.delayed_crush_3;
        }
      }
    } else if (!boss.soulsHit3Done) {
      if (boss.phase2Enraged && Math.random() < dt * 22) {
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
        boss.model?.handle?.setActiveAttackTimeScale?.(clipSpeed);
        cancelSoulsBossTelegraph(boss, elapsedTime);
        const impX = boss.x + boss.soulsStrikeDirX * 2.15;
        const impZ = boss.z + boss.soulsStrikeDirZ * 2.15;
        const slamR = 4.45;
        playBossHammerGroundSfx(audio);
        world?.addScreenShake?.(0.56, 0.30);
        world?.spawnBossGroundFracture?.({
          x: impX,
          z: impZ,
          radius: slamR,
          shape: 'circle',
          kind: 'circle',
          molten: Boolean(boss.phase2Enraged),
          duration: boss.phase2Enraged ? 1.0 : 2.25
        });
        emitShockwave(impX, impZ, slamR * 0.95, boss.phase2Enraged ? 0xf97316 : 0xa8a29e, 0.42);
        if (boss.phase2Enraged) {
          emitParticles(impX, 0.45, impZ, 0xf97316, 26, 7.8, 0.16);
        }
        emitParticles(impX, 0.28, impZ, 0xd6d3d1, 24, 6.2, 0.15);
        armBossActiveSwing({
          kind: 'slam', impX, impZ, radius: slamR, dur: 0.16,
          damage: Math.round(boss.damage * 1.38), payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.delayed_crush_3)
        });
        tickBossActiveSwing();
        // Phase 2 NEW SIGNATURE: Delayed Volcanic Crater Aftershock 0.58s later!
        if (boss.phase2Enraged) {
          spawnPhase2VolcanicAftershock(impX, impZ);
        }
      }
    }

    if (t >= boss.soulsAttackDur) {
      // Phase 2 occasional flank-punish branch ONLY if player hugs behind Boss (< 30%, preserves earned punish window!)
      if (boss.phase2Enraged && (boss.soulsChainCount || 0) < 1 && dist <= 4.3 && relAngFromFront > 1.35 && Math.random() < 0.28) {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        launchAttack('backhand_counter', { goalTag: 'combo_branch', silentText: true });
        return { isMoving: false };
      }
      const pDC = SOULS_BOSS_PUNISH_PROFILES.delayed_crush;
      enterRecover(phase2 ? pDC.recoverP2 : pDC.recoverP1, pDC.tier);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // G. ATTACK 4 — LEAP SLAM (+30% Unblockable Roll-Dodgeable AoE + 2.25s 4-Heave Stuck-Hammer Extraction!)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'leap_slam') {
    const cfg = SOULS_BOSS_CLIP_TIMINGS.Leap_Slam;
    boss.soulsAttackElapsed += dt;
    const t = boss.soulsAttackElapsed;

    const flightStart = boss.soulsFlightStartAt ?? boss.soulsTakeoffAt;
    const airTrackUntil = flightStart + (boss.soulsLandMoveEndAt - flightStart) * 0.38;
    boss._soulsAirborne = Boolean(t >= flightStart && !boss.soulsHit1Done && t < boss.soulsImpactAt);

    if (t < flightStart) {
      boss.soulsPosturePhase = 'windup';
      boss.soulsPosturePhase01 = clamp(t / Math.max(0.08, flightStart), 0, 1);
    } else if (!boss.soulsHit1Done && t < boss.soulsImpactAt) {
      boss.soulsPosturePhase = 'active';
      boss.soulsPosturePhase01 = clamp((t - flightStart) / Math.max(0.1, boss.soulsImpactAt - flightStart), 0, 1);
    } else {
      boss.soulsPosturePhase = 'recover';
      boss.soulsPosturePhase01 = clamp(
        (t - boss.soulsImpactAt) / Math.max(0.1, boss.soulsAttackDur - boss.soulsImpactAt),
        0,
        1
      );
    }
    if (!boss.soulsLeapSfxPlayed && t >= (boss.soulsTakeoffAt || 0)) {
      boss.soulsLeapSfxPlayed = true;
      playBossLeapSfx(audio);
    }
    // Live tracking through crouch AND early ascent so Leap_Slam intercepts fleeing & healing players!
    if (!boss.soulsHit1Done && t < airTrackUntil) {
      const predX = player.x + pvx * 0.20;
      const predZ = player.z + pvz * 0.20;
      const ldx = predX - boss.leapStartX;
      const ldz = predZ - boss.leapStartZ;
      const ldist = Math.hypot(ldx, ldz) || 0.001;
      const stepDist = clamp(ldist - 0.75, 2.8, maxLeapStepDist);
      const candEndX = boss.leapStartX + (ldx / ldist) * stepDist;
      const candEndZ = boss.leapStartZ + (ldz / ldist) * stepDist;
      const safeLive = resolveObstaclesAndBounds
        ? resolveObstaclesAndBounds(candEndX, candEndZ, boss.radius, ARENA_ENTITY_LIMIT)
        : clampBossToSoulsHallFallback(candEndX, candEndZ, boss.radius);
      const trackBlend = clamp(dt * (t < flightStart ? 10.5 : 5.2), 0, 1);
      boss.leapEndX += (safeLive.x - boss.leapEndX) * trackBlend;
      boss.leapEndZ += (safeLive.z - boss.leapEndZ) * trackBlend;
      stepBossTurn(boss, Math.atan2(boss.leapEndX - boss.x, boss.leapEndZ - boss.z), 9.5, dt);
    }
    if (!boss.soulsHit1Done && t >= flightStart && t <= boss.soulsLandMoveEndAt) {
      const u = clamp((t - flightStart) / Math.max(0.05, boss.soulsLandMoveEndAt - flightStart), 0, 1);
      const ease = u * u * (3 - 2 * u);
      const candX = boss.leapStartX + (boss.leapEndX - boss.leapStartX) * ease;
      const candZ = boss.leapStartZ + (boss.leapEndZ - boss.leapStartZ) * ease;
      const safeAir = resolveObstaclesAndBounds
        ? resolveObstaclesAndBounds(candX, candZ, boss.radius, ARENA_ENTITY_LIMIT)
        : clampBossToSoulsHallFallback(candX, candZ, boss.radius);
      boss.x = safeAir.x;
      boss.z = safeAir.z;
      stepBossTurn(boss, Math.atan2(boss.leapEndX - boss.leapStartX, boss.leapEndZ - boss.leapStartZ), 7.5, dt);
    }

    if (!boss.soulsHit1Done && t >= boss.soulsImpactAt) {
      boss.soulsHit1Done = true;
      boss._soulsAirborne = false;
      boss._leapWrenchMask = 0;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      // Play 1.75s..4.05s stuck-hammer 4-heave extraction at exact 1.0x speed for a full 2.25s vulnerable window!
      boss.model?.handle?.setActiveAttackTimeScale?.(cfg.extractSpeed || 1.0);
      boss.vx = 0;
      boss.vz = 0;

      // +30% AoE impact radius (4.25m * 1.30 = 5.53m — unblockable by regular shield block, 100% dodgeable by roll i-frames!)
      const slamR = +(4.25 * 1.30).toFixed(2);
      const craterX = boss.x + Math.sin(boss.facing || 0) * 1.25;
      const craterZ = boss.z + Math.cos(boss.facing || 0) * 1.25;
      boss._leapCraterX = craterX;
      boss._leapCraterZ = craterZ;
      boss.hx = craterX;
      boss.hz = craterZ;

      // Open earned Heavy Punish Window for the entire 2.25s stuck-hammer extraction!
      const pLS = SOULS_BOSS_PUNISH_PROFILES.leap_slam;
      const extractPunishSec = cfg.extractSec || 2.25;
      boss.soulsPunishWindow = pLS.tier;
      boss.soulsPunishTimer = extractPunishSec;
      boss.soulsPunishDmgMult = PUNISH_DMG_MULT[pLS.tier] || 1.25;
      boss.soulsPunishStaggerMult = PUNISH_STAGGER_MULT[pLS.tier] || 1.45;
      boss.soulsPunishTagShown = false;
      boss.soulsChainCount = 0;

      playBossHammerGroundSfx(audio);
      world?.addScreenShake?.(0.60, 0.32);
      world?.spawnBossGroundFracture?.({
        x: craterX,
        z: craterZ,
        radius: slamR,
        shape: 'circle',
        kind: 'circle',
        molten: Boolean(boss.phase2Enraged),
        duration: boss.phase2Enraged ? 1.0 : 2.65
      });
      emitShockwave(craterX, craterZ, slamR * 0.96, boss.phase2Enraged ? 0xf97316 : 0xa8a29e, 0.44);
      if (boss.phase2Enraged) {
        emitParticles(craterX, 0.45, craterZ, 0xf97316, 28, 8.2, 0.17);
      }
      emitParticles(craterX, 0.28, craterZ, 0xd6d3d1, 26, 6.6, 0.15);
      armBossActiveSwing({
        kind: 'slam',
        impX: boss.x,
        impZ: boss.z,
        radius: slamR,
        dur: 0.16,
        damage: Math.round(boss.damage * 1.30),
        payload: strikeHitPayload(SOULS_BOSS_ATTACK_META.leap_slam, {
          canBlock: false,
          unblockable: true,
          canParry: false,
          parryable: false
        })
      });
      tickBossActiveSwing();
      // Phase 2 Volcanic Aftershock (`shape: 'circle', duration: 1.0s` so ground fire clears quickly for punish!)
      if (boss.phase2Enraged) {
        spawnPhase2VolcanicAftershock(craterX, craterZ);
      }
    }

    // Stationary 2.25s Stuck-Hammer 4-Heave Extraction on the ground (+0.45s, +0.90s, +1.40s, +1.90s)!
    if (boss.soulsHit1Done) {
      boss.vx = 0;
      boss.vz = 0;
      if ((boss.soulsPunishTimer || 0) > 0) {
        boss.soulsPunishTimer = Math.max(0, boss.soulsPunishTimer - dt);
        if (boss.soulsPunishTimer <= 0) {
          clearSoulsBossPunishWindow(boss);
        }
      }
      const sinceImpact = Math.max(0, t - boss.soulsImpactAt);
      const wrenchOffsets = [0.45, 0.90, 1.40, 1.90];
      const cx = Number.isFinite(boss._leapCraterX) ? boss._leapCraterX : boss.x;
      const cz = Number.isFinite(boss._leapCraterZ) ? boss._leapCraterZ : boss.z;
      for (let wIdx = 0; wIdx < wrenchOffsets.length; wIdx++) {
        const bit = 1 << wIdx;
        if (!(boss._leapWrenchMask & bit) && sinceImpact >= wrenchOffsets[wIdx]) {
          boss._leapWrenchMask |= bit;
          const pullIdx = wIdx + 1;
          ctx?.onBossHammerWrench?.(boss, pullIdx);
          emitParticles(
            cx,
            0.20,
            cz,
            pullIdx === 4 ? 0xa8a29e : 0xd6d3d1,
            pullIdx === 4 ? 16 : 9,
            pullIdx === 4 ? 4.8 : 3.2,
            0.13
          );
          if (pullIdx === 4) {
            audio?.playBossFootstep?.();
            world?.addScreenShake?.(0.18, 0.10);
          }
        }
      }
    }

    if (t >= boss.soulsAttackDur) {
      boss._soulsAirborne = false;
      clearSoulsBossPunishWindow(boss);
      enterRecover(0.18, null);
    }
    return { isMoving: false };
  }

  // ------------------------------------------------------------------------
  // H. ATTACK 5 — WHIRL SPIN (Biomechanical Inertia Ramp: Slow Heft -> Peak Cyclone -> Heavy Decel!)
  // ------------------------------------------------------------------------
  if (boss.soulsState === 'whirl_windup') {
    const wDur = Math.max(0.1, SOULS_BOSS_CLIP_TIMINGS.Whirl_Spin.windupSec);
    const wU = clamp(1 - (boss.soulsTimer || 0) / wDur, 0, 1);
    boss.soulsPosturePhase = 'windup';
    boss.soulsPosturePhase01 = wU;
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    boss.model?.handle?.setClipOverride?.('Whirl_Spin', 0.36 + 0.22 * wU);
    // Reverse torso counter-coil (-1.2 rad/s) loading rotational inertia into the giant warhammer!
    boss.facing = normalizeAngle((boss.facing || 0) - dt * 1.20 * Math.sin(Math.PI * wU));
    if (boss.phase2Enraged && Math.random() < dt * 20) {
      emitParticles(boss.x, 1.35, boss.z, 0xf59e0b, 2, 3.8, 0.14);
    }
    if (boss.soulsTimer <= 0) {
      const cfg = SOULS_BOSS_CLIP_TIMINGS.Whirl_Spin;
      cancelSoulsBossTelegraph(boss, elapsedTime);
      const spinDur = phase2 ? cfg.p2SpinSec : cfg.p1SpinSec;
      boss.soulsState = 'whirl_spin';
      boss.soulsTimer = spinDur;
      boss.soulsSpinTotalDur = spinDur;
      // Footstep-synced rotational velocity matching Whirl_Spin's 4 circular boot steps / 1.20s loop
      // (~4.35 rad/s P1 / ~5.05 rad/s P2 -> ~1.5-2.0 grounded stomping revolutions, ZERO ice-skating!)
      boss.soulsSpinPeakVel = phase2 ? 5.05 : 4.35;
      boss.soulsSpinAngVel = 1.65;
      boss.soulsSpinStepClock = 0;
      boss.spinHitTimer = 0;
      boss.spinVfxTimer = 0;
      playBossWhooshSfx(audio, true);
      audio?.playBossFootstep?.();
      emitShockwave(boss.x, boss.z, 4.2, boss.phase2Enraged ? 0xf59e0b : 0xa8a29e, 0.32);
    }
    return { isMoving: false };
  }

  if (boss.soulsState === 'whirl_spin') {
    boss.soulsPosturePhase = 'active';
    boss.soulsTimer = Math.max(0, (boss.soulsTimer || 0) - dt);
    boss.spinHitTimer = Math.max(0, (boss.spinHitTimer || 0) - dt);
    boss.spinVfxTimer = Math.max(0, (boss.spinVfxTimer || 0) - dt);

    const totalSpinDur = Math.max(0.5, boss.soulsSpinTotalDur || (phase2 ? 2.65 : 2.25));
    const spinU = clamp(1 - boss.soulsTimer / totalSpinDur, 0, 1);
    boss.soulsPosturePhase01 = spinU;
    const peakVel = boss.soulsSpinPeakVel || (phase2 ? 5.05 : 4.35);
    const startVel = 1.65;
    const endVel = 0.48;
    let baseAngVel;
    if (spinU < 0.28) {
      // Heavy colossus acceleration overcoming warhammer inertia (0..28%)
      const kAcc = spinU / 0.28;
      const easeAcc = kAcc * kAcc * (3 - 2 * kAcc);
      baseAngVel = startVel + (peakVel - startVel) * easeAcc;
    } else if (spinU <= 0.70) {
      // Sustained foot-driven cyclone rotation (28..70%)
      baseAngVel = peakVel;
    } else {
      // Extended heavy rotational deceleration (70..100%) down to near-stop before braking plant!
      const kDec = (spinU - 0.70) / 0.30;
      const easeDec = kDec * kDec * (3 - 2 * kDec);
      baseAngVel = peakVel + (endVel - peakVel) * easeDec;
    }
    // Synchronize Whirl_Spin 4-step circular footwork speed 1:1 with live angular velocity (ZERO foot slip!)
    // At clipSpeed=1.0 (1.20s loop = 4 steps * 72 deg), zero-slip angular speed is ~4.15 rad/s.
    const clipSpeed = clamp(baseAngVel / 4.15, 0.55, 1.38);
    boss.soulsSpinStepClock = (boss.soulsSpinStepClock || 0) + dt * clipSpeed;
    // Biomechanical step-drive pulse: each armored boot plant accelerates the torso spin naturally!
    const stepPulse = 1.0 + 0.16 * Math.cos((boss.soulsSpinStepClock / 1.20) * Math.PI * 8.0);
    const curAngVel = baseAngVel * stepPulse;
    boss.soulsSpinAngVel = curAngVel;
    const velRatio = clamp(baseAngVel / 4.35, 0.32, 1.30);
    boss.model?.handle?.setClipOverride?.('Whirl_Spin', clipSpeed);

    boss.facing = normalizeAngle((boss.facing || 0) + dt * curAngVel);
    // Stomp-synced cyclone pursuit scaled by live angular momentum!
    const driftSpeed = moveSpeed * (phase2 ? 0.74 : 0.52) * clamp(0.45 + 0.60 * velRatio, 0.45, 1.12);
    if (dist > 2.0) {
      advanceBossWithCollision(boss, dx, dz, driftSpeed * dt, player, resolveObstaclesAndBounds);
    }

    if (boss.spinVfxTimer <= 0) {
      boss.spinVfxTimer = clamp(0.30 / Math.max(0.55, clipSpeed), 0.21, 0.44);
      playBossWhooshSfx(audio, velRatio > 0.78);
      audio?.playBossFootstep?.();
      emitParticles(boss.x, 0.14, boss.z, 0xd6d3d1, 6, 3.0, 0.12);
      if (boss.phase2Enraged) {
        emitParticles(boss.x, 1.05, boss.z, 0xfbbf24, 5, 4.8, 0.13);
      }
    }

    if (dist <= 4.45 + player.radius * 0.45 && curAngVel >= 2.2 && boss.spinHitTimer <= 0) {
      boss.spinHitTimer = clamp(0.56 - 0.18 * velRatio, 0.36, 0.56);
      world?.addScreenShake?.(0.32, 0.16);
      applyDamageToPlayer(Math.round(boss.damage * 0.94), boss, strikeHitPayload(SOULS_BOSS_ATTACK_META.whirl_spin));
    }

    if (boss.soulsTimer <= 0) {
      boss.model?.handle?.setClipOverride?.(null);
      // Phase 2 NEW SIGNATURE: Cyclone chains straight into explosive Combo_Slam_3 + Burning Fire Circle!
      if (boss.phase2Enraged && dist <= 7.8 && bossHasClip(boss, 'Combo_Slam_3')) {
        boss.soulsChainCount = (boss.soulsChainCount || 0) + 1;
        launchAttack('cyclone_slam', { goalTag: 'combo_branch', silentText: true });
        return { isMoving: false };
      }
      playBossHammerGroundSfx(audio);
      emitShockwave(boss.x, boss.z, 3.8, boss.phase2Enraged ? 0xd97706 : 0xa8a29e, 0.32);
      if (boss.phase2Enraged) {
        spawnPhase2VolcanicAftershock(boss.x, boss.z);
      }
      const pWS = SOULS_BOSS_PUNISH_PROFILES.whirl_spin;
      boss._whirlCoastTimer = 0.28;
      boss._whirlCoastVel = Math.max(0.45, Math.min(1.2, boss.soulsSpinAngVel || 0.6));
      enterRecover(phase2 ? pWS.recoverP2 : pWS.recoverP1, pWS.tier, 'Whirl_End');
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
    // Smooth residual rotational momentum coast-down during Whirl_End braking step (ZERO hard stop!)
    if ((boss._whirlCoastTimer || 0) > 0) {
      boss._whirlCoastTimer = Math.max(0, boss._whirlCoastTimer - dt);
      const coastFrac = boss._whirlCoastTimer / 0.28;
      boss.facing = normalizeAngle((boss.facing || 0) + dt * (boss._whirlCoastVel || 0.6) * coastFrac * coastFrac);
    } else {
      stepBossTurn(boss, angToPlayer, 2.2, dt);
    }

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
      const wasHeftPlaying = Boolean(boss._soulsRecoverHeftPlaying);
      boss._soulsRecoverHeftPlaying = false;
      boss.soulsPosturePhase = 'neutral';
      boss.soulsPosturePhase01 = 0;
      if (phase2 && !boss._soulsPhase2Done) {
        triggerPhase2Roar();
        return { isMoving: false };
      }
      // Animation-State Reading immediately post-recover: punish greedy mid-fight heal!
      if (tryFlaskPunish()) {
        return { isMoving: false };
      }
      if (wasHeftPlaying) {
        // Release any lingering Recover_Heft tail immediately so locomotion legs engage on frame 1!
        boss.model?.handle?.handoffToBase?.('Idle', 1.0, 0.14);
      }
      boss.soulsState = 'stalk';
      boss.soulsChainCount = 0;
      // Alive Elden Ring rhythm: 1–2 menacing armored circling/advancing steps between combinations
      // (eliminates monotonous non-stop spam while keeping active pressure & instant Estus flask punish!)
      boss.soulsTimer = boss.phase2Enraged ? 0.42 + Math.random() * 0.36 : 0.64 + Math.random() * 0.46;
      if ((boss.soulsStrafeTimer || 0) <= 0.4) {
        if (Math.random() < 0.45) boss.strafeDir = -boss.strafeDir;
        boss.soulsStrafeTimer = 2.0 + Math.random() * 0.8;
      }
      if (dist > SOULS_BOSS_GOAL_CFG.neutralMaxDist) {
        boss.soulsRhythmMode = 'stalk_advance';
        boss.soulsRhythmTimer = 1.4 + Math.random() * 0.6;
        boss.soulsGoal = 'stalk_advance';
      } else {
        boss.soulsRhythmMode = 'circle_strafe';
        boss.soulsRhythmTimer = 1.8 + Math.random() * 0.7;
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
  boss.soulsPosturePhase = 'neutral';
  boss.soulsPosturePhase01 = 0;
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
    const prevMove = recentMoves[recentMoves.length - 1] || null;
    if (cd.ram_thrust_hook <= 0 && prevMove !== 'ram_thrust_hook' && Math.random() < 0.45) {
      launchAttack('ram_thrust_hook', { goalTag: 'guard_break_punish' });
    } else if (cd.delayed_crush <= 0 && prevMove !== 'delayed_crush') {
      launchAttack('delayed_crush', { goalTag: 'guard_break_punish' });
    } else if (cd.rising_upcut <= 0 && prevMove !== 'rising_upcut') {
      launchAttack('rising_upcut', { goalTag: 'guard_break_punish' });
    } else if (prevMove !== 'overhead_cleave') {
      launchAttack('overhead_cleave', { goalTag: 'guard_break_punish' });
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
    const prevMove = recentMoves[recentMoves.length - 1] || null;
    if (cd.ram_thrust_hook <= 0 && prevMove !== 'ram_thrust_hook' && dist >= 3.6 && Math.random() < 0.45) {
      launchAttack('ram_thrust_hook', { goalTag: 'roll_catch_punish', silentText: true });
    } else if (cd.delayed_crush <= 0 && prevMove !== 'delayed_crush') {
      launchAttack('delayed_crush', { goalTag: 'roll_catch_punish', silentText: true });
    } else if (cd.rising_upcut <= 0 && prevMove !== 'rising_upcut') {
      launchAttack('rising_upcut', { goalTag: 'roll_catch_punish', silentText: true });
    } else if (cd.aaa_combo <= 0 && prevMove !== 'aaa_combo' && bossHasClip(boss, 'Combo_Sweep_1')) {
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
  // Aggressive Elden Ring spacing: never backstep politely away from close range — advance & punish!
  if (dist > goalCfg.neutralMaxDist + 0.20) {
    boss.soulsRhythmMode = 'stalk_advance';
  } else if (dist < goalCfg.neutralMinDist - 0.25 && boss.soulsTimer > 0.16) {
    boss.soulsRhythmMode = 'circle_strafe';
  }

  const radX = dx / dist;
  const radZ = dz / dist;
  const tanX = -radZ * boss.strafeDir;
  const tanZ = radX * boss.strafeDir;

  let moveX = 0;
  let moveZ = 0;
  let desiredSpeed = 0;

  if (boss.soulsRhythmMode === 'stalk_advance' || dist > goalCfg.neutralMaxDist || boss.soulsTimer <= 0.15) {
    boss.soulsGoal = 'stalk_advance';
    const radialPull = dist > 2.8 ? 0.96 : 0.48;
    moveX = radX * radialPull + tanX * 0.22;
    moveZ = radZ * radialPull + tanZ * 0.22;
    desiredSpeed = moveSpeed * (boss.phase2Enraged ? 1.18 : 1.02);
  } else {
    boss.soulsGoal = 'circle_strafe';
    const radialCorr = clamp((dist - 3.35) * 0.34, -0.22, 0.38);
    moveX = radX * radialCorr + tanX * 0.94;
    moveZ = radZ * radialCorr + tanZ * 0.94;
    desiredSpeed = moveSpeed * (boss.phase2Enraged ? 0.94 : 0.82);
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
    // Project ACTUAL post-collision velocity (not pre-clamp steerDir!) onto character-local axes
    // so sliding tangentially around player/pillar plays Strafe_* instead of forward Walking!
    const cosF = Math.cos(boss.facing);
    const sinF = Math.sin(boss.facing);
    const velMag = Math.hypot(boss._soulsSmoothVx || 0, boss._soulsSmoothVz || 0);
    const mDirX = velMag > 0.15 ? boss._soulsSmoothVx / velMag : steerDirX;
    const mDirZ = velMag > 0.15 ? boss._soulsSmoothVz / velMag : steerDirZ;
    const leftDot = mDirX * cosF - mDirZ * sinF;
    const fwdDot = mDirX * sinF + mDirZ * cosF;
    const absLeftDot = Math.abs(leftDot);

    let activeStrafe = boss._soulsActiveStrafeClip || null;
    const backThreshold = activeStrafe === 'backstep' ? -0.38 : -0.58;
    if (fwdDot < backThreshold) {
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

  // Goal Priority 4: Varied Tactical Move Selection w/ 2-move `_recentMoves` anti-repeat ring
  // Actively mixes all 7–8 moves across close & mid range in BOTH Phase 1 and Phase 2 with ZERO back-to-back repeats!
  if (boss.soulsTimer <= 0) {
    const prevMove1 = recentMoves[recentMoves.length - 1] || null;
    const prevMove2 = recentMoves.length >= 2 ? recentMoves[0] : null;
    const pickWeightedAntiRepeat = (rawPool, fallbackId = 'overhead_cleave') => {
      let filtered = rawPool.filter((c) => c.id !== prevMove1);
      if (filtered.length > 1 && prevMove2) {
        const ringFiltered = filtered.filter((c) => c.id !== prevMove2);
        if (ringFiltered.length > 0) filtered = ringFiltered;
      }
      if (filtered.length === 0) {
        filtered = rawPool.length > 0 ? rawPool : [{ id: fallbackId, weight: 1 }];
      }
      let total = 0;
      for (let i = 0; i < filtered.length; i++) total += filtered[i].weight;
      let roll = Math.random() * total;
      let picked = filtered[filtered.length - 1].id;
      for (let i = 0; i < filtered.length; i++) {
        roll -= filtered[i].weight;
        if (roll <= 0) {
          picked = filtered[i].id;
          break;
        }
      }
      return picked;
    };

    // 1. Mid-Far Range (dist > 6.2m): mix Ram_Thrust_Hook (3.8m battering-ram gap-closer), Leap_Slam, and Phase-2 Ash_Fissure!
    if (dist > 6.2) {
      const hasLOS = hasBossLineOfSightToPlayer(boss, player, world, ctx.obstacles);
      const farPool = [];
      if (dist <= 8.6 && cd.ram_thrust_hook <= 0 && hasLOS) {
        farPool.push({ id: 'ram_thrust_hook', weight: 38 });
      }
      if (dist <= maxLeapRange && cd.leap_slam <= 0 && hasLOS) {
        farPool.push({ id: 'leap_slam', weight: 34 });
      }
      if (boss.phase2Enraged && dist <= 11.4 && (cd.ash_fissure || 0) <= 0 && hasLOS) {
        farPool.push({ id: 'ash_fissure', weight: 36 });
      }
      const nonRepeatFar = farPool.filter((c) => c.id !== prevMove1);
      if (nonRepeatFar.length > 0) {
        const pickedFar = pickWeightedAntiRepeat(nonRepeatFar, nonRepeatFar[0].id);
        launchAttack(pickedFar, pickedFar === 'ash_fissure' ? { forceFissure: true } : null);
        return { isMoving: false };
      }
    }

    // 2. Anti-backstab / flank read -> Surprise Backhand Counter, Whirl Spin, Rising Upcut, or fast turnaround Heavy_Cleave
    if (dist <= 5.2 && relAngFromFront > goalCfg.behindAngleRad) {
      if (bossHasClip(boss, 'Combo_Backhand_2') && prevMove1 !== 'backhand_counter' && Math.random() < 0.42) {
        launchAttack('backhand_counter');
        return { isMoving: false };
      }
      if (
        cd.whirl_spin <= 0 &&
        prevMove1 !== 'whirl_spin' &&
        ((boss.soulsBehindTimer || 0) >= 0.55 || (dist <= 4.0 && relAngFromFront > 1.55))
      ) {
        launchAttack('whirl_spin');
        return { isMoving: false };
      }
      if (cd.rising_upcut <= 0 && prevMove1 !== 'rising_upcut' && Math.random() < 0.48) {
        launchAttack('rising_upcut');
        return { isMoving: false };
      }
      if (prevMove1 !== 'overhead_cleave') {
        launchAttack('overhead_cleave', { quickTurnaround: true });
        return { isMoving: false };
      }
    }

    // 3. Tactical Close & Mid-Range Selection (dist <= 6.2m) in BOTH Phase 1 and Phase 2 — zero consecutive repeats!
    if (dist <= 6.2) {
      const rawPool = [];
      if (dist <= 5.0) rawPool.push({ id: 'overhead_cleave', weight: 24 });
      if (dist <= 5.8 && cd.rising_upcut <= 0) {
        rawPool.push({ id: 'rising_upcut', weight: 34 });
      }
      if (dist >= 2.4 && dist <= 6.2 && cd.ram_thrust_hook <= 0) {
        rawPool.push({ id: 'ram_thrust_hook', weight: dist > 4.0 ? 36 : 28 });
      }
      if (dist <= 5.8 && cd.aaa_combo <= 0 && (!boss?.model || bossHasClip(boss, 'Combo_Sweep_1'))) {
        rawPool.push({ id: 'aaa_combo', weight: 30 });
      }
      if (dist <= 5.6 && cd.sweep_combo <= 0) rawPool.push({ id: 'sweep_combo', weight: 26 });
      if (dist <= 6.2 && cd.delayed_crush <= 0) rawPool.push({ id: 'delayed_crush', weight: dist > 4.2 ? 30 : 22 });
      if (dist <= 4.6 && cd.whirl_spin <= 0) {
        rawPool.push({ id: 'whirl_spin', weight: boss.phase2Enraged ? 24 : 16 });
      }
      if (boss.phase2Enraged && dist >= 5.2 && (cd.ash_fissure || 0) <= 0) {
        rawPool.push({ id: 'ash_fissure', weight: 22 });
      }

      const fallbackAlt = prevMove1 === 'overhead_cleave' ? 'rising_upcut' : 'overhead_cleave';
      const picked = pickWeightedAntiRepeat(rawPool, fallbackAlt);
      launchAttack(picked, picked === 'ash_fissure' ? { forceFissure: true } : null);
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
