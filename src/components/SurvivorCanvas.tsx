import React, { useEffect, useRef } from 'react';
import {
  HEROES_CATALOG,
  MAX_ITEM_LEVEL,
  WEAPONS_CATALOG,
  WeaponId,
  WorldDefinition,
  WorldTeleporter,
} from '../data/gameCatalog';
import { PersistentSaveData, getActiveEquippedLevels } from '../utils/saveState';
import { soundEngine } from '../utils/soundEngine';

export interface ActiveEnemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  helmetColor: string;
  bodyColor: string;
  gunColor: string;
  name: string;
  isElite: boolean;
  isBoss: boolean;
  hitFlash: number;
  facingLeft: boolean;
  walkCycle: number;
}

export interface Projectile {
  id: number;
  weaponId: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  maxLife: number;
  color: string;
  isEvo: boolean;
  rotation: number;
  spinSpeed: number;
  hitEnemyIds: Set<number>;
  homing?: boolean;
  turnRate?: number;
  targetEnemyId?: number;
  bouncesLeft?: number;
  returningToPlayer?: boolean;
  explosionRadius?: number;
  trail?: { x: number; y: number }[];
}

export interface ExplosionRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface GroundHazard {
  id: number;
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
  life: number;
  maxLife: number;
  color: string;
  isEvo: boolean;
  tickTimer: number;
}

export interface LightningBolt {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
  isEvo: boolean;
  isLaserSweep?: boolean;
}

export interface DroppedItem {
  id: number;
  type: 'xp_green' | 'xp_blue' | 'xp_gold' | 'coin' | 'chest_rainbow' | 'magnet' | 'meat' | 'bomb';
  x: number;
  y: number;
  value: number;
  magnetized: boolean;
  bobPhase: number;
}

export interface DamageNumberPopup {
  id: number;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
}

export interface DeathGhost {
  id: number;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  radius: number;
}

export interface ImpactParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface SurvivorCanvasProps {
  saveData: PersistentSaveData;
  currentWorld: WorldDefinition;
  isPaused: boolean;
  spawnBossSignal: number;
  reviveSignal: number;
  onGainXpAndCoins: (xpDelta: number, goldDelta: number, killsDelta: number, bossesDelta: number) => void;
  onOpenRainbowChest: () => void;
  onPlayerPositionChange: (x: number, y: number) => void;
  onEnterTeleporter: (teleporter: WorldTeleporter) => void;
  onNearbyTeleporterChange: (teleporter: WorldTeleporter | null) => void;
  onActiveBossChange: (boss: { name: string; hp: number; maxHp: number } | null) => void;
  onHeroHpChange: (hp: number, maxHp: number) => void;
  onHeroDeath: (killedByName: string) => void;
}

export const SurvivorCanvas: React.FC<SurvivorCanvasProps> = ({
  saveData,
  currentWorld,
  isPaused,
  spawnBossSignal,
  reviveSignal,
  onGainXpAndCoins,
  onOpenRainbowChest,
  onPlayerPositionChange,
  onEnterTeleporter,
  onNearbyTeleporterChange,
  onActiveBossChange,
  onHeroHpChange,
  onHeroDeath,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const saveRef = useRef<PersistentSaveData>(saveData);
  saveRef.current = saveData;

  const worldRef = useRef<WorldDefinition>(currentWorld);
  const prevWorldIdRef = useRef<string>(currentWorld.id);
  const prevLevelRef = useRef<number>(saveData.level);

  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;

  const callbacksRef = useRef({
    onGainXpAndCoins,
    onOpenRainbowChest,
    onPlayerPositionChange,
    onEnterTeleporter,
    onNearbyTeleporterChange,
    onActiveBossChange,
    onHeroHpChange,
    onHeroDeath,
  });
  callbacksRef.current = {
    onGainXpAndCoins,
    onOpenRainbowChest,
    onPlayerPositionChange,
    onEnterTeleporter,
    onNearbyTeleporterChange,
    onActiveBossChange,
    onHeroHpChange,
    onHeroDeath,
  };

  const playerRef = useRef({
    x: saveData.playerX || 0,
    y: saveData.playerY || 0,
    hp: 360,
    maxHp: 360,
    isDead: false,
    hurtFlash: 0,
    facingAngle: -Math.PI / 2,
    facingLeft: false,
    walkCycle: 0,
    invulnTimer: 0,
    portalCooldown: 2.0,
    portalCharge: 0,
  });

  const joystickRef = useRef({
    active: false,
    pointerId: -1,
    originX: 0,
    originY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
  });

  const keysRef = useRef<Record<string, boolean>>({});
  const enemiesRef = useRef<ActiveEnemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<ExplosionRing[]>([]);
  const hazardsRef = useRef<GroundHazard[]>([]);
  const lightningsRef = useRef<LightningBolt[]>([]);
  const dropsRef = useRef<DroppedItem[]>([]);
  const popupsRef = useRef<DamageNumberPopup[]>([]);
  const ghostsRef = useRef<DeathGhost[]>([]);
  const particlesRef = useRef<ImpactParticle[]>([]);
  const nextEntityIdRef = useRef<number>(1);

  const durianRef = useRef({
    x: 90,
    y: -90,
    vx: 210,
    vy: 185,
    rotation: 0,
    hitTick: 0,
  });

  const weaponTimersRef = useRef<Partial<Record<WeaponId, number>>>({});

  const populateWorldInitialScene = (world: WorldDefinition, centerX: number, centerY: number) => {
    enemiesRef.current = [];
    projectilesRef.current = [];
    explosionsRef.current = [];
    hazardsRef.current = [];
    lightningsRef.current = [];
    dropsRef.current = [];
    ghostsRef.current = [];
    particlesRef.current = [];

    durianRef.current.x = centerX + 95;
    durianRef.current.y = centerY - 95;

    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'chest_rainbow',
      x: centerX,
      y: centerY - 190,
      value: 1,
      magnetized: false,
      bobPhase: 0,
    });

    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'chest_rainbow',
      x: centerX + 340,
      y: centerY - 420,
      value: 1,
      magnetized: false,
      bobPhase: 1.5,
    });

    const gemOffsets = [
      [-105, -75],
      [-58, -88],
      [15, -145],
      [32, -118],
      [28, -96],
      [75, -85],
      [-148, -12],
      [-86, 48],
      [-115, 62],
      [-72, 65],
      [-132, 96],
      [80, 52],
      [85, 68],
      [115, 76],
      [135, 60],
      [148, 60],
      [52, 108],
      [35, 118],
      [-142, 325],
      [-105, 325],
    ];
    for (const [ox, oy] of gemOffsets) {
      dropsRef.current.push({
        id: nextEntityIdRef.current++,
        type: 'xp_green',
        x: centerX + ox,
        y: centerY + oy,
        value: Math.max(4, Math.round(5 * Math.sqrt(world.xpMultiplier))),
        magnetized: false,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }

    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'magnet',
      x: centerX - 240,
      y: centerY - 220,
      value: 1,
      magnetized: false,
      bobPhase: 0,
    });
    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'meat',
      x: centerX + 240,
      y: centerY + 180,
      value: 1,
      magnetized: false,
      bobPhase: 0.7,
    });

    const curLvl = Math.max(1, saveRef.current.level);
    const activeW = getActiveEquippedLevels(saveRef.current);
    const curWeaponLevels = Object.values(activeW).map((v) => v || 0);
    const curEvoCount = curWeaponLevels.filter((v) => v >= MAX_ITEM_LEVEL).length;
    const curTotalWeapons = curWeaponLevels.reduce((acc, v) => acc + v, 0);
    const initialLevelHpMult =
      Math.pow(1.21, Math.min(35, curLvl - 1)) *
      (1 + (curLvl - 1) * 0.38) *
      (1 + curEvoCount * 0.42 + Math.max(0, curTotalWeapons - 3) * 0.08);
    const initialLevelDmgMult =
      1 + (curLvl - 1) * 0.24 + Math.pow(Math.max(0, curLvl - 1), 1.32) * 0.08;
    const initialSpeedMult = Math.min(1.85, 1 + (curLvl - 1) * 0.022);

    const initialEnemyPositions = [
      [-20, 355],
      [-48, 395],
      [6, 398],
      [96, 368],
      [-74, 300],
      [125, 290],
      [-150, -310],
      [140, -320],
    ];
    initialEnemyPositions.forEach(([ex, ey], idx) => {
      const template = world.enemyTypes[idx % world.enemyTypes.length];
      const baseHp = 950 * world.enemyHpMultiplier * template.hpRatio * initialLevelHpMult;
      enemiesRef.current.push({
        id: nextEntityIdRef.current++,
        x: centerX + ex,
        y: centerY + ey,
        vx: 0,
        vy: 0,
        radius: template.radius,
        hp: baseHp,
        maxHp: baseHp,
        speed: template.speed * initialSpeedMult,
        damage: 42 * world.enemyDamageMultiplier * initialLevelDmgMult,
        helmetColor: template.helmetColor,
        bodyColor: template.bodyColor,
        gunColor: template.gunColor,
        name: template.name,
        isElite: false,
        isBoss: false,
        hitFlash: 0,
        facingLeft: ex > 0,
        walkCycle: Math.random() * 10,
      });
    });

    popupsRef.current.push({
      id: nextEntityIdRef.current++,
      x: centerX - 74,
      y: centerY + 292,
      vy: -28,
      text: '1310',
      color: '#facc15',
      scale: 1.15,
      life: 0.9,
      maxLife: 0.9,
    });
  };

  useEffect(() => {
    if (prevWorldIdRef.current !== currentWorld.id) {
      prevWorldIdRef.current = currentWorld.id;
      worldRef.current = currentWorld;
      playerRef.current.x = 0;
      playerRef.current.y = 0;
      playerRef.current.portalCooldown = 2.5;
      playerRef.current.portalCharge = 0;
      populateWorldInitialScene(currentWorld, 0, 0);
      callbacksRef.current.onActiveBossChange(null);
    } else {
      worldRef.current = currentWorld;
    }
  }, [currentWorld]);

  useEffect(() => {
    if (reviveSignal <= 0) return;
    const p = playerRef.current;
    p.isDead = false;
    p.hp = p.maxHp;
    p.hurtFlash = 0;
    p.invulnTimer = 2.5;
    callbacksRef.current.onHeroHpChange(p.hp, p.maxHp);
    for (const nearE of enemiesRef.current) {
      if (!nearE.isBoss && Math.hypot(nearE.x - p.x, nearE.y - p.y) < 320) {
        nearE.hp = 0;
      }
    }
  }, [reviveSignal]);

  useEffect(() => {
    if (spawnBossSignal <= 0) return;
    const world = worldRef.current;
    const p = playerRef.current;
    const save = saveRef.current;
    const lvl = Math.max(1, save.level);
    const activeW = getActiveEquippedLevels(save);
    const wLevels = Object.values(activeW).map((v) => v || 0);
    const evoCount = wLevels.filter((v) => v >= MAX_ITEM_LEVEL).length;
    const totalWPower = wLevels.reduce((acc, v) => acc + v, 0);
    const bossLevelHpMult =
      Math.pow(1.21, Math.min(35, lvl - 1)) *
      (1 + (lvl - 1) * 0.38) *
      (1 + evoCount * 0.42 + Math.max(0, totalWPower - 3) * 0.08);
    const bossLevelDmgMult =
      1 + (lvl - 1) * 0.24 + Math.pow(Math.max(0, lvl - 1), 1.32) * 0.08;
    const bossHp = 18000 * world.enemyHpMultiplier * bossLevelHpMult;
    enemiesRef.current.push({
      id: nextEntityIdRef.current++,
      x: p.x,
      y: p.y - 260,
      vx: 0,
      vy: 0,
      radius: 38,
      hp: bossHp,
      maxHp: bossHp,
      speed: 64 * Math.min(1.65, 1 + (lvl - 1) * 0.018),
      damage: 95 * world.enemyDamageMultiplier * bossLevelDmgMult,
      helmetColor: world.bossColor,
      bodyColor: '#fde047',
      gunColor: '#18181b',
      name: world.bossName,
      isElite: true,
      isBoss: true,
      hitFlash: 0,
      facingLeft: false,
      walkCycle: 0,
    });
    soundEngine.playBossWarning();
  }, [spawnBossSignal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    populateWorldInitialScene(worldRef.current, playerRef.current.x, playerRef.current.y);

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrameId: number;
    let lastTime = performance.now();
    let spawnAccumulator = 0;
    let chestSpawnAccumulator = 0;
    let posSyncAccumulator = 0;
    let guardianAngle = 0;
    let companionAngle = 0;

    // Estadísticas del personaje combinando Casco Equipado + Armadura de Cuerpo + Pasivas + Tienda
    const getPlayerStats = () => {
      const s = saveRef.current;
      const activeEquipped = getActiveEquippedLevels(s);
      const hero = HEROES_CATALOG.find((h) => h.id === s.selectedHeroId) || HEROES_CATALOG[0];

      const atkShopMult = 1 + (s.permanentUpgrades.atk - 1) * 0.15;
      const hpShopMult = 1 + (s.permanentUpgrades.hp - 1) * 0.2;
      const speedShopMult = 1 + (s.permanentUpgrades.speed - 1) * 0.08;
      const magnetShopMult = 1 + (s.permanentUpgrades.magnet - 1) * 0.25;

      // Bonificaciones del Casco Equipado (Nivel 1..10)
      const visorLv = activeEquipped.helmet_visor || 0;
      const commandoHelmLv = activeEquipped.helmet_commando || 0;
      const neonHelmLv = activeEquipped.helmet_neon || 0;
      const voidHelmLv = activeEquipped.helmet_void || 0;

      // Bonificaciones de Armadura de Cuerpo Equipada (Nivel 1..10)
      const roninBodyLv = activeEquipped.armor_ronin || 0;
      const teslaBodyLv = activeEquipped.armor_tesla || 0;

      const bulletLv = s.passives.hi_power_bullet || 0;
      const fitnessLv = s.passives.fitness_guide || 0;
      const sneakersLv = s.passives.sneakers || 0;
      const cubeLv = s.passives.energy_cube || 0;
      const bracerLv = s.passives.exo_bracer || 0;
      const scrollLv = s.passives.scroll || 0;
      const goldLv = s.passives.gold_guide || 0;
      const drinkLv = s.passives.energy_drink || 0;
      const thrusterLv = s.passives.ammo_thruster || 0;
      const fuelLv = s.passives.he_fuel || 0;
      const magnetCoreLv = s.passives.magnet_core || 0;
      const armorPassiveLv = s.passives.ronin_armor || 0;

      const critChance = Math.min(
        0.8,
        0.12 + (s.permanentUpgrades.crit - 1) * 0.05 + visorLv * 0.03
      );
      const critDamage = 1.85 + (s.permanentUpgrades.crit - 1) * 0.25 + visorLv * 0.08;
      const greedMult = 1 + (s.permanentUpgrades.greed - 1) * 0.2;

      const levelBonusMult = 1 + (s.level - 1) * 0.12;
      const totalDamageMult =
        hero.atkMultiplier *
        atkShopMult *
        (1 + bulletLv * 0.18 + voidHelmLv * 0.18) *
        levelBonusMult;
      const maxHp = Math.round(
        360 *
          hero.hpMultiplier *
          hpShopMult *
          (1 + fitnessLv * 0.2 + commandoHelmLv * 0.2 + roninBodyLv * 0.25) *
          (1 + (s.level - 1) * 0.08)
      );
      const moveSpeed = 165 * hero.speedMultiplier * speedShopMult * (1 + sneakersLv * 0.12);
      const cooldownMult = Math.max(
        0.24,
        (Math.pow(0.92, cubeLv) * (1 - neonHelmLv * 0.025) * (1 - visorLv * 0.015)) /
          (1 + (s.permanentUpgrades.speed - 1) * 0.04)
      );
      const areaMult = 1 + bracerLv * 0.14 + fuelLv * 0.16;
      const projSpeedMult = 1 + thrusterLv * 0.18 + neonHelmLv * 0.04;
      const magnetRadius =
        92 * magnetShopMult * (1 + (sneakersLv + magnetCoreLv + neonHelmLv) * 0.35);
      const xpMult = 1 + (s.permanentUpgrades.greed - 1) * 0.08 + (scrollLv + visorLv) * 0.06;
      const goldMult = greedMult * (1 + goldLv * 0.25);
      const regenPerSec = maxHp * (drinkLv * 0.008 + voidHelmLv * 0.003);
      const damageReduction = Math.min(
        0.72,
        armorPassiveLv * 0.08 + commandoHelmLv * 0.03 + roninBodyLv * 0.03 + teslaBodyLv * 0.025
      );

      return {
        hero,
        activeEquipped,
        totalDamageMult,
        maxHp,
        moveSpeed,
        cooldownMult,
        areaMult,
        projSpeedMult,
        magnetRadius,
        xpMult,
        goldMult,
        regenPerSec,
        critChance,
        critDamage,
        damageReduction,
      };
    };

    const spawnParticles = (
      px: number,
      py: number,
      count: number,
      color: string,
      speedBase: number = 140,
      sizeBase: number = 4
    ) => {
      if (particlesRef.current.length > 160) return;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = speedBase * (0.45 + Math.random() * 0.9);
        const life = 0.25 + Math.random() * 0.28;
        particlesRef.current.push({
          id: nextEntityIdRef.current++,
          x: px + (Math.random() - 0.5) * 8,
          y: py + (Math.random() - 0.5) * 8,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          size: sizeBase * (0.7 + Math.random() * 0.7),
          color,
          life,
          maxLife: life,
        });
      }
    };

    const damageEnemy = (enemy: ActiveEnemy, baseAmount: number, knockbackStrength: number = 0) => {
      const stats = getPlayerStats();
      const isCrit = Math.random() < stats.critChance;
      const finalDamage = Math.max(
        1,
        Math.round(baseAmount * (isCrit ? stats.critDamage : 1) * (0.94 + Math.random() * 0.12))
      );

      enemy.hp -= finalDamage;
      enemy.hitFlash = 0.12;

      spawnParticles(
        enemy.x,
        enemy.y,
        isCrit ? 6 : 3,
        isCrit ? '#fde047' : '#86efac',
        isCrit ? 175 : 115,
        isCrit ? 4.5 : 3.2
      );

      if (knockbackStrength > 0 && !enemy.isBoss) {
        const dx = enemy.x - playerRef.current.x;
        const dy = enemy.y - playerRef.current.y;
        const dist = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / dist) * knockbackStrength;
        enemy.y += (dy / dist) * knockbackStrength;
      }

      soundEngine.playHit(isCrit);

      if (popupsRef.current.length < 50) {
        popupsRef.current.push({
          id: nextEntityIdRef.current++,
          x: enemy.x + (Math.random() - 0.5) * 16,
          y: enemy.y - enemy.radius - 4,
          vy: -38,
          text: String(finalDamage),
          color: isCrit ? '#facc15' : '#ffffff',
          scale: isCrit ? 1.22 : 0.96,
          life: 0.65,
          maxLife: 0.65,
        });
      }
    };

    const triggerAreaExplosion = (
      ex: number,
      ey: number,
      blastRadius: number,
      dmg: number,
      color: string
    ) => {
      explosionsRef.current.push({
        id: nextEntityIdRef.current++,
        x: ex,
        y: ey,
        radius: 10,
        maxRadius: blastRadius,
        color,
        life: 0.32,
        maxLife: 0.32,
      });
      spawnParticles(ex, ey, 12, color, 220, 5.2);
      spawnParticles(ex, ey, 6, '#fef08a', 150, 3.8);
      for (const e of enemiesRef.current) {
        if (Math.hypot(e.x - ex, e.y - ey) <= blastRadius + e.radius) {
          damageEnemy(e, dmg, 16);
        }
      }
    };

    let hpSyncAccumulator = 0;

    const updateSimulation = (dt: number, viewW: number, viewH: number) => {
      const p = playerRef.current;
      const world = worldRef.current;
      const save = saveRef.current;
      const stats = getPlayerStats();
      // ÚNICAMENTE las 8 ranuras equipadas están activas en combate (Niveles 1..10)
      const weapons = stats.activeEquipped;

      p.maxHp = stats.maxHp;
      if (p.isDead) {
        p.hp = 0;
        return;
      }
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      if (stats.regenPerSec > 0 && p.hp > 0) {
        p.hp = Math.min(p.maxHp, p.hp + stats.regenPerSec * dt);
      }
      if (p.invulnTimer > 0) p.invulnTimer -= dt;
      if (p.hurtFlash > 0) p.hurtFlash -= dt;
      if (p.portalCooldown > 0) p.portalCooldown -= dt;

      hpSyncAccumulator += dt;
      if (hpSyncAccumulator >= 0.22) {
        hpSyncAccumulator = 0;
        callbacksRef.current.onHeroHpChange(Math.round(p.hp), Math.round(p.maxHp));
      }

      // 1. Movimiento
      let moveX = joystickRef.current.dx;
      let moveY = joystickRef.current.dy;

      if (!joystickRef.current.active) {
        const k = keysRef.current;
        let kx = 0;
        let ky = 0;
        if (k['arrowleft'] || k['a']) kx -= 1;
        if (k['arrowright'] || k['d']) kx += 1;
        if (k['arrowup'] || k['w']) ky -= 1;
        if (k['arrowdown'] || k['s']) ky += 1;
        if (kx !== 0 || ky !== 0) {
          const len = Math.hypot(kx, ky);
          moveX = kx / len;
          moveY = ky / len;
        }
      }

      if (Math.hypot(moveX, moveY) > 0.04) {
        p.x += moveX * stats.moveSpeed * dt;
        p.y += moveY * stats.moveSpeed * dt;
        p.facingAngle = Math.atan2(moveY, moveX);
        if (Math.abs(moveX) > 0.08) {
          p.facingLeft = moveX < 0;
        }
        p.walkCycle += dt * 12;
      }

      posSyncAccumulator += dt;
      if (posSyncAccumulator >= 1.2) {
        posSyncAccumulator = 0;
        callbacksRef.current.onPlayerPositionChange(Math.round(p.x), Math.round(p.y));
      }

      // 2. Teletransportadores
      let closestTp: WorldTeleporter | null = null;
      for (const tp of world.teleporters) {
        const dist = Math.hypot(p.x - tp.x, p.y - tp.y);
        if (dist < 78) {
          closestTp = tp;
          break;
        }
      }
      callbacksRef.current.onNearbyTeleporterChange(closestTp);

      if (closestTp && p.portalCooldown <= 0) {
        p.portalCharge += dt;
        if (p.portalCharge >= 1.15) {
          p.portalCharge = 0;
          p.portalCooldown = 3.0;
          soundEngine.playPortalWarp();
          callbacksRef.current.onEnterTeleporter(closestTp);
          return;
        }
      } else {
        p.portalCharge = Math.max(0, p.portalCharge - dt * 2);
      }

      // 3. ESCALADO PROGRESIVO DE DUREZA ENEMIGA POR NIVEL Y EQUIPAMIENTO
      const lvl = Math.max(1, save.level);
      const weaponLevelsList = Object.values(weapons).map((v) => v || 0);
      const evoCount = weaponLevelsList.filter((v) => v >= MAX_ITEM_LEVEL).length;
      const totalWeaponPower = weaponLevelsList.reduce((acc, v) => acc + v, 0);

      const enemyLevelHpMult =
        Math.pow(1.21, Math.min(35, lvl - 1)) *
        (1 + (lvl - 1) * 0.38) *
        (1 + evoCount * 0.42 + Math.max(0, totalWeaponPower - 4) * 0.06);
      const enemyLevelDmgMult =
        1 + (lvl - 1) * 0.24 + Math.pow(Math.max(0, lvl - 1), 1.32) * 0.08;
      const enemySpeedMult = Math.min(1.85, 1 + (lvl - 1) * 0.022);
      const eliteChance = Math.min(0.26, 0.055 + (lvl - 1) * 0.008);
      const maxEnemies = Math.min(125, 56 + (lvl - 1) * 3);
      const spawnInterval = Math.max(0.22, 0.54 - (lvl - 1) * 0.014);

      if (lvl > prevLevelRef.current) {
        const oldLvl = prevLevelRef.current;
        prevLevelRef.current = lvl;

        for (const existingE of enemiesRef.current) {
          existingE.maxHp *= 1.22;
          existingE.hp *= 1.22;
          existingE.damage *= 1.15;
        }

        if (lvl % 3 === 0) {
          const template =
            world.enemyTypes[Math.floor(Math.random() * world.enemyTypes.length)];
          const champHp =
            3800 * world.enemyHpMultiplier * template.hpRatio * enemyLevelHpMult;
          const ang = Math.random() * Math.PI * 2;
          enemiesRef.current.push({
            id: nextEntityIdRef.current++,
            x: p.x + Math.cos(ang) * 260,
            y: p.y + Math.sin(ang) * 260,
            vx: 0,
            vy: 0,
            radius: template.radius * 1.65,
            hp: champHp,
            maxHp: champHp,
            speed: template.speed * enemySpeedMult * 1.12,
            damage: 68 * world.enemyDamageMultiplier * enemyLevelDmgMult,
            helmetColor: '#dc2626',
            bodyColor: '#7f1d1d',
            gunColor: '#18181b',
            name: `Campeón Nv.${lvl} ${template.name}`,
            isElite: true,
            isBoss: lvl % 6 === 0 && oldLvl !== lvl,
            hitFlash: 0,
            facingLeft: false,
            walkCycle: 0,
          });
          popupsRef.current.push({
            id: nextEntityIdRef.current++,
            x: p.x,
            y: p.y - 44,
            vy: -24,
            text: `⚠️ ¡AMENAZA NV.${lvl} AUMENTADA!`,
            color: '#f87171',
            scale: 1.18,
            life: 1.3,
            maxLife: 1.3,
          });
        }
      }

      spawnAccumulator += dt;
      if (spawnAccumulator >= spawnInterval && enemiesRef.current.length < maxEnemies) {
        spawnAccumulator = 0;
        const waveSize = Math.min(3 + Math.floor(lvl / 4), maxEnemies - enemiesRef.current.length);
        for (let i = 0; i < waveSize; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spawnRadius = Math.max(viewW, viewH) * 0.56 + Math.random() * 100;
          const sx = p.x + Math.cos(angle) * spawnRadius;
          const sy = p.y + Math.sin(angle) * spawnRadius;

          const isElite = Math.random() < eliteChance;
          const template =
            world.enemyTypes[Math.floor(Math.random() * world.enemyTypes.length)];
          const hp =
            950 *
            world.enemyHpMultiplier *
            template.hpRatio *
            enemyLevelHpMult *
            (isElite ? 4.8 : 1);

          enemiesRef.current.push({
            id: nextEntityIdRef.current++,
            x: sx,
            y: sy,
            vx: 0,
            vy: 0,
            radius: isElite ? template.radius * 1.42 : template.radius,
            hp,
            maxHp: hp,
            speed:
              template.speed *
              enemySpeedMult *
              (isElite ? 1.08 : 0.92 + Math.random() * 0.18),
            damage:
              42 *
              world.enemyDamageMultiplier *
              enemyLevelDmgMult *
              (isElite ? 2.1 : 1),
            helmetColor: isElite ? '#f59e0b' : template.helmetColor,
            bodyColor: template.bodyColor,
            gunColor: template.gunColor,
            name: isElite ? `Élite Nv.${lvl} ${template.name}` : template.name,
            isElite,
            isBoss: false,
            hitFlash: 0,
            facingLeft: sx > p.x,
            walkCycle: Math.random() * 10,
          });
        }
      }

      chestSpawnAccumulator += dt;
      if (chestSpawnAccumulator >= 22) {
        chestSpawnAccumulator = 0;
        const activeChests = dropsRef.current.filter((d) => d.type === 'chest_rainbow').length;
        if (activeChests < 3) {
          const angle = Math.random() * Math.PI * 2;
          dropsRef.current.push({
            id: nextEntityIdRef.current++,
            type: 'chest_rainbow',
            x: p.x + Math.cos(angle) * 280,
            y: p.y + Math.sin(angle) * 280,
            value: 1,
            magnetized: false,
            bobPhase: 0,
          });
        }
      }

      // 4. DISPARO DE LAS ARMAS EQUIPADAS (Tope Nivel 10 = EVO ★)
      let nearestEnemy: ActiveEnemy | null = null;
      let nearestDist = Infinity;
      for (const e of enemiesRef.current) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }

      const tickTimer = (wId: WeaponId): number => {
        const cur = (weaponTimersRef.current[wId] || 0) - dt;
        weaponTimersRef.current[wId] = cur;
        return cur;
      };

      // --- MANOS: KUNAI ---
      const kunaiLv = weapons.kunai || 0;
      if (kunaiLv > 0) {
        const isEvo = kunaiLv >= MAX_ITEM_LEVEL;
        const cd =
          (isEvo ? 0.16 : Math.max(0.22, 0.62 - (kunaiLv - 1) * 0.045)) * stats.cooldownMult;
        if (tickTimer('kunai') <= 0 && nearestEnemy && nearestDist < 550) {
          weaponTimersRef.current.kunai = cd;
          const baseAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
          const count = isEvo ? 4 : Math.min(3, 1 + Math.floor(kunaiLv / 3));
          const dmg =
            WEAPONS_CATALOG.kunai.baseDamage *
            stats.totalDamageMult *
            (1 + (kunaiLv - 1) * 0.25);

          for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.12;
            const ang = baseAngle + spread;
            const spd = (isEvo ? 680 : 540) * stats.projSpeedMult;
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'kunai',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              speed: spd,
              radius: isEvo ? 11 : 8,
              damage: dmg,
              pierce: isEvo ? 4 : 1 + Math.floor(kunaiLv / 5),
              life: 1.3,
              maxLife: 1.3,
              color: isEvo ? '#ef4444' : '#e2e8f0',
              isEvo,
              rotation: ang,
              spinSpeed: isEvo ? 18 : 0,
              hitEnemyIds: new Set(),
            });
          }
          soundEngine.playShoot('kunai');
        }
      }

      // --- MANOS: ESCOPETA TÁCTICA / CAÑÓN GATLING ---
      const shotgunLv = weapons.shotgun || 0;
      if (shotgunLv > 0 && nearestEnemy && nearestDist < 480) {
        const isEvo = shotgunLv >= MAX_ITEM_LEVEL;
        const cd = (isEvo ? 0.24 : Math.max(0.45, 0.85 - shotgunLv * 0.04)) * stats.cooldownMult;
        if (tickTimer('shotgun') <= 0) {
          weaponTimersRef.current.shotgun = cd;
          const baseAng = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
          const pellets = isEvo ? 7 : 3 + Math.floor(shotgunLv / 3);
          const dmg =
            WEAPONS_CATALOG.shotgun.baseDamage *
            stats.totalDamageMult *
            (1 + (shotgunLv - 1) * 0.24);
          for (let i = 0; i < pellets; i++) {
            const ang = baseAng + (i - (pellets - 1) / 2) * 0.11;
            const spd = 620 * stats.projSpeedMult;
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'shotgun',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              speed: spd,
              radius: isEvo ? 8 : 6,
              damage: dmg,
              pierce: isEvo ? 3 : 1,
              life: 0.75,
              maxLife: 0.75,
              color: isEvo ? '#dc2626' : '#f59e0b',
              isEvo,
              rotation: ang,
              spinSpeed: 0,
              hitEnemyIds: new Set(),
            });
          }
          soundEngine.playShoot('brick');
        }
      }

      // --- MANOS: RIFLE DE PLASMA / DESINTEGRADOR NOVA ---
      const plasmaLv = weapons.plasma_rifle || 0;
      if (plasmaLv > 0 && nearestEnemy) {
        const isEvo = plasmaLv >= MAX_ITEM_LEVEL;
        if (tickTimer('plasma_rifle') <= 0) {
          weaponTimersRef.current.plasma_rifle = (isEvo ? 0.38 : 0.68) * stats.cooldownMult;
          const ang = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
          const spd = 560 * stats.projSpeedMult;
          const dmg =
            WEAPONS_CATALOG.plasma_rifle.baseDamage *
            stats.totalDamageMult *
            (1 + (plasmaLv - 1) * 0.26);
          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'plasma_rifle',
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            speed: spd,
            radius: isEvo ? 14 : 10,
            damage: dmg,
            pierce: 2,
            life: 1.2,
            maxLife: 1.2,
            color: isEvo ? '#a855f7' : '#06b6d4',
            isEvo,
            rotation: ang,
            spinSpeed: 8,
            hitEnemyIds: new Set(),
            explosionRadius: (isEvo ? 65 : 42) * stats.areaMult,
            trail: [],
          });
          soundEngine.playShoot('lightning');
        }
      }

      // --- MANOS: GUADAÑA SEGADORA ---
      const scytheLv = weapons.reaper_scythe || 0;
      if (scytheLv > 0) {
        const isEvo = scytheLv >= MAX_ITEM_LEVEL;
        if (tickTimer('reaper_scythe') <= 0) {
          weaponTimersRef.current.reaper_scythe = (isEvo ? 0.62 : 0.95) * stats.cooldownMult;
          const count = isEvo ? 3 : 1 + Math.floor(scytheLv / 5);
          const dmg =
            WEAPONS_CATALOG.reaper_scythe.baseDamage *
            stats.totalDamageMult *
            (1 + (scytheLv - 1) * 0.28);
          const baseAng = nearestEnemy
            ? Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x)
            : p.facingAngle;
          for (let i = 0; i < count; i++) {
            const ang = baseAng + (i - (count - 1) / 2) * 0.4;
            const spd = 390 * stats.projSpeedMult;
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'reaper_scythe',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              speed: spd,
              radius: (isEvo ? 32 : 24) * stats.areaMult,
              damage: dmg,
              pierce: 99,
              life: 1.35,
              maxLife: 1.35,
              color: isEvo ? '#e11d48' : '#a855f7',
              isEvo,
              rotation: 0,
              spinSpeed: 16,
              hitEnemyIds: new Set(),
            });
          }
          soundEngine.playShoot('katana');
        }
      }

      // --- CUERPO: CAMPO DE FUERZA ---
      const forceLv = weapons.forcefield || 0;
      if (forceLv > 0) {
        const isEvo = forceLv >= MAX_ITEM_LEVEL;
        const auraRadius = (isEvo ? 132 : 65 + (forceLv - 1) * 7) * stats.areaMult;
        if (tickTimer('forcefield') <= 0) {
          weaponTimersRef.current.forcefield = 0.36 * stats.cooldownMult;
          const dmg =
            WEAPONS_CATALOG.forcefield.baseDamage *
            stats.totalDamageMult *
            (1 + (forceLv - 1) * 0.25);
          for (const e of enemiesRef.current) {
            const dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist <= auraRadius + e.radius) {
              damageEnemy(e, dmg, isEvo ? 14 : 5);
            }
          }
        }
      }

      // --- CUERPO: GUARDIÁN GIRATORIO ---
      const guardianLv = weapons.guardian || 0;
      if (guardianLv > 0) {
        const isEvo = guardianLv >= MAX_ITEM_LEVEL;
        const bladeCount = isEvo ? 6 : Math.min(5, 2 + Math.floor(guardianLv / 3));
        const orbitRadius = (isEvo ? 105 : 85) * stats.areaMult;
        guardianAngle += dt * (isEvo ? 5.2 : 3.6);
        if (tickTimer('guardian') <= 0) {
          weaponTimersRef.current.guardian = 0.22;
          const dmg =
            WEAPONS_CATALOG.guardian.baseDamage *
            stats.totalDamageMult *
            (1 + (guardianLv - 1) * 0.24);

          for (let i = 0; i < bladeCount; i++) {
            const ang = guardianAngle + (i * Math.PI * 2) / bladeCount;
            const bx = p.x + Math.cos(ang) * orbitRadius;
            const by = p.y + Math.sin(ang) * orbitRadius;
            for (const e of enemiesRef.current) {
              if (Math.hypot(e.x - bx, e.y - by) <= e.radius + (isEvo ? 24 : 18)) {
                damageEnemy(e, dmg, isEvo ? 22 : 14);
              }
            }
          }
        }
      }

      // --- CUERPO: ARMADURA RONIN / REACTOR TESLA ---
      const roninArmorLv = weapons.armor_ronin || 0;
      if (roninArmorLv > 0 && tickTimer('armor_ronin') <= 0) {
        const isEvo = roninArmorLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.armor_ronin = (isEvo ? 0.65 : 1.0) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.armor_ronin.baseDamage *
          stats.totalDamageMult *
          (1 + (roninArmorLv - 1) * 0.24);
        triggerAreaExplosion(p.x, p.y, (isEvo ? 115 : 85) * stats.areaMult, dmg, '#f43f5e');
      }

      const teslaArmorLv = weapons.armor_tesla || 0;
      if (teslaArmorLv > 0 && enemiesRef.current.length > 0 && tickTimer('armor_tesla') <= 0) {
        const isEvo = teslaArmorLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.armor_tesla = (isEvo ? 0.45 : 0.72) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.armor_tesla.baseDamage *
          stats.totalDamageMult *
          (1 + (teslaArmorLv - 1) * 0.24);
        for (const e of enemiesRef.current) {
          if (Math.hypot(e.x - p.x, e.y - p.y) <= 135 * stats.areaMult) {
            damageEnemy(e, dmg, 8);
            lightningsRef.current.push({
              id: nextEntityIdRef.current++,
              x: e.x,
              y: e.y,
              life: 0.18,
              maxLife: 0.18,
              color: '#38bdf8',
              radius: 26,
              isEvo,
            });
          }
        }
      }

      // --- ACOMPAÑANTES: DRON MISILES A+B ---
      companionAngle += dt * 2.2;
      const droneLv = weapons.drone || 0;
      if (droneLv > 0 && enemiesRef.current.length > 0 && tickTimer('drone') <= 0) {
        const isEvo = droneLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.drone = (isEvo ? 0.34 : 0.56) * stats.cooldownMult;
        const missileCount = isEvo ? 6 : Math.min(5, 2 + Math.floor(droneLv / 3));
        const dmg =
          WEAPONS_CATALOG.drone.baseDamage *
          stats.totalDamageMult *
          (1 + (droneLv - 1) * 0.25);

        for (let i = 0; i < missileCount; i++) {
          const target =
            enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
          const podSide = i % 2 === 0 ? 1 : -1;
          const droneX = p.x + Math.cos(companionAngle) * 42;
          const droneY = p.y - 26 + Math.sin(companionAngle) * 18;
          const targetAngle = target
            ? Math.atan2(target.y - droneY, target.x - droneX)
            : -Math.PI / 2;
          const launchAng = targetAngle + podSide * (0.65 + (i % 3) * 0.22);
          const missileSpd = (isEvo ? 460 : 390) * stats.projSpeedMult;

          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'drone',
            x: droneX,
            y: droneY,
            vx: Math.cos(launchAng) * missileSpd,
            vy: Math.sin(launchAng) * missileSpd,
            speed: missileSpd,
            radius: isEvo ? 11 : 9,
            damage: dmg,
            pierce: 1,
            life: 2.2,
            maxLife: 2.2,
            color: isEvo ? '#ec4899' : '#38bdf8',
            isEvo,
            rotation: launchAng,
            spinSpeed: 0,
            hitEnemyIds: new Set(),
            homing: true,
            turnRate: isEvo ? 9.5 : 7.2,
            targetEnemyId: target?.id,
            explosionRadius: (isEvo ? 48 : 30) * stats.areaMult,
            trail: [],
          });
        }
        soundEngine.playShoot('drone');
      }

      // --- ACOMPAÑANTES: SABUESO CYBER-REX / FÉNIX SOLAR ---
      const dogLv = weapons.cyber_dog || 0;
      if (dogLv > 0 && nearestEnemy && tickTimer('cyber_dog') <= 0) {
        const isEvo = dogLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.cyber_dog = (isEvo ? 0.38 : 0.6) * stats.cooldownMult;
        const dogX = p.x - 36;
        const dogY = p.y + 16;
        const ang = Math.atan2(nearestEnemy.y - dogY, nearestEnemy.x - dogX);
        const spd = 560 * stats.projSpeedMult;
        const dmg =
          WEAPONS_CATALOG.cyber_dog.baseDamage *
          stats.totalDamageMult *
          (1 + (dogLv - 1) * 0.25);
        projectilesRef.current.push({
          id: nextEntityIdRef.current++,
          weaponId: 'cyber_dog',
          x: dogX,
          y: dogY,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          speed: spd,
          radius: isEvo ? 14 : 10,
          damage: dmg,
          pierce: isEvo ? 4 : 2,
          life: 1.0,
          maxLife: 1.0,
          color: isEvo ? '#ef4444' : '#f59e0b',
          isEvo,
          rotation: ang,
          spinSpeed: 0,
          hitEnemyIds: new Set(),
        });
      }

      const phoenixLv = weapons.phoenix || 0;
      if (phoenixLv > 0 && enemiesRef.current.length > 0 && tickTimer('phoenix') <= 0) {
        const isEvo = phoenixLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.phoenix = (isEvo ? 0.55 : 0.85) * stats.cooldownMult;
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.012);
        const target =
          enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
        if (target) {
          const dmg =
            WEAPONS_CATALOG.phoenix.baseDamage *
            stats.totalDamageMult *
            (1 + (phoenixLv - 1) * 0.26);
          triggerAreaExplosion(
            target.x,
            target.y,
            (isEvo ? 92 : 64) * stats.areaMult,
            dmg,
            '#f97316'
          );
        }
      }

      // --- HOMBROS: EMISOR DE RAYOS ---
      const lightningLv = weapons.lightning || 0;
      if (lightningLv > 0 && enemiesRef.current.length > 0 && tickTimer('lightning') <= 0) {
        const isEvo = lightningLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.lightning = (isEvo ? 0.85 : 1.3) * stats.cooldownMult;
        const strikes = isEvo ? 4 : Math.min(3, 1 + Math.floor(lightningLv / 3));
        const dmg =
          WEAPONS_CATALOG.lightning.baseDamage *
          stats.totalDamageMult *
          (1 + (lightningLv - 1) * 0.26);
        for (let i = 0; i < strikes; i++) {
          const target =
            enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
          if (!target) continue;
          const blastRadius = (isEvo ? 78 : 52) * stats.areaMult;
          lightningsRef.current.push({
            id: nextEntityIdRef.current++,
            x: target.x,
            y: target.y,
            life: 0.28,
            maxLife: 0.28,
            color: isEvo ? '#c084fc' : '#38bdf8',
            radius: blastRadius,
            isEvo,
          });
          for (const e of enemiesRef.current) {
            if (Math.hypot(e.x - target.x, e.y - target.y) <= blastRadius + e.radius) {
              damageEnemy(e, dmg, 8);
            }
          }
        }
        soundEngine.playShoot('lightning');
      }

      // --- ACOMPAÑANTES: ESFERA REBOTEADORA (SOCCER) ---
      const soccerLv = weapons.soccer || 0;
      if (soccerLv > 0 && nearestEnemy && tickTimer('soccer') <= 0) {
        const isEvo = soccerLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.soccer = (isEvo ? 0.72 : 1.05) * stats.cooldownMult;
        const count = isEvo ? 3 : Math.min(2, 1 + Math.floor(soccerLv / 4));
        const dmg =
          WEAPONS_CATALOG.soccer.baseDamage *
          stats.totalDamageMult *
          (1 + (soccerLv - 1) * 0.25);

        for (let i = 0; i < count; i++) {
          const ang =
            Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x) + (i - 0.5) * 0.35;
          const spd = (isEvo ? 540 : 440) * stats.projSpeedMult;
          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'soccer',
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            speed: spd,
            radius: (isEvo ? 16 : 14) * stats.areaMult,
            damage: dmg,
            pierce: 99,
            life: 3.2,
            maxLife: 3.2,
            color: isEvo ? '#06b6d4' : '#ffffff',
            isEvo,
            rotation: 0,
            spinSpeed: 12,
            hitEnemyIds: new Set(),
            bouncesLeft: isEvo ? 9 : 4 + Math.floor(soccerLv / 2),
          });
        }
      }

      // --- MANOS: TALADRO SILBANTE ---
      const drillLv = weapons.drill || 0;
      if (drillLv > 0 && enemiesRef.current.length > 0 && tickTimer('drill') <= 0) {
        const isEvo = drillLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.drill = (isEvo ? 0.55 : 0.95) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.drill.baseDamage *
          stats.totalDamageMult *
          (1 + (drillLv - 1) * 0.25);
        const ang = Math.random() * Math.PI * 2;
        const spd = (isEvo ? 660 : 520) * stats.projSpeedMult;

        projectilesRef.current.push({
          id: nextEntityIdRef.current++,
          weaponId: 'drill',
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          speed: spd,
          radius: 11,
          damage: dmg,
          pierce: 99,
          life: 2.8,
          maxLife: 2.8,
          color: isEvo ? '#f43f5e' : '#facc15',
          isEvo,
          rotation: ang,
          spinSpeed: 0,
          hitEnemyIds: new Set(),
          homing: isEvo,
          turnRate: isEvo ? 8.5 : 0,
          bouncesLeft: 8,
          trail: [],
        });
      }

      // --- HOMBROS: LANZACOHETES RPG / CAÑÓN DE RIEL ---
      const rpgLv = weapons.rpg || 0;
      if (rpgLv > 0 && nearestEnemy && tickTimer('rpg') <= 0) {
        const isEvo = rpgLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.rpg = (isEvo ? 1.05 : 1.5) * stats.cooldownMult;
        const count = isEvo ? 2 : 1 + (rpgLv >= 6 ? 1 : 0);
        const dmg =
          WEAPONS_CATALOG.rpg.baseDamage *
          stats.totalDamageMult *
          (1 + (rpgLv - 1) * 0.26);

        for (let i = 0; i < count; i++) {
          const ang =
            Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x) +
            (i - (count - 1) / 2) * 0.25;
          const spd = (isEvo ? 420 : 360) * stats.projSpeedMult;
          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'rpg',
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            speed: spd,
            radius: isEvo ? 16 : 13,
            damage: dmg,
            pierce: 1,
            life: 1.8,
            maxLife: 1.8,
            color: isEvo ? '#3b82f6' : '#ef4444',
            isEvo,
            rotation: ang,
            spinSpeed: 0,
            hitEnemyIds: new Set(),
            explosionRadius: (isEvo ? 110 : 75) * stats.areaMult,
            trail: [],
          });
        }
        soundEngine.playShoot('brick');
      }

      const railgunLv = weapons.railgun || 0;
      if (railgunLv > 0 && nearestEnemy && tickTimer('railgun') <= 0) {
        const isEvo = railgunLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.railgun = (isEvo ? 1.0 : 1.55) * stats.cooldownMult;
        const ang = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
        const spd = 920 * stats.projSpeedMult;
        const dmg =
          WEAPONS_CATALOG.railgun.baseDamage *
          stats.totalDamageMult *
          (1 + (railgunLv - 1) * 0.28);
        projectilesRef.current.push({
          id: nextEntityIdRef.current++,
          weaponId: 'railgun',
          x: p.x,
          y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          speed: spd,
          radius: isEvo ? 16 : 12,
          damage: dmg,
          pierce: 99,
          life: 0.9,
          maxLife: 0.9,
          color: isEvo ? '#f43f5e' : '#8b5cf6',
          isEvo,
          rotation: ang,
          spinSpeed: 0,
          hitEnemyIds: new Set(),
          trail: [],
        });
        soundEngine.playShoot('lightning');
      }

      // --- MANOS: BUMERÁN TÁCTICO ---
      const boomerangLv = weapons.boomerang || 0;
      if (boomerangLv > 0 && tickTimer('boomerang') <= 0) {
        const isEvo = boomerangLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.boomerang = (isEvo ? 0.85 : 1.15) * stats.cooldownMult;
        const count = isEvo ? 2 : 1 + (boomerangLv >= 5 ? 1 : 0);
        const dmg =
          WEAPONS_CATALOG.boomerang.baseDamage *
          stats.totalDamageMult *
          (1 + (boomerangLv - 1) * 0.25);
        const baseAng = nearestEnemy
          ? Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x)
          : p.facingAngle;

        for (let i = 0; i < count; i++) {
          const ang = baseAng + i * Math.PI;
          const spd = 420 * stats.projSpeedMult;
          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'boomerang',
            x: p.x,
            y: p.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            speed: spd,
            radius: (isEvo ? 20 : 16) * stats.areaMult,
            damage: dmg,
            pierce: 99,
            life: 1.9,
            maxLife: 1.9,
            color: isEvo ? '#f97316' : '#14b8a6',
            isEvo,
            rotation: 0,
            spinSpeed: 16,
            hitEnemyIds: new Set(),
            returningToPlayer: true,
          });
        }
      }

      // --- ACOMPAÑANTE: GUARDIÁN ESPINOSO (DURIAN) ---
      const durianLv = weapons.durian || 0;
      if (durianLv > 0) {
        const isEvo = durianLv >= MAX_ITEM_LEVEL;
        const d = durianRef.current;
        const durRadius = (isEvo ? 42 : 26 + durianLv * 1.5) * stats.areaMult;
        d.x += d.vx * stats.projSpeedMult * dt;
        d.y += d.vy * stats.projSpeedMult * dt;
        d.rotation += dt * 4.5;

        const minX = p.x - viewW * 0.44;
        const maxX = p.x + viewW * 0.44;
        const minY = p.y - viewH * 0.38;
        const maxY = p.y + viewH * 0.38;
        if (d.x < minX) {
          d.x = minX;
          d.vx = Math.abs(d.vx);
        } else if (d.x > maxX) {
          d.x = maxX;
          d.vx = -Math.abs(d.vx);
        }
        if (d.y < minY) {
          d.y = minY;
          d.vy = Math.abs(d.vy);
        } else if (d.y > maxY) {
          d.y = maxY;
          d.vy = -Math.abs(d.vy);
        }

        d.hitTick -= dt;
        if (d.hitTick <= 0) {
          d.hitTick = 0.25;
          const dmg =
            WEAPONS_CATALOG.durian.baseDamage *
            stats.totalDamageMult *
            (1 + (durianLv - 1) * 0.25);
          for (const e of enemiesRef.current) {
            if (Math.hypot(e.x - d.x, e.y - d.y) <= durRadius + e.radius) {
              damageEnemy(e, dmg, 20);
            }
          }
        }
      }

      // --- HOMBROS: LANZADOR LÁSER, CATAPULTA (BRICK), MORTERO MOLOTOV ---
      const laserLv = weapons.laser || 0;
      if (laserLv > 0 && enemiesRef.current.length > 0 && tickTimer('laser') <= 0) {
        const isEvo = laserLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.laser = (isEvo ? 0.95 : 1.4) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.laser.baseDamage *
          stats.totalDamageMult *
          (1 + (laserLv - 1) * 0.25);

        lightningsRef.current.push({
          id: nextEntityIdRef.current++,
          x: p.x,
          y: p.y,
          life: 0.42,
          maxLife: 0.42,
          color: isEvo ? '#d946ef' : '#38bdf8',
          radius: viewW * 0.46,
          isEvo,
          isLaserSweep: true,
        });

        for (const e of enemiesRef.current) {
          if (Math.abs(e.y - p.y) < 95 * stats.areaMult && Math.abs(e.x - p.x) < viewW * 0.48) {
            damageEnemy(e, dmg, 10);
          }
        }
        soundEngine.playShoot('lightning');
      }

      const brickLv = weapons.brick || 0;
      if (brickLv > 0 && tickTimer('brick') <= 0) {
        const isEvo = brickLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.brick = (isEvo ? 1.15 : 1.45) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.brick.baseDamage *
          stats.totalDamageMult *
          (1 + (brickLv - 1) * 0.25);

        if (isEvo) {
          for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI * 2) / 8;
            const spd = 340 * stats.projSpeedMult;
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'brick',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              speed: spd,
              radius: 18 * stats.areaMult,
              damage: dmg,
              pierce: 99,
              life: 1.35,
              maxLife: 1.35,
              color: '#f43f5e',
              isEvo: true,
              rotation: ang,
              spinSpeed: 8,
              hitEnemyIds: new Set(),
            });
          }
        } else {
          const count = Math.min(3, 1 + Math.floor(brickLv / 3));
          for (let i = 0; i < count; i++) {
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'brick',
              x: p.x + (i - (count - 1) / 2) * 26,
              y: p.y,
              vx: (i - (count - 1) / 2) * 55,
              vy: -360,
              speed: 360,
              radius: 14 * stats.areaMult,
              damage: dmg,
              pierce: 8,
              life: 1.25,
              maxLife: 1.25,
              color: '#ea580c',
              isEvo: false,
              rotation: 0,
              spinSpeed: 6,
              hitEnemyIds: new Set(),
            });
          }
        }
        soundEngine.playShoot('brick');
      }

      const molotovLv = weapons.molotov || 0;
      if (molotovLv > 0 && tickTimer('molotov') <= 0) {
        const isEvo = molotovLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.molotov = (isEvo ? 1.45 : 1.85) * stats.cooldownMult;
        const count = isEvo ? 5 : Math.min(4, 2 + Math.floor(molotovLv / 3));
        const dmg =
          WEAPONS_CATALOG.molotov.baseDamage *
          stats.totalDamageMult *
          (1 + (molotovLv - 1) * 0.25);

        for (let i = 0; i < count; i++) {
          const ang = (i * Math.PI * 2) / count + Math.random() * 0.4;
          const dist = isEvo ? 120 : 95 + Math.random() * 55;
          hazardsRef.current.push({
            id: nextEntityIdRef.current++,
            x: p.x + Math.cos(ang) * dist,
            y: p.y + Math.sin(ang) * dist,
            radius: (isEvo ? 62 : 46) * stats.areaMult,
            damagePerTick: dmg,
            life: 2.6,
            maxLife: 2.6,
            color: isEvo ? '#06b6d4' : '#f97316',
            isEvo,
            tickTimer: 0,
          });
        }
      }

      // --- MANOS: HOJA CORTAVIENTO (KATANA) ---
      const katanaLv = weapons.katana || 0;
      if (katanaLv > 0 && tickTimer('katana') <= 0) {
        const isEvo = katanaLv >= MAX_ITEM_LEVEL;
        weaponTimersRef.current.katana = (isEvo ? 0.65 : 0.95) * stats.cooldownMult;
        const dmg =
          WEAPONS_CATALOG.katana.baseDamage *
          stats.totalDamageMult *
          (1 + (katanaLv - 1) * 0.26);
        const directions = isEvo
          ? [p.facingAngle, p.facingAngle + Math.PI]
          : [p.facingAngle];

        for (const ang of directions) {
          projectilesRef.current.push({
            id: nextEntityIdRef.current++,
            weaponId: 'katana',
            x: p.x + Math.cos(ang) * 24,
            y: p.y + Math.sin(ang) * 24,
            vx: Math.cos(ang) * 380,
            vy: Math.sin(ang) * 380,
            speed: 380,
            radius: (isEvo ? 38 : 28) * stats.areaMult,
            damage: dmg,
            pierce: 99,
            life: 0.42,
            maxLife: 0.42,
            color: isEvo ? '#f43f5e' : '#38bdf8',
            isEvo,
            rotation: ang,
            spinSpeed: 0,
            hitEnemyIds: new Set(),
          });
        }
        if (isEvo) {
          p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.015);
        }
        soundEngine.playShoot('katana');
      }

      // 5. Actualizar Proyectiles
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];

        if (proj.trail) {
          proj.trail.push({ x: proj.x, y: proj.y });
          if (proj.trail.length > 9) proj.trail.shift();
        }

        if (proj.homing && enemiesRef.current.length > 0) {
          let target = enemiesRef.current.find((e) => e.id === proj.targetEnemyId);
          if (!target) {
            let bestDist = Infinity;
            for (const e of enemiesRef.current) {
              const d = Math.hypot(e.x - proj.x, e.y - proj.y);
              if (d < bestDist) {
                bestDist = d;
                target = e;
              }
            }
            if (target) proj.targetEnemyId = target.id;
          }

          if (target) {
            const desiredAngle = Math.atan2(target.y - proj.y, target.x - proj.x);
            let currentAngle = Math.atan2(proj.vy, proj.vx);
            let diff = desiredAngle - currentAngle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            const maxTurn = (proj.turnRate || 7) * dt;
            currentAngle += Math.max(-maxTurn, Math.min(maxTurn, diff));
            proj.vx = Math.cos(currentAngle) * proj.speed;
            proj.vy = Math.sin(currentAngle) * proj.speed;
            proj.rotation = currentAngle;
          }
        }

        if (proj.returningToPlayer && proj.maxLife - proj.life > 0.5) {
          const toPlayerX = p.x - proj.x;
          const toPlayerY = p.y - proj.y;
          const dist = Math.hypot(toPlayerX, toPlayerY) || 1;
          proj.vx += (toPlayerX / dist) * 1150 * dt;
          proj.vy += (toPlayerY / dist) * 1150 * dt;
        }

        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        if (proj.weaponId === 'brick' && !proj.isEvo) {
          proj.vy += 680 * dt;
        }
        if (proj.spinSpeed !== 0) {
          proj.rotation += proj.spinSpeed * dt;
        }
        proj.life -= dt;

        if (proj.bouncesLeft && proj.bouncesLeft > 0) {
          const minX = p.x - viewW * 0.45;
          const maxX = p.x + viewW * 0.45;
          const minY = p.y - viewH * 0.4;
          const maxY = p.y + viewH * 0.4;
          let bounced = false;
          if (proj.x < minX) {
            proj.x = minX;
            proj.vx = Math.abs(proj.vx);
            bounced = true;
          } else if (proj.x > maxX) {
            proj.x = maxX;
            proj.vx = -Math.abs(proj.vx);
            bounced = true;
          }
          if (proj.y < minY) {
            proj.y = minY;
            proj.vy = Math.abs(proj.vy);
            bounced = true;
          } else if (proj.y > maxY) {
            proj.y = maxY;
            proj.vy = -Math.abs(proj.vy);
            bounced = true;
          }
          if (bounced) {
            proj.bouncesLeft -= 1;
            proj.rotation = Math.atan2(proj.vy, proj.vx);
            proj.hitEnemyIds.clear();
          }
        }

        if (proj.life <= 0) {
          if (proj.explosionRadius) {
            triggerAreaExplosion(
              proj.x,
              proj.y,
              proj.explosionRadius,
              proj.damage * 0.65,
              proj.color
            );
          }
          projectilesRef.current.splice(i, 1);
          continue;
        }

        for (const e of enemiesRef.current) {
          if (proj.hitEnemyIds.has(e.id)) continue;
          if (Math.hypot(e.x - proj.x, e.y - proj.y) <= e.radius + proj.radius) {
            proj.hitEnemyIds.add(e.id);
            damageEnemy(e, proj.damage, proj.weaponId === 'katana' ? 18 : 8);

            if (proj.explosionRadius) {
              triggerAreaExplosion(
                proj.x,
                proj.y,
                proj.explosionRadius,
                proj.damage * 0.75,
                proj.color
              );
            }

            if (proj.weaponId === 'soccer' && proj.bouncesLeft && proj.bouncesLeft > 0) {
              proj.bouncesLeft -= 1;
              const bounceAng = Math.random() * Math.PI * 2;
              proj.vx = Math.cos(bounceAng) * proj.speed;
              proj.vy = Math.sin(bounceAng) * proj.speed;
              break;
            }

            proj.pierce -= 1;
            if (proj.pierce <= 0) {
              projectilesRef.current.splice(i, 1);
              break;
            }
          }
        }
      }

      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const exp = explosionsRef.current[i];
        exp.life -= dt;
        exp.radius = exp.maxRadius * (1 - exp.life / exp.maxLife);
        if (exp.life <= 0) {
          explosionsRef.current.splice(i, 1);
        }
      }

      for (let i = hazardsRef.current.length - 1; i >= 0; i--) {
        const h = hazardsRef.current[i];
        h.life -= dt;
        h.tickTimer -= dt;
        if (h.life <= 0) {
          hazardsRef.current.splice(i, 1);
          continue;
        }
        if (h.tickTimer <= 0) {
          h.tickTimer = 0.35;
          for (const e of enemiesRef.current) {
            if (Math.hypot(e.x - h.x, e.y - h.y) <= h.radius + e.radius) {
              damageEnemy(e, h.damagePerTick, 0);
            }
          }
        }
      }

      for (let i = lightningsRef.current.length - 1; i >= 0; i--) {
        lightningsRef.current[i].life -= dt;
        if (lightningsRef.current[i].life <= 0) {
          lightningsRef.current.splice(i, 1);
        }
      }

      // 7. Enemigos, Muertes y Botín
      let xpGainedThisFrame = 0;
      let goldGainedThisFrame = 0;
      let killsThisFrame = 0;
      let bossesDefeatedThisFrame = 0;
      let currentActiveBoss: { name: string; hp: number; maxHp: number } | null = null;

      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const e = enemiesRef.current[i];
        if (e.hitFlash > 0) e.hitFlash -= dt;

        if (e.hp <= 0) {
          killsThisFrame += 1;
          ghostsRef.current.push({
            id: nextEntityIdRef.current++,
            x: e.x,
            y: e.y,
            life: 0.42,
            maxLife: 0.42,
            radius: e.radius,
          });

          const lootGoldScale = 1 + (lvl - 1) * 0.15;
          const lootXpScale = Math.sqrt(world.xpMultiplier) * (1 + (lvl - 1) * 0.05);
          if (e.isBoss) {
            bossesDefeatedThisFrame += 1;
            dropsRef.current.push({
              id: nextEntityIdRef.current++,
              type: 'chest_rainbow',
              x: e.x,
              y: e.y,
              value: 1,
              magnetized: false,
              bobPhase: 0,
            });
            for (let c = 0; c < 12; c++) {
              const ang = (c * Math.PI * 2) / 12;
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: c % 2 === 0 ? 'coin' : 'xp_gold',
                x: e.x + Math.cos(ang) * 45,
                y: e.y + Math.sin(ang) * 45,
                value:
                  c % 2 === 0
                    ? Math.round(45 * world.goldMultiplier * lootGoldScale)
                    : Math.round(28 * lootXpScale),
                magnetized: true,
                bobPhase: c,
              });
            }
          } else if (e.isElite) {
            if (Math.random() < 0.45) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'chest_rainbow',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            }
            dropsRef.current.push({
              id: nextEntityIdRef.current++,
              type: 'xp_gold',
              x: e.x + 12,
              y: e.y,
              value: Math.round(26 * lootXpScale),
              magnetized: false,
              bobPhase: 0,
            });
          } else {
            const roll = Math.random();
            if (roll < 0.01) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'magnet',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            } else if (roll < 0.022) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'meat',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            } else if (roll < 0.028) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'bomb',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            } else if (roll < 0.22) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'coin',
                x: e.x,
                y: e.y,
                value: Math.max(1, Math.round(5 * world.goldMultiplier * lootGoldScale)),
                magnetized: false,
                bobPhase: 0,
              });
            } else {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: roll < 0.34 ? 'xp_blue' : 'xp_green',
                x: e.x,
                y: e.y,
                value: Math.max(4, Math.round((roll < 0.34 ? 12 : 6) * lootXpScale)),
                magnetized: false,
                bobPhase: Math.random() * 6,
              });
            }
          }

          enemiesRef.current.splice(i, 1);
          continue;
        }

        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (!e.isBoss && dist > 1100) {
          enemiesRef.current.splice(i, 1);
          continue;
        }

        if (e.isBoss && !currentActiveBoss) {
          currentActiveBoss = { name: e.name, hp: e.hp, maxHp: e.maxHp };
        }

        if (dist > 1) {
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
          e.facingLeft = dx < 0;
          e.walkCycle += dt * 9;
        }

        if (dist < e.radius + 17 && p.invulnTimer <= 0 && !p.isDead) {
          const takenDmg = Math.max(1, Math.round(e.damage * (1 - stats.damageReduction)));
          p.hp = Math.max(0, p.hp - takenDmg);
          p.invulnTimer = 0.25;
          p.hurtFlash = 0.25;
          soundEngine.playHit(true);

          popupsRef.current.push({
            id: nextEntityIdRef.current++,
            x: p.x + (Math.random() - 0.5) * 14,
            y: p.y - 28,
            vy: -38,
            text: `-${takenDmg} HP`,
            color: '#ef4444',
            scale: 1.15,
            life: 0.75,
            maxLife: 0.75,
          });

          callbacksRef.current.onHeroHpChange(Math.round(p.hp), Math.round(p.maxHp));

          if (p.hp <= 0) {
            p.hp = 0;
            p.isDead = true;
            soundEngine.playBombExplosion();
            callbacksRef.current.onHeroHpChange(0, Math.round(p.maxHp));
            callbacksRef.current.onHeroDeath(e.name);
            break;
          }
        }
      }

      const enemyList = enemiesRef.current;
      for (let i = 0; i < enemyList.length; i++) {
        const a = enemyList[i];
        for (let j = i + 1; j < enemyList.length; j++) {
          const b = enemyList[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minDist = a.radius + b.radius;
          const dSq = dx * dx + dy * dy;
          if (dSq > 0 && dSq < minDist * minDist) {
            const d = Math.sqrt(dSq);
            const overlap = (minDist - d) * 0.35;
            const nx = dx / d;
            const ny = dy / d;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
          }
        }
      }

      callbacksRef.current.onActiveBossChange(currentActiveBoss);

      for (let i = dropsRef.current.length - 1; i >= 0; i--) {
        const item = dropsRef.current[i];
        item.bobPhase += dt * 4;
        const dx = p.x - item.x;
        const dy = p.y - item.y;
        const dist = Math.hypot(dx, dy);

        if (
          item.type !== 'chest_rainbow' &&
          (item.magnetized || dist <= stats.magnetRadius)
        ) {
          item.magnetized = true;
          const pullSpeed = 480;
          item.x += (dx / (dist || 1)) * pullSpeed * dt;
          item.y += (dy / (dist || 1)) * pullSpeed * dt;
        }

        const pickupRadius = item.type === 'chest_rainbow' ? 34 : 22;
        if (dist <= pickupRadius) {
          if (item.type === 'xp_green' || item.type === 'xp_blue' || item.type === 'xp_gold') {
            xpGainedThisFrame += Math.round(item.value * stats.xpMult);
            soundEngine.playGemPickup();
          } else if (item.type === 'coin') {
            goldGainedThisFrame += Math.round(item.value * stats.goldMult);
            soundEngine.playCoinPickup();
          } else if (item.type === 'meat') {
            p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45);
            soundEngine.playLevelUp();
            popupsRef.current.push({
              id: nextEntityIdRef.current++,
              x: p.x,
              y: p.y - 28,
              vy: -32,
              text: '+VIDA',
              color: '#4ade80',
              scale: 1.15,
              life: 0.9,
              maxLife: 0.9,
            });
          } else if (item.type === 'magnet') {
            for (const d of dropsRef.current) {
              if (d.type !== 'chest_rainbow') {
                d.magnetized = true;
              }
            }
            soundEngine.playCoinPickup();
            popupsRef.current.push({
              id: nextEntityIdRef.current++,
              x: p.x,
              y: p.y - 28,
              vy: -32,
              text: '¡IMÁN TOTAL!',
              color: '#38bdf8',
              scale: 1.2,
              life: 1.0,
              maxLife: 1.0,
            });
          } else if (item.type === 'bomb') {
            soundEngine.playBombExplosion();
            for (const e of enemiesRef.current) {
              if (e.isBoss) {
                e.hp -= e.maxHp * 0.25;
              } else {
                e.hp = 0;
              }
            }
            popupsRef.current.push({
              id: nextEntityIdRef.current++,
              x: p.x,
              y: p.y - 32,
              vy: -35,
              text: '💥 ¡BOMBA NUCLEAR!',
              color: '#f97316',
              scale: 1.3,
              life: 1.1,
              maxLife: 1.1,
            });
          } else if (item.type === 'chest_rainbow') {
            soundEngine.playChestJackpot();
            callbacksRef.current.onOpenRainbowChest();
          }

          dropsRef.current.splice(i, 1);
        }
      }

      if (
        xpGainedThisFrame > 0 ||
        goldGainedThisFrame > 0 ||
        killsThisFrame > 0 ||
        bossesDefeatedThisFrame > 0
      ) {
        callbacksRef.current.onGainXpAndCoins(
          xpGainedThisFrame,
          goldGainedThisFrame,
          killsThisFrame,
          bossesDefeatedThisFrame
        );
      }

      for (let i = popupsRef.current.length - 1; i >= 0; i--) {
        const pop = popupsRef.current[i];
        pop.y += pop.vy * dt;
        pop.life -= dt;
        if (pop.life <= 0) {
          popupsRef.current.splice(i, 1);
        }
      }

      for (let i = ghostsRef.current.length - 1; i >= 0; i--) {
        ghostsRef.current[i].life -= dt;
        if (ghostsRef.current[i].life <= 0) {
          ghostsRef.current.splice(i, 1);
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const pt = particlesRef.current[i];
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.92;
        pt.vy *= 0.92;
        pt.life -= dt;
        if (pt.life <= 0) {
          particlesRef.current.splice(i, 1);
        }
      }
    };

    const renderScene = (viewW: number, viewH: number, nowMs: number) => {
      const p = playerRef.current;
      const world = worldRef.current;
      const save = saveRef.current;
      const stats = getPlayerStats();
      const weapons = stats.activeEquipped;

      const camX = p.x - viewW / 2;
      const camY = p.y - viewH / 2;

      // 1. FONDO DE MUNDO CON DEGRADADO PROFUNDO 2.5D
      const bgGrad = ctx.createRadialGradient(
        viewW / 2,
        viewH * 0.45,
        40,
        viewW / 2,
        viewH * 0.45,
        Math.max(viewW, viewH) * 0.85
      );
      bgGrad.addColorStop(0, world.bgSecondary);
      bgGrad.addColorStop(1, world.bgPrimary);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.save();
      ctx.translate(-camX, -camY);

      const tileSize = 260;
      const startTileX = Math.floor(camX / tileSize) - 1;
      const endTileX = Math.ceil((camX + viewW) / tileSize) + 1;
      const startTileY = Math.floor(camY / tileSize) - 1;
      const endTileY = Math.ceil((camY + viewH) / tileSize) + 1;

      // Textura de losas / terreno exterior y detalles ambientales
      for (let ty = startTileY; ty <= endTileY; ty++) {
        const yPos = ty * tileSize;
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const xPos = tx * tileSize;
          const hash = Math.abs((tx * 73856093) ^ (ty * 19349663)) % 100;

          ctx.fillStyle =
            (tx + ty) % 2 === 0 ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.05)';
          ctx.fillRect(xPos, yPos, tileSize, tileSize);

          ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
          ctx.lineWidth = 2;
          ctx.strokeRect(xPos, yPos, tileSize, tileSize);

          // Grietas y detalles de terreno fuera de la autopista
          if (hash < 35 && Math.abs(xPos) > 220 && Math.abs(xPos - 700) > 220 && Math.abs(xPos + 700) > 220) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(xPos + 60, yPos + 70);
            ctx.lineTo(xPos + 95, yPos + 88);
            ctx.lineTo(xPos + 112, yPos + 125);
            ctx.stroke();
          }
        }
      }

      // Autopistas Principales con Bordillos Biselados 3D, Sombras y Alcantarillas
      const roadCentersX = [-700, 0, 700];
      for (const rcx of roadCentersX) {
        if (rcx + 240 < camX || rcx - 240 > camX + viewW) continue;

        // Sombra exterior de la autopista
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(rcx - 216, camY - 100, 432, viewH + 200);

        // Superficie de asfalto con degradado lateral
        const roadGrad = ctx.createLinearGradient(rcx - 196, 0, rcx + 196, 0);
        roadGrad.addColorStop(0, world.bgSecondary);
        roadGrad.addColorStop(0.15, world.bgPrimary);
        roadGrad.addColorStop(0.5, world.bgSecondary);
        roadGrad.addColorStop(0.85, world.bgPrimary);
        roadGrad.addColorStop(1, world.bgSecondary);
        ctx.fillStyle = roadGrad;
        ctx.fillRect(rcx - 196, camY - 100, 392, viewH + 200);

        // Bordillos de concreto biselados a izquierda y derecha
        ctx.fillStyle = '#475569';
        ctx.fillRect(rcx - 206, camY - 100, 12, viewH + 200);
        ctx.fillRect(rcx + 194, camY - 100, 12, viewH + 200);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(rcx - 198, camY - 100, 3, viewH + 200);
        ctx.fillRect(rcx + 194, camY - 100, 3, viewH + 200);

        // Doble línea central con reflejo sutil
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(rcx - 10, camY - 100, 20, viewH + 200);
        ctx.fillStyle = world.laneLineColor;
        ctx.fillRect(rcx - 9, camY - 100, 6, viewH + 200);
        ctx.fillRect(rcx + 3, camY - 100, 6, viewH + 200);
      }

      for (let ty = startTileY; ty <= endTileY; ty++) {
        const yPos = ty * tileSize;

        for (const rcx of roadCentersX) {
          if (rcx + 240 < camX || rcx - 240 > camX + viewW) continue;

          // Líneas discontinuas con sombra 3D
          ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
          ctx.fillRect(rcx - 107, yPos + 23, 8, 92);
          ctx.fillRect(rcx + 102, yPos + 23, 8, 92);
          ctx.fillStyle = world.laneLineColor;
          ctx.fillRect(rcx - 108, yPos + 20, 7, 92);
          ctx.fillRect(rcx + 101, yPos + 20, 7, 92);

          // Alcantarillas metálicas detalladas cada 2 bloques
          if (Math.abs(ty % 2) === 0) {
            const mhX = rcx + (ty % 4 === 0 ? -52 : 52);
            const mhY = yPos + 72;
            ctx.save();
            ctx.translate(mhX, mhY);
            ctx.fillStyle = '#1e293b';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.moveTo(-9, -4);
            ctx.lineTo(9, -4);
            ctx.moveTo(-10, 0);
            ctx.lineTo(10, 0);
            ctx.moveTo(-9, 4);
            ctx.lineTo(9, 4);
            ctx.stroke();
            ctx.restore();
          }

          const drawRoadArrow = (ax: number, ay: number, pointDown: boolean) => {
            ctx.save();
            ctx.translate(ax, ay);
            if (!pointDown) ctx.scale(1, -1);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
            ctx.fillRect(-5, -22, 12, 26);
            ctx.fillStyle = 'rgba(226, 232, 240, 0.42)';
            ctx.fillRect(-6, -24, 12, 26);
            ctx.beginPath();
            ctx.moveTo(-17, 0);
            ctx.lineTo(17, 0);
            ctx.lineTo(0, 22);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          };

          drawRoadArrow(rcx - 150, yPos + 175, true);
          drawRoadArrow(rcx - 58, yPos + 175, true);
          drawRoadArrow(rcx + 58, yPos + 175, false);
          drawRoadArrow(rcx + 150, yPos + 175, false);

          // Vallas y Barricadas Laterales en 3D con Poste, Remaches y Brillo
          if (Math.abs(ty % 3) !== 1) {
            const drawBarrier3D = (rx: number, ry: number, isLeft: boolean) => {
              ctx.save();
              const railW = 20;
              const bx = isLeft ? rx - railW : rx;

              // Sombra proyectada de la valla
              ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
              ctx.fillRect(bx + 4, ry + 12, railW, tileSize - 16);

              const mainCol =
                world.borderFenceStyle === 'wood_highway'
                  ? '#9a5b25'
                  : world.borderFenceStyle === 'steel_military'
                  ? '#475569'
                  : world.borderFenceStyle === 'cyber_grid'
                  ? '#4f46e5'
                  : '#b45309';
              const lightCol =
                world.borderFenceStyle === 'wood_highway'
                  ? '#d98a3c'
                  : world.borderFenceStyle === 'steel_military'
                  ? '#94a3b8'
                  : world.borderFenceStyle === 'cyber_grid'
                  ? '#818cf8'
                  : '#f59e0b';

              ctx.fillStyle = mainCol;
              ctx.strokeStyle = '#090d16';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.roundRect(bx, ry + 8, railW, tileSize - 16, 4);
              ctx.fill();
              ctx.stroke();

              // Bisel de luz lateral
              ctx.fillStyle = lightCol;
              ctx.fillRect(bx + 3, ry + 11, 5, tileSize - 22);

              for (let py = ry + 18; py < ry + tileSize - 20; py += 42) {
                ctx.fillStyle = lightCol;
                ctx.beginPath();
                ctx.roundRect(bx - 3, py, railW + 6, 15, 3);
                ctx.fill();
                ctx.stroke();

                // Remaches metálicos
                ctx.fillStyle = '#e2e8f0';
                ctx.beginPath();
                ctx.arc(bx + 3, py + 7.5, 2, 0, Math.PI * 2);
                ctx.arc(bx + railW - 3, py + 7.5, 2, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            };

            drawBarrier3D(rcx - 196, yPos, true);
            drawBarrier3D(rcx + 196, yPos, false);
          }
        }
      }

      // 2. PORTALES HOLOGRÁFICOS 3D DEL MUNDO
      for (const tp of world.teleporters) {
        const pulse = Math.sin(nowMs * 0.005) * 6;
        ctx.save();
        ctx.translate(tp.x, tp.y);

        const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, 76 + pulse);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.25, tp.color);
        grad.addColorStop(0.65, `${tp.color}55`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 76 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Anillos rúnicos giratorios dobles
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = tp.color;
        ctx.beginPath();
        ctx.arc(0, 0, 42, nowMs * 0.003, nowMs * 0.003 + Math.PI * 1.4);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -nowMs * 0.004, -nowMs * 0.004 + Math.PI * 1.1);
        ctx.stroke();

        ctx.font = '900 12px "Fredoka", "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(tp.badge, 0, -56);
        ctx.fillStyle = '#fde047';
        ctx.fillText(tp.badge, 0, -56);

        ctx.font = '800 11px "Inter", sans-serif';
        ctx.strokeText(tp.label, 0, 64);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tp.label, 0, 64);

        if (Math.hypot(p.x - tp.x, p.y - tp.y) < 78 && p.portalCharge > 0) {
          const progress = Math.min(1, p.portalCharge / 1.15);
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, 0, 52, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.stroke();
        }

        ctx.restore();
      }

      // 3. CHARCOS DE NAPALM / PLASMA CON BURBUJAS ÍGNEAS
      for (const h of hazardsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.82, h.life / 0.6);
        const grad = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.28, h.isEvo ? '#67e8f9' : '#fef08a');
        grad.addColorStop(0.65, h.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();

        // Anillo ardiente pulsante
        ctx.strokeStyle = h.isEvo ? '#22d3ee' : '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius * (0.65 + Math.sin(nowMs * 0.01 + h.id) * 0.15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 4. AURA OCTOGONAL HOLOGRÁFICA DEL CAMPO DE FUERZA
      const forceLv = weapons.forcefield || 0;
      if (forceLv > 0) {
        const isEvo = forceLv >= MAX_ITEM_LEVEL;
        const auraRadius = (isEvo ? 132 : 65 + (forceLv - 1) * 7) * stats.areaMult;
        ctx.save();
        ctx.translate(p.x, p.y);

        const auraGrad = ctx.createRadialGradient(0, 0, auraRadius * 0.2, 0, 0, auraRadius);
        auraGrad.addColorStop(0, 'rgba(16, 185, 129, 0.02)');
        auraGrad.addColorStop(0.75, isEvo ? 'rgba(16, 185, 129, 0.14)' : 'rgba(34, 197, 94, 0.12)');
        auraGrad.addColorStop(1, isEvo ? 'rgba(52, 211, 153, 0.32)' : 'rgba(74, 222, 128, 0.26)');

        const drawPolygonRing = (
          r: number,
          sides: number,
          rot: number,
          strokeCol: string,
          fillStyle: string | CanvasGradient,
          lineW: number
        ) => {
          ctx.save();
          ctx.rotate(rot);
          ctx.beginPath();
          for (let s = 0; s < sides; s++) {
            const ang = (s * Math.PI * 2) / sides;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = fillStyle;
          ctx.fill();
          ctx.lineWidth = lineW;
          ctx.strokeStyle = strokeCol;
          ctx.stroke();
          ctx.restore();
        };

        drawPolygonRing(
          auraRadius,
          8,
          nowMs * 0.0009,
          isEvo ? '#34d399' : '#4ade80',
          auraGrad,
          3.5
        );
        drawPolygonRing(
          auraRadius * 0.72,
          8,
          -nowMs * 0.0012,
          isEvo ? 'rgba(110, 231, 183, 0.85)' : 'rgba(134, 239, 172, 0.8)',
          'rgba(34, 197, 94, 0.05)',
          2
        );
        ctx.restore();
      }

      // 5. CRISTALES DE XP FACETADOS, MONEDAS 3D Y COFRE ARCOÍRIS DE LUJO
      for (const item of dropsRef.current) {
        if (item.type === 'chest_rainbow') {
          ctx.save();
          ctx.translate(item.x, item.y);

          // Sombra y halo dorado en el suelo
          const groundGlow = ctx.createRadialGradient(0, 10, 4, 0, 10, 48);
          groundGlow.addColorStop(0, 'rgba(250, 204, 21, 0.65)');
          groundGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
          ctx.fillStyle = groundGlow;
          ctx.beginPath();
          ctx.ellipse(0, 12, 46, 20, 0, 0, Math.PI * 2);
          ctx.fill();

          const beamHeight = 760;
          const beamWidth = 44;
          const rainbowColors = [
            'rgba(239, 68, 68, 0.58)',
            'rgba(249, 115, 22, 0.58)',
            'rgba(250, 204, 21, 0.62)',
            'rgba(34, 197, 94, 0.58)',
            'rgba(56, 189, 248, 0.58)',
            'rgba(168, 85, 247, 0.58)',
          ];
          const stripeW = beamWidth / rainbowColors.length;
          for (let c = 0; c < rainbowColors.length; c++) {
            const sx = -beamWidth / 2 + c * stripeW;
            const vGrad = ctx.createLinearGradient(0, 0, 0, -beamHeight);
            vGrad.addColorStop(0, rainbowColors[c]);
            vGrad.addColorStop(0.85, rainbowColors[c]);
            vGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = vGrad;
            ctx.fillRect(sx, -beamHeight, stripeW + 0.6, beamHeight);
          }

          const arcRadii = [60, 55, 50, 45, 40, 35];
          for (let c = 0; c < arcRadii.length; c++) {
            ctx.beginPath();
            ctx.arc(0, 6, arcRadii[c], Math.PI * 1.08, Math.PI * 1.92);
            ctx.strokeStyle = rainbowColors[c];
            ctx.lineWidth = 5;
            ctx.stroke();
          }

          const bobY = Math.sin(item.bobPhase) * 3;
          ctx.translate(0, bobY);

          // Cuerpo del cofre con degradado rubí 3D
          const chestGrad = ctx.createLinearGradient(0, -18, 0, 18);
          chestGrad.addColorStop(0, '#f87171');
          chestGrad.addColorStop(0.45, '#dc2626');
          chestGrad.addColorStop(1, '#7f1d1d');
          ctx.fillStyle = chestGrad;
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.roundRect(-22, -17, 44, 34, 6);
          ctx.fill();
          ctx.stroke();

          // Bandas de oro reluciente
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-22, -4, 44, 7);
          ctx.strokeRect(-22, -4, 44, 7);
          ctx.fillRect(-19, -16, 6, 32);
          ctx.fillRect(13, -16, 6, 32);

          // Gema central del cofre
          ctx.beginPath();
          ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fde047';
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();

          ctx.restore();
        } else if (
          item.type === 'xp_green' ||
          item.type === 'xp_blue' ||
          item.type === 'xp_gold'
        ) {
          ctx.save();
          ctx.translate(item.x, item.y);
          const r = item.type === 'xp_gold' ? 9.5 : item.type === 'xp_blue' ? 8.2 : 7.2;
          const mainCol =
            item.type === 'xp_gold'
              ? '#facc15'
              : item.type === 'xp_blue'
              ? '#38bdf8'
              : '#4ade80';
          const darkCol =
            item.type === 'xp_gold'
              ? '#a16207'
              : item.type === 'xp_blue'
              ? '#0369a1'
              : '#15803d';

          // Halo suave bajo el cristal
          ctx.fillStyle =
            item.type === 'xp_gold'
              ? 'rgba(250, 204, 21, 0.28)'
              : item.type === 'xp_blue'
              ? 'rgba(56, 189, 248, 0.25)'
              : 'rgba(74, 222, 128, 0.24)';
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
          ctx.fill();

          // Rombo facetado exterior
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.88, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.88, 0);
          ctx.closePath();
          ctx.fillStyle = mainCol;
          ctx.fill();
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = '#052e16';
          ctx.stroke();

          // Faceta oscura inferior derecha para efecto 3D
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(r * 0.88, 0);
          ctx.lineTo(0, r);
          ctx.closePath();
          ctx.fillStyle = darkCol;
          ctx.fill();

          // Brillo cristalino superior izquierdo
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.72);
          ctx.lineTo(-r * 0.48, -r * 0.12);
          ctx.lineTo(0, -r * 0.18);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (item.type === 'coin') {
          ctx.save();
          ctx.translate(item.x, item.y);
          const spinScale = 0.72 + Math.abs(Math.sin(nowMs * 0.005 + item.id)) * 0.28;
          ctx.scale(spinScale, 1);

          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = '#000000';
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
          ctx.strokeStyle = '#ca8a04';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          ctx.fillStyle = '#fef08a';
          ctx.fillRect(-1.5, -4, 3, 8);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(item.x, item.y + Math.sin(item.bobPhase) * 3.5);
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 2);
          ctx.fillStyle =
            item.type === 'magnet'
              ? '#2563eb'
              : item.type === 'meat'
              ? '#16a34a'
              : '#dc2626';
          ctx.fill();
          ctx.lineWidth = 2.8;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
          ctx.font = '15px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            item.type === 'magnet' ? '🧲' : item.type === 'meat' ? '🍖' : '💣',
            0,
            1
          );
          ctx.restore();
        }
      }

      // Fantasmas de muerte al caer enemigos
      for (const g of ghostsRef.current) {
        ctx.save();
        ctx.globalAlpha = (g.life / g.maxLife) * 0.85;
        ctx.translate(g.x, g.y - (1 - g.life / g.maxLife) * 24);
        ctx.fillStyle = '#ecfccb';
        ctx.strokeStyle = '#14532d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, g.radius * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 6. SOLDADOS ZOMBI, ÉLITES Y JEFES EN HD 2.5D
      for (const e of enemiesRef.current) {
        ctx.save();
        const bob = Math.sin(e.walkCycle) * 2.2;
        const legSwing = Math.sin(e.walkCycle) * 4.5;
        ctx.translate(e.x, e.y + bob);

        // Sombra elíptica suave bajo el enemigo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
        ctx.beginPath();
        ctx.ellipse(0, e.radius + 3, e.radius * 0.92, e.radius * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();

        // Aura amenazante para Élites y Jefes
        if (e.isElite || e.isBoss) {
          const auraCol = e.isBoss ? 'rgba(239, 68, 68, 0.28)' : 'rgba(245, 158, 11, 0.22)';
          ctx.fillStyle = auraCol;
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 8 + Math.sin(nowMs * 0.008) * 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = e.isBoss ? '#ef4444' : '#facc15';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        const scale = e.radius / 17;
        ctx.scale(e.facingLeft ? -scale : scale, scale);

        const isFlash = e.hitFlash > 0;

        // Piernas animadas con botas tácticas
        ctx.fillStyle = isFlash ? '#ffffff' : '#1e293b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(-8 + legSwing * 0.4, 9, 6.5, 8, 2);
        ctx.roundRect(1.5 - legSwing * 0.4, 9, 6.5, 8, 2);
        ctx.fill();
        ctx.stroke();

        // Torso / Uniforme con cinturón táctico
        ctx.fillStyle = isFlash ? '#ffffff' : e.bodyColor;
        ctx.beginPath();
        ctx.roundRect(-11, -3, 22, 15, 4);
        ctx.fill();
        ctx.stroke();

        if (!isFlash) {
          // Cinturón y hebilla
          ctx.fillStyle = '#27272a';
          ctx.fillRect(-10, 6, 20, 3.5);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-2.5, 5.5, 5, 4.5);
        }

        // Cabeza Zombi HD con mandíbula y cicatriz
        ctx.fillStyle = isFlash ? '#ffffff' : '#86efac';
        ctx.beginPath();
        ctx.roundRect(-12, -17, 24, 16, 5);
        ctx.fill();
        ctx.stroke();

        // Ojos brillantes (rojos furiosos en Élites/Jefes, amarillos/blancos en tropas)
        ctx.fillStyle = e.isBoss ? '#ef4444' : e.isElite ? '#fde047' : '#ffffff';
        ctx.beginPath();
        ctx.arc(2, -9.5, 3.4, 0, Math.PI * 2);
        ctx.arc(8.2, -9.5, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = e.isBoss ? '#fef08a' : '#090d16';
        ctx.beginPath();
        ctx.arc(2.8, -9.5, 1.4, 0, Math.PI * 2);
        ctx.arc(9.0, -9.5, 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Boca dentada gruñendo
        if (!isFlash) {
          ctx.fillStyle = '#064e3b';
          ctx.fillRect(1, -4.5, 8, 2.5);
        }

        // Casco Militar Abovedado con Brillo Especular 3D
        ctx.fillStyle = isFlash ? '#ffffff' : e.helmetColor;
        ctx.beginPath();
        ctx.arc(0, -14, 14, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (!isFlash) {
          // Brillo superior en el casco
          ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.beginPath();
          ctx.ellipse(-3, -21, 6, 2.5, -0.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Correa del casco
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-13.5, -16, 27, 3.8);
        ctx.strokeRect(-13.5, -16, 27, 3.8);

        // Fusil / Arma de asalto con cañón y cargador
        ctx.fillStyle = isFlash ? '#ffffff' : e.gunColor;
        ctx.beginPath();
        ctx.roundRect(-3, 2.5, 20, 5.5, 1.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillRect(6, 7.5, 4.5, 5.5);
        ctx.strokeRect(6, 7.5, 4.5, 5.5);

        ctx.restore();

        // Barra de vida de enemigos dañados con borde negro y color por rango
        if (e.hp < e.maxHp) {
          const bw = e.isBoss || e.isElite ? e.radius * 2.3 : e.radius * 1.8;
          const bh = e.isBoss || e.isElite ? 5.5 : 4;
          ctx.fillStyle = '#000000';
          ctx.fillRect(e.x - bw / 2 - 1.5, e.y - e.radius - 14, bw + 3, bh + 3);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(e.x - bw / 2, e.y - e.radius - 12.5, bw, bh);
          ctx.fillStyle = e.isBoss ? '#ef4444' : e.isElite ? '#f59e0b' : '#22c55e';
          ctx.fillRect(
            e.x - bw / 2,
            e.y - e.radius - 12.5,
            bw * Math.max(0, e.hp / e.maxHp),
            bh
          );
        }
      }

      // 7. DISCOS DE SIERRA DEL EXOTRAJE GUARDIÁN
      const guardianLv = weapons.guardian || 0;
      if (guardianLv > 0) {
        const isEvo = guardianLv >= MAX_ITEM_LEVEL;
        const bladeCount = isEvo ? 6 : Math.min(5, 2 + Math.floor(guardianLv / 3));
        const orbitRadius = (isEvo ? 105 : 85) * stats.areaMult;
        for (let i = 0; i < bladeCount; i++) {
          const ang = guardianAngle + (i * Math.PI * 2) / bladeCount;
          const bx = p.x + Math.cos(ang) * orbitRadius;
          const by = p.y + Math.sin(ang) * orbitRadius;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(nowMs * 0.018);

          // Dientes de sierra metálicos
          const r = isEvo ? 18 : 14;
          ctx.fillStyle = isEvo ? '#ef4444' : '#f59e0b';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          const teeth = 8;
          for (let t = 0; t < teeth * 2; t++) {
            const tr = t % 2 === 0 ? r + 4 : r - 2;
            const ta = (t * Math.PI) / teeth;
            if (t === 0) ctx.moveTo(Math.cos(ta) * tr, Math.sin(ta) * tr);
            else ctx.lineTo(Math.cos(ta) * tr, Math.sin(ta) * tr);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 8. DURIÁN GIGANTE / CALTROPS CON SOMBRA Y PÚAS 3D
      const durianLv = weapons.durian || 0;
      if (durianLv > 0) {
        const isEvo = durianLv >= MAX_ITEM_LEVEL;
        const d = durianRef.current;
        const durRadius = (isEvo ? 40 : 26 + durianLv * 1.5) * stats.areaMult;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.fillStyle = isEvo ? '#e11d48' : '#84cc16';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const spikes = 14;
        for (let s = 0; s < spikes * 2; s++) {
          const r = s % 2 === 0 ? durRadius + 8 : durRadius - 4;
          const a = (s * Math.PI) / spikes;
          if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isEvo ? '#fda4af' : '#d9f99d';
        ctx.beginPath();
        ctx.arc(0, 0, durRadius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 9. DIBUJAR AL HÉROE HD 2.5D CON SUS 8 RANURAS VISUALES
      ctx.save();
      ctx.translate(p.x, p.y);

      // Flecha indicadora de dirección sobre la cabeza
      if (!p.isDead) {
        ctx.save();
        ctx.translate(0, -34);
        ctx.fillStyle = '#dcfce7';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(6.5, 4);
        ctx.lineTo(-6.5, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Sombra proyectada y anillo de poder bajo los pies del héroe
      const heroGlow = ctx.createRadialGradient(0, 16, 4, 0, 16, 30);
      heroGlow.addColorStop(0, `${stats.hero.visorColor}66`);
      heroGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = heroGlow;
      ctx.beginPath();
      ctx.ellipse(0, 17, 28, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(0, 17, 16, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();

      const heroBob = p.isDead ? 0 : Math.sin(p.walkCycle) * 2;
      const heroLegSwing = p.isDead ? 0 : Math.sin(p.walkCycle) * 5;
      ctx.save();
      ctx.translate(0, heroBob);
      if (p.isDead) {
        ctx.translate(0, 6);
        ctx.rotate(Math.PI / 2);
      } else if (p.facingLeft) {
        ctx.scale(-1, 1);
      }

      const slots = save.equippedSlots;
      const bodyDef = slots.body ? WEAPONS_CATALOG[slots.body] : null;
      const helmetDef = slots.helmet ? WEAPONS_CATALOG[slots.helmet] : null;
      const isHurt = p.hurtFlash > 0;

      // Bufanda / Capa ondeando al viento detrás del héroe
      const capeWave = Math.sin(nowMs * 0.012 + p.walkCycle) * 4;
      ctx.fillStyle = isHurt ? '#ef4444' : stats.hero.scarfColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.quadraticCurveTo(-22, 2 + capeWave * 0.5, -25, 11 + capeWave);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Botas tácticas animadas del héroe
      ctx.fillStyle = isHurt ? '#ffffff' : '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-8 + heroLegSwing * 0.45, 9, 6.5, 8.5, 2.5);
      ctx.roundRect(1.5 - heroLegSwing * 0.45, 9, 6.5, 8.5, 2.5);
      ctx.fill();
      ctx.stroke();

      // Módulos de Hombro Izquierdo y Hombro Derecho con cañón y LED
      if (slots.leftShoulder) {
        const lsDef = WEAPONS_CATALOG[slots.leftShoulder];
        ctx.fillStyle = isHurt ? '#ef4444' : lsDef.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(-18, -13, 9, 11, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(-13.5, -9, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (slots.rightShoulder) {
        const rsDef = WEAPONS_CATALOG[slots.rightShoulder];
        ctx.fillStyle = isHurt ? '#ef4444' : rsDef.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(9, -13, 9, 11, 2.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(13.5, -9, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Armadura de Cuerpo con Reactor Central Luminoso
      ctx.fillStyle = isHurt ? '#ef4444' : bodyDef ? bodyDef.color : stats.hero.scarfColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-13, -4, 24, 16, 4.5);
      ctx.fill();
      ctx.stroke();

      if (!isHurt) {
        // Núcleo de energía en el pecho de la armadura
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 4.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Cabeza HD
      ctx.fillStyle = isHurt ? '#fca5a5' : '#fed7aa';
      ctx.beginPath();
      ctx.roundRect(-11.5, -19, 23, 16.5, 5.5);
      ctx.fill();
      ctx.stroke();

      // Casco / Visor Táctico con Reflejo Cristalino
      ctx.fillStyle = isHurt ? '#ffffff' : helmetDef ? helmetDef.color : stats.hero.visorColor;
      ctx.beginPath();
      ctx.roundRect(-10.5, -18, 21, 8.5, 3.5);
      ctx.fill();
      ctx.stroke();

      if (!isHurt) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillRect(-7, -16.5, 7, 2.5);
      }

      // Cuello de la bufanda
      ctx.fillStyle = isHurt ? '#dc2626' : stats.hero.scarfColor;
      ctx.beginPath();
      ctx.roundRect(-11.5, -6, 23, 6, 2);
      ctx.fill();
      ctx.stroke();

      // Función auxiliar para dibujar el arma equipada en cada mano con alto detalle
      const drawEquippedHandWeapon = (wId: WeaponId, isLeftHand: boolean) => {
        const wDef = WEAPONS_CATALOG[wId];
        const wLv = weapons[wId] || 1;
        const isEvo = wLv >= MAX_ITEM_LEVEL;
        ctx.save();
        ctx.translate(isLeftHand ? -13 : 13, 2.5);
        ctx.rotate(isLeftHand ? -2.65 : -0.35);

        ctx.fillStyle = isEvo ? wDef.evoColor : wDef.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.3;

        if (wId === 'shotgun' || wId === 'plasma_rifle') {
          ctx.beginPath();
          ctx.roundRect(-2, -3.5, 18, 7, 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(5, -1.5, 8, 3);
        } else if (wId === 'katana' || wId === 'reaper_scythe') {
          ctx.beginPath();
          ctx.moveTo(22, 0);
          ctx.lineTo(0, -4.5);
          ctx.lineTo(-4, 0);
          ctx.lineTo(0, 4.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-2, -5.5);
          ctx.lineTo(1.5, 0);
          ctx.lineTo(-2, 5.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      };

      if (slots.rightHand) drawEquippedHandWeapon(slots.rightHand, false);
      if (slots.leftHand) drawEquippedHandWeapon(slots.leftHand, true);

      ctx.restore();

      if (p.isDead) {
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀', 0, -18);
      }

      // Dibujar los 2 Acompañantes activos alrededor del Héroe con hélices/halo
      const drawCompanionUnit = (compId: WeaponId | null, sideSign: number) => {
        if (!compId || p.isDead) return;
        const cDef = WEAPONS_CATALOG[compId];
        const lv = weapons[compId] || 1;
        const isEvo = lv >= MAX_ITEM_LEVEL;
        const cx = Math.cos(companionAngle + (sideSign > 0 ? 0 : Math.PI)) * 40;
        const cy = -25 + Math.sin(companionAngle + (sideSign > 0 ? 0 : Math.PI)) * 16;

        ctx.save();
        ctx.translate(cx, cy);

        // Halo de energía bajo el acompañante
        ctx.fillStyle = `${isEvo ? cDef.evoColor : cDef.color}44`;
        ctx.beginPath();
        ctx.arc(0, 0, isEvo ? 16 : 13, 0, Math.PI * 2);
        ctx.fill();

        // Hélices giratorias para drones
        const rotorAng = nowMs * 0.025;
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rotorAng) * 14, Math.sin(rotorAng) * 14);
        ctx.lineTo(-Math.cos(rotorAng) * 14, -Math.sin(rotorAng) * 14);
        ctx.stroke();

        ctx.fillStyle = isEvo ? cDef.evoColor : cDef.color;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, isEvo ? 11.5 : 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isEvo ? cDef.evoIcon : cDef.icon, 0, 0.5);
        ctx.restore();
      };

      drawCompanionUnit(save.equippedSlots.companion1, 1);
      drawCompanionUnit(save.equippedSlots.companion2, -1);

      // Barra de vida tipo cápsula brillante debajo del héroe
      const hpBarW = 54;
      const hpBarH = 8.5;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(-hpBarW / 2 - 2, 22, hpBarW + 4, hpBarH + 4, 5);
      ctx.fill();

      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.roundRect(-hpBarW / 2, 24, hpBarW, hpBarH, 3.5);
      ctx.fill();

      const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp));
      if (hpPct > 0) {
        ctx.fillStyle = hpPct > 0.35 ? '#84cc16' : '#ef4444';
        ctx.beginPath();
        ctx.roundRect(-hpBarW / 2, 24, hpBarW * hpPct, hpBarH, 3.5);
        ctx.fill();
        // Reflejo blanco superior en la barra de vida
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillRect(-hpBarW / 2 + 2, 25, Math.max(0, hpBarW * hpPct - 4), 2.2);
      }

      ctx.font = '900 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#000000';
      const hpLabel = p.isDead ? 'MUERTO (0 HP)' : `${Math.ceil(p.hp)}/${Math.round(p.maxHp)}`;
      ctx.strokeText(hpLabel, 0, 42);
      ctx.fillStyle = p.isDead ? '#ef4444' : '#ffffff';
      ctx.fillText(hpLabel, 0, 42);

      ctx.restore();

      // 10. DIBUJAR PROYECTILES CON BRILLO Y ESTELAS VOLUMÉTRICAS
      for (const proj of projectilesRef.current) {
        if (proj.trail && proj.trail.length > 1) {
          ctx.save();
          for (let t = 0; t < proj.trail.length; t++) {
            const pt = proj.trail[t];
            const ratio = (t + 1) / proj.trail.length;
            ctx.fillStyle =
              proj.weaponId === 'drone'
                ? proj.isEvo
                  ? `rgba(244, 63, 94, ${ratio * 0.6})`
                  : `rgba(56, 189, 248, ${ratio * 0.55})`
                : proj.weaponId === 'rpg'
                ? `rgba(251, 146, 60, ${ratio * 0.65})`
                : `rgba(168, 85, 247, ${ratio * 0.6})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, ratio * 5.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.rotation);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.2;

        if (proj.weaponId === 'drone' || proj.weaponId === 'rpg') {
          const scale = proj.weaponId === 'rpg' ? 1.38 : 1.05;
          ctx.scale(scale, scale);

          // Llama propulsora de doble capa
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.moveTo(-8, -3.8);
          ctx.lineTo(-19 - Math.random() * 6, 0);
          ctx.lineTo(-8, 3.8);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.moveTo(-8, -2);
          ctx.lineTo(-13 - Math.random() * 4, 0);
          ctx.lineTo(-8, 2);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = proj.isEvo ? '#fde047' : '#f8fafc';
          ctx.beginPath();
          ctx.roundRect(-8, -4.2, 14, 8.4, 2.5);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = proj.isEvo && proj.weaponId === 'rpg' ? '#3b82f6' : '#ef4444';
          ctx.beginPath();
          ctx.moveTo(12.5, 0);
          ctx.lineTo(5, -4.8);
          ctx.lineTo(5, 4.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#475569';
          ctx.fillRect(-9, -6.2, 4.2, 2.6);
          ctx.fillRect(-9, 3.6, 4.2, 2.6);
        } else if (proj.weaponId === 'kunai') {
          if (proj.isEvo) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            for (let s = 0; s < 4; s++) {
              const a = (s * Math.PI) / 2;
              ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14);
              ctx.lineTo(Math.cos(a + 0.4) * 5.5, Math.sin(a + 0.4) * 5.5);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(13, 0);
            ctx.lineTo(-4, -5.5);
            ctx.lineTo(-1, 0);
            ctx.lineTo(-4, 5.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(-7, 0, 2.6, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (proj.weaponId === 'soccer') {
          ctx.fillStyle = proj.isEvo ? '#06b6d4' : '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius * 0.42, 0, Math.PI * 2);
          ctx.fill();
        } else if (proj.weaponId === 'boomerang' || proj.weaponId === 'reaper_scythe') {
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.moveTo(-13, -15);
          ctx.lineTo(13, 0);
          ctx.lineTo(-13, 15);
          ctx.lineTo(-3, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (proj.weaponId === 'drill' || proj.weaponId === 'railgun') {
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.moveTo(18, 0);
          ctx.lineTo(-11, -6.5);
          ctx.lineTo(-5, 0);
          ctx.lineTo(-11, 6.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (proj.weaponId === 'katana') {
          ctx.strokeStyle = proj.color;
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, -0.88, 0.88);
          ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius - 2, -0.75, 0.75);
          ctx.stroke();
        } else {
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 11. PARTÍCULAS DE IMPACTO Y CHISPAS LUMINOSAS
      for (const pt of particlesRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 12. ONDAS DE EXPLOSIÓN CON DOBLE ANILLO Y NÚCLEO INCANDESCENTE
      for (const exp of explosionsRef.current) {
        ctx.save();
        const alpha = Math.max(0, exp.life / exp.maxLife);
        ctx.globalAlpha = alpha;
        const expGrad = ctx.createRadialGradient(
          exp.x,
          exp.y,
          2,
          exp.x,
          exp.y,
          Math.max(4, exp.radius)
        );
        expGrad.addColorStop(0, '#ffffff');
        expGrad.addColorStop(0.4, exp.color);
        expGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = expGrad;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = exp.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 13. RAYOS ELÉCTRICOS Y BARRIDOS LÁSER ORBITALES
      for (const bolt of lightningsRef.current) {
        ctx.save();
        ctx.globalAlpha = bolt.life / bolt.maxLife;
        if (bolt.isLaserSweep) {
          const offset = (1 - bolt.life / bolt.maxLife) * 65;
          ctx.strokeStyle = bolt.color;
          ctx.lineWidth = bolt.isEvo ? 9 : 6;
          ctx.beginPath();
          ctx.moveTo(bolt.x - bolt.radius, bolt.y - 65 + offset);
          ctx.lineTo(bolt.x + bolt.radius, bolt.y - 65 + offset);
          ctx.moveTo(bolt.x - bolt.radius, bolt.y + 65 - offset);
          ctx.lineTo(bolt.x + bolt.radius, bolt.y + 65 - offset);
          ctx.stroke();
        } else {
          ctx.strokeStyle = bolt.color;
          ctx.lineWidth = bolt.isEvo ? 7 : 4.5;
          ctx.beginPath();
          ctx.moveTo(bolt.x - 14, bolt.y - 320);
          ctx.lineTo(bolt.x + 12, bolt.y - 180);
          ctx.lineTo(bolt.x - 9, bolt.y - 90);
          ctx.lineTo(bolt.x, bolt.y);
          ctx.stroke();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(bolt.x, bolt.y, bolt.radius * 0.65, 0, Math.PI * 2);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
      }

      // 14. NÚMEROS DE DAÑO FLOTANTES CON BORDE GRUESO
      for (const pop of popupsRef.current) {
        ctx.save();
        ctx.translate(pop.x, pop.y);
        ctx.scale(pop.scale, pop.scale);
        ctx.font = '900 17px "Lilita One", "Fredoka", "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4.5;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(pop.text, 0, 0);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 15. VIÑETA CINEMATOGRÁFICA Y FLASH ROJO AL RECIBIR DAÑO
      const vignette = ctx.createRadialGradient(
        viewW / 2,
        viewH / 2,
        Math.min(viewW, viewH) * 0.35,
        viewW / 2,
        viewH / 2,
        Math.max(viewW, viewH) * 0.75
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(
        1,
        p.hurtFlash > 0 ? 'rgba(220, 38, 38, 0.48)' : 'rgba(2, 6, 23, 0.38)'
      );
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, viewW, viewH);

      const drawEdgeIndicator = (
        targetX: number,
        targetY: number,
        badgeIcon: string,
        borderColor: string,
        distLabel: string
      ) => {
        const dx = targetX - p.x;
        const dy = targetY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < Math.min(viewW, viewH) * 0.42) return;

        const ang = Math.atan2(dy, dx);
        const pad = 42;
        const halfW = viewW / 2 - pad;
        const halfH = viewH / 2 - pad - 55;
        const cos = Math.cos(ang);
        const sin = Math.sin(ang);
        const scale = Math.min(
          Math.abs(halfW / (cos || 0.0001)),
          Math.abs(halfH / (sin || 0.0001))
        );
        const ix = viewW / 2 + cos * scale;
        const iy = viewH / 2 + 20 + sin * scale;

        ctx.save();
        ctx.translate(ix, iy);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeIcon, 0, -1);

        ctx.font = '800 9px "Inter", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(distLabel, 0, 24);
        ctx.restore();
      };

      const rainbowChest = dropsRef.current.find((d) => d.type === 'chest_rainbow');
      if (rainbowChest) {
        const d = Math.round(Math.hypot(rainbowChest.x - p.x, rainbowChest.y - p.y) / 10);
        drawEdgeIndicator(rainbowChest.x, rainbowChest.y, '🌈', '#facc15', `${d}m`);
      }
      if (world.teleporters.length > 0) {
        let nearestTp = world.teleporters[0];
        let minTpDist = Infinity;
        for (const tp of world.teleporters) {
          const d = Math.hypot(tp.x - p.x, tp.y - p.y);
          if (d < minTpDist) {
            minTpDist = d;
            nearestTp = tp;
          }
        }
        drawEdgeIndicator(
          nearestTp.x,
          nearestTp.y,
          '🌀',
          nearestTp.color,
          `${Math.round(minTpDist / 10)}m`
        );
      }

      // Joystick Circular Semitransparente
      const joy = joystickRef.current;
      const defaultJoyX = viewW / 2;
      const defaultJoyY = viewH * 0.72;
      const jx = joy.active ? joy.originX : defaultJoyX;
      const jy = joy.active ? joy.originY : defaultJoyY;
      const outerRadius = 64;
      const innerRadius = 26;
      const knobX = joy.active ? joy.currentX : defaultJoyX;
      const knobY = joy.active ? joy.currentY : defaultJoyY;

      ctx.save();
      ctx.beginPath();
      ctx.arc(jx, jy, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(knobX, knobY, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.stroke();
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (
        canvas.width !== Math.round(rect.width * dpr) ||
        canvas.height !== Math.round(rect.height * dpr)
      ) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      try {
        if (!isPausedRef.current) {
          updateSimulation(dt, rect.width, rect.height);
        }
        renderScene(rect.width, rect.height, now);
      } catch {
        // Prevenir que cualquier excepción de dibujo detenga el bucle 60 FPS
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPausedRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    e.currentTarget.setPointerCapture(e.pointerId);
    joystickRef.current = {
      active: true,
      pointerId: e.pointerId,
      originX: x,
      originY: y,
      currentX: x,
      currentY: y,
      dx: 0,
      dy: 0,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const joy = joystickRef.current;
    if (!joy.active || joy.pointerId !== e.pointerId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - joy.originX;
    const dy = y - joy.originY;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 56;

    if (dist > 0) {
      const clamped = Math.min(dist, maxRadius);
      joy.currentX = joy.originX + (dx / dist) * clamped;
      joy.currentY = joy.originY + (dy / dist) * clamped;
      joy.dx = (dx / dist) * (clamped / maxRadius);
      joy.dy = (dy / dist) * (clamped / maxRadius);
    } else {
      joy.currentX = x;
      joy.currentY = y;
      joy.dx = 0;
      joy.dy = 0;
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (joystickRef.current.pointerId === e.pointerId) {
      joystickRef.current.active = false;
      joystickRef.current.pointerId = -1;
      joystickRef.current.dx = 0;
      joystickRef.current.dy = 0;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      className="w-full h-full block touch-none cursor-grab active:cursor-grabbing"
    />
  );
};
