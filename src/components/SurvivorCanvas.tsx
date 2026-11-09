import React, { useEffect, useRef } from 'react';
import {
  HEROES_CATALOG,
  PASSIVES_CATALOG,
  PassiveId,
  WEAPONS_CATALOG,
  WORLDS,
  WeaponId,
  WorldDefinition,
  WorldTeleporter,
} from '../data/gameCatalog';
import { PersistentSaveData } from '../utils/saveState';
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

interface SurvivorCanvasProps {
  saveData: PersistentSaveData;
  currentWorld: WorldDefinition;
  isPaused: boolean;
  spawnBossSignal: number;
  onGainXpAndCoins: (xpDelta: number, goldDelta: number, killsDelta: number, bossesDelta: number) => void;
  onOpenRainbowChest: () => void;
  onPlayerPositionChange: (x: number, y: number) => void;
  onEnterTeleporter: (teleporter: WorldTeleporter) => void;
  onNearbyTeleporterChange: (teleporter: WorldTeleporter | null) => void;
  onActiveBossChange: (boss: { name: string; hp: number; maxHp: number } | null) => void;
}

export const SurvivorCanvas: React.FC<SurvivorCanvasProps> = ({
  saveData,
  currentWorld,
  isPaused,
  spawnBossSignal,
  onGainXpAndCoins,
  onOpenRainbowChest,
  onPlayerPositionChange,
  onEnterTeleporter,
  onNearbyTeleporterChange,
  onActiveBossChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Referencias mutables para que el loop a 60fps siempre lea el estado más reciente sin recrearse
  const saveRef = useRef<PersistentSaveData>(saveData);
  saveRef.current = saveData;

  const worldRef = useRef<WorldDefinition>(currentWorld);
  const prevWorldIdRef = useRef<string>(currentWorld.id);

  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;

  const callbacksRef = useRef({
    onGainXpAndCoins,
    onOpenRainbowChest,
    onPlayerPositionChange,
    onEnterTeleporter,
    onNearbyTeleporterChange,
    onActiveBossChange,
  });
  callbacksRef.current = {
    onGainXpAndCoins,
    onOpenRainbowChest,
    onPlayerPositionChange,
    onEnterTeleporter,
    onNearbyTeleporterChange,
    onActiveBossChange,
  };

  // Estado interno del motor en tiempo real
  const playerRef = useRef({
    x: saveData.playerX || 0,
    y: saveData.playerY || 0,
    hp: 1000,
    maxHp: 1000,
    facingAngle: -Math.PI / 2, // Mirando hacia arriba al inicio como en la captura
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
  const hazardsRef = useRef<GroundHazard[]>([]);
  const lightningsRef = useRef<LightningBolt[]>([]);
  const dropsRef = useRef<DroppedItem[]>([]);
  const popupsRef = useRef<DamageNumberPopup[]>([]);
  const ghostsRef = useRef<DeathGhost[]>([]);
  const nextEntityIdRef = useRef<number>(1);
  const weaponTimersRef = useRef<Record<WeaponId, number>>({
    kunai: 0,
    forcefield: 0,
    guardian: 0,
    lightning: 0,
    brick: 0,
    molotov: 0,
    drone: 0,
    katana: 0,
  });

  // Inicializa el escenario como en la captura cuando cambia el mundo o arranca
  const populateWorldInitialScene = (world: WorldDefinition, centerX: number, centerY: number) => {
    enemiesRef.current = [];
    projectilesRef.current = [];
    hazardsRef.current = [];
    lightningsRef.current = [];
    dropsRef.current = [];
    ghostsRef.current = [];

    // 1. Cofre Arcoíris justo arriba del personaje (igual a la foto subida)
    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'chest_rainbow',
      x: centerX,
      y: centerY - 190,
      value: 1,
      magnetized: false,
      bobPhase: 0,
    });

    // 2. Segundo Cofre Arcoíris explorando más adelante
    dropsRef.current.push({
      id: nextEntityIdRef.current++,
      type: 'chest_rainbow',
      x: centerX + 340,
      y: centerY - 420,
      value: 1,
      magnetized: false,
      bobPhase: 1.5,
    });

    // 3. Gemas verdes de XP esparcidas alrededor del héroe exactamente como en la captura
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
        value: Math.round(14 * world.xpMultiplier),
        magnetized: false,
        bobPhase: Math.random() * Math.PI * 2,
      });
    }

    // 4. Imán y Carne de curación cercanos en el mundo abierto
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

    // 5. Soldados Zombi iniciales abajo como en la captura (y alrededor)
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
      const baseHp = 950 * world.enemyHpMultiplier * template.hpRatio;
      enemiesRef.current.push({
        id: nextEntityIdRef.current++,
        x: centerX + ex,
        y: centerY + ey,
        vx: 0,
        vy: 0,
        radius: template.radius,
        hp: baseHp,
        maxHp: baseHp,
        speed: template.speed,
        damage: 18 * world.enemyDamageMultiplier,
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

    // 6. Popup inicial "1310" de impacto de Kunai como guiño visual a la captura
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

  // Detecta cambio de mundo (por teletransportador o menú)
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

  // Invocar Jefe de Mundo bajo demanda (botón "¡Jefe!" o evento)
  useEffect(() => {
    if (spawnBossSignal <= 0) return;
    const world = worldRef.current;
    const p = playerRef.current;
    const save = saveRef.current;
    const bossHp = 18000 * world.enemyHpMultiplier * (1 + save.level * 0.18);
    enemiesRef.current.push({
      id: nextEntityIdRef.current++,
      x: p.x,
      y: p.y - 260,
      vx: 0,
      vy: 0,
      radius: 38,
      hp: bossHp,
      maxHp: bossHp,
      speed: 64,
      damage: 42 * world.enemyDamageMultiplier,
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

  // Loop principal del juego y controles táctiles/teclado
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Inicializar escena en el primer montaje
    populateWorldInitialScene(worldRef.current, playerRef.current.x, playerRef.current.y);

    // Teclado para pruebas en ordenador
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
    let droneAngle = 0;

    // Helper para calcular estadísticas totales del jugador según Nivel + Pasivas + Tienda + Héroe
    const getPlayerStats = () => {
      const s = saveRef.current;
      const hero = HEROES_CATALOG.find((h) => h.id === s.selectedHeroId) || HEROES_CATALOG[0];

      const atkShopMult = 1 + (s.permanentUpgrades.atk - 1) * 0.15;
      const hpShopMult = 1 + (s.permanentUpgrades.hp - 1) * 0.2;
      const speedShopMult = 1 + (s.permanentUpgrades.speed - 1) * 0.08;
      const magnetShopMult = 1 + (s.permanentUpgrades.magnet - 1) * 0.25;
      const critChance = Math.min(0.75, 0.12 + (s.permanentUpgrades.crit - 1) * 0.05);
      const critDamage = 1.85 + (s.permanentUpgrades.crit - 1) * 0.25;
      const greedMult = 1 + (s.permanentUpgrades.greed - 1) * 0.2;

      const bulletLv = s.passives.hi_power_bullet || 0;
      const fitnessLv = s.passives.fitness_guide || 0;
      const sneakersLv = s.passives.sneakers || 0;
      const cubeLv = s.passives.energy_cube || 0;
      const bracerLv = s.passives.exo_bracer || 0;
      const scrollLv = s.passives.scroll || 0;
      const goldLv = s.passives.gold_guide || 0;
      const drinkLv = s.passives.energy_drink || 0;

      const levelBonusMult = 1 + (s.level - 1) * 0.12;
      const totalDamageMult =
        hero.atkMultiplier * atkShopMult * (1 + bulletLv * 0.22) * levelBonusMult;
      const maxHp = Math.round(
        1000 * hero.hpMultiplier * hpShopMult * (1 + fitnessLv * 0.25) * (1 + (s.level - 1) * 0.08)
      );
      const moveSpeed = 165 * hero.speedMultiplier * speedShopMult * (1 + sneakersLv * 0.1);
      const cooldownMult = Math.max(0.28, Math.pow(0.9, cubeLv) / (1 + (s.permanentUpgrades.speed - 1) * 0.04));
      const areaMult = 1 + bracerLv * 0.16;
      const magnetRadius = 92 * magnetShopMult * (1 + sneakersLv * 0.35);
      const xpMult = greedMult * (1 + scrollLv * 0.18);
      const goldMult = greedMult * (1 + goldLv * 0.25);
      const regenPerSec = maxHp * (0.008 + drinkLv * 0.015);

      return {
        hero,
        totalDamageMult,
        maxHp,
        moveSpeed,
        cooldownMult,
        areaMult,
        magnetRadius,
        xpMult,
        goldMult,
        regenPerSec,
        critChance,
        critDamage,
      };
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

      if (knockbackStrength > 0 && !enemy.isBoss) {
        const dx = enemy.x - playerRef.current.x;
        const dy = enemy.y - playerRef.current.y;
        const dist = Math.hypot(dx, dy) || 1;
        enemy.x += (dx / dist) * knockbackStrength;
        enemy.y += (dy / dist) * knockbackStrength;
      }

      soundEngine.playHit(isCrit);

      if (popupsRef.current.length < 45) {
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

    const updateSimulation = (dt: number, viewW: number, viewH: number) => {
      const p = playerRef.current;
      const world = worldRef.current;
      const save = saveRef.current;
      const stats = getPlayerStats();

      p.maxHp = stats.maxHp;
      if (p.hp > p.maxHp) p.hp = p.maxHp;
      p.hp = Math.min(p.maxHp, p.hp + stats.regenPerSec * dt);
      if (p.invulnTimer > 0) p.invulnTimer -= dt;
      if (p.portalCooldown > 0) p.portalCooldown -= dt;

      // 1. Movimiento por Joystick Táctil o Teclado WASD/Flechas
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

      // Sincronizar posición para Auto-Save cada 1.2s
      posSyncAccumulator += dt;
      if (posSyncAccumulator >= 1.2) {
        posSyncAccumulator = 0;
        callbacksRef.current.onPlayerPositionChange(Math.round(p.x), Math.round(p.y));
      }

      // 2. Comprobar cercanía a Teletransportadores del Mundo
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

      // 3. Generación continua de Hordas, Élites y Cofres en el Mundo Abierto
      spawnAccumulator += dt;
      const maxEnemies = 65;
      if (spawnAccumulator >= 0.55 && enemiesRef.current.length < maxEnemies) {
        spawnAccumulator = 0;
        const spawnCount = Math.min(4, maxEnemies - enemiesRef.current.length);
        for (let i = 0; i < spawnCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const spawnRadius = Math.max(viewW, viewH) * 0.58 + Math.random() * 110;
          const sx = p.x + Math.cos(angle) * spawnRadius;
          const sy = p.y + Math.sin(angle) * spawnRadius;

          const isElite = Math.random() < 0.055;
          const template =
            world.enemyTypes[Math.floor(Math.random() * world.enemyTypes.length)];
          const levelScale = 1 + (save.level - 1) * 0.14;
          const hp =
            920 *
            world.enemyHpMultiplier *
            template.hpRatio *
            levelScale *
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
            speed: template.speed * (isElite ? 1.08 : 0.92 + Math.random() * 0.18),
            damage: 18 * world.enemyDamageMultiplier * (isElite ? 1.8 : 1),
            helmetColor: isElite ? '#f59e0b' : template.helmetColor,
            bodyColor: template.bodyColor,
            gunColor: template.gunColor,
            name: isElite ? `Élite ${template.name}` : template.name,
            isElite,
            isBoss: false,
            hitFlash: 0,
            facingLeft: sx > p.x,
            walkCycle: Math.random() * 10,
          });
        }
      }

      // Spawner periódico de Cofres Arcoíris e ítems tácticos cercanos
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

      // 4. Disparo Automático de todas las Armas Desbloqueadas y EVOs
      const weapons = save.weapons;

      // Buscar enemigo más cercano para auto-apuntado
      let nearestEnemy: ActiveEnemy | null = null;
      let nearestDist = Infinity;
      for (const e of enemiesRef.current) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }

      // 4A. KUNAI / SHURIKEN FANTASMA (EVO)
      const kunaiLv = weapons.kunai || 0;
      if (kunaiLv > 0) {
        const isEvo = kunaiLv >= 6;
        const mastery = Math.max(0, kunaiLv - 6);
        const cd =
          (isEvo ? 0.16 : Math.max(0.24, 0.62 - (kunaiLv - 1) * 0.08)) * stats.cooldownMult;
        weaponTimersRef.current.kunai -= dt;
        if (weaponTimersRef.current.kunai <= 0 && nearestEnemy && nearestDist < 540) {
          weaponTimersRef.current.kunai = cd;
          const baseAngle = Math.atan2(nearestEnemy.y - p.y, nearestEnemy.x - p.x);
          p.facingAngle = baseAngle;
          const count = isEvo ? 2 + Math.min(3, Math.floor(mastery / 2)) : Math.min(3, 1 + Math.floor(kunaiLv / 2));
          const dmg =
            WEAPONS_CATALOG.kunai.baseDamage *
            stats.totalDamageMult *
            (1 + (kunaiLv - 1) * 0.32);

          for (let i = 0; i < count; i++) {
            const spread = (i - (count - 1) / 2) * 0.12;
            const ang = baseAngle + spread;
            const spd = isEvo ? 680 : 540;
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'kunai',
              x: p.x,
              y: p.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              radius: isEvo ? 11 : 8,
              damage: dmg,
              pierce: isEvo ? 3 + mastery : 1,
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

      // 4B. CAMPO DE FUERZA (El aura verde hexagonal de la captura) / CAMPO DE PRESIÓN (EVO)
      const forceLv = weapons.forcefield || 0;
      if (forceLv > 0) {
        const isEvo = forceLv >= 6;
        const auraRadius = (isEvo ? 128 : 68 + (forceLv - 1) * 11) * stats.areaMult;
        weaponTimersRef.current.forcefield -= dt;
        if (weaponTimersRef.current.forcefield <= 0) {
          weaponTimersRef.current.forcefield = 0.36 * stats.cooldownMult;
          const dmg =
            WEAPONS_CATALOG.forcefield.baseDamage *
            stats.totalDamageMult *
            (1 + (forceLv - 1) * 0.35);
          for (const e of enemiesRef.current) {
            const dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist <= auraRadius + e.radius) {
              damageEnemy(e, dmg, isEvo ? 14 : 5);
            }
          }
        }
      }

      // 4C. GUARDIÁN GIRATORIO / DEFENSOR ETERNO (EVO)
      const guardianLv = weapons.guardian || 0;
      if (guardianLv > 0) {
        const isEvo = guardianLv >= 6;
        const bladeCount = isEvo ? 6 : Math.min(5, 2 + Math.floor(guardianLv / 2));
        const orbitRadius = (isEvo ? 105 : 85) * stats.areaMult;
        guardianAngle += dt * (isEvo ? 5.2 : 3.6);
        weaponTimersRef.current.guardian -= dt;
        if (weaponTimersRef.current.guardian <= 0) {
          weaponTimersRef.current.guardian = 0.22;
          const dmg =
            WEAPONS_CATALOG.guardian.baseDamage *
            stats.totalDamageMult *
            (1 + (guardianLv - 1) * 0.3);

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

      // 4D. EMISOR DE RAYOS / CELDA DE SUPERCARGA (EVO)
      const lightningLv = weapons.lightning || 0;
      if (lightningLv > 0 && enemiesRef.current.length > 0) {
        const isEvo = lightningLv >= 6;
        weaponTimersRef.current.lightning -= dt;
        if (weaponTimersRef.current.lightning <= 0) {
          weaponTimersRef.current.lightning = (isEvo ? 0.85 : 1.35) * stats.cooldownMult;
          const strikes = isEvo ? 4 : Math.min(3, 1 + Math.floor(lightningLv / 2));
          const dmg =
            WEAPONS_CATALOG.lightning.baseDamage *
            stats.totalDamageMult *
            (1 + (lightningLv - 1) * 0.38);
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
      }

      // 4E. LADRILLO PESADO / PESA DE 1 TONELADA (EVO)
      const brickLv = weapons.brick || 0;
      if (brickLv > 0) {
        const isEvo = brickLv >= 6;
        weaponTimersRef.current.brick -= dt;
        if (weaponTimersRef.current.brick <= 0) {
          weaponTimersRef.current.brick = (isEvo ? 1.15 : 1.45) * stats.cooldownMult;
          const dmg =
            WEAPONS_CATALOG.brick.baseDamage *
            stats.totalDamageMult *
            (1 + (brickLv - 1) * 0.36);

          if (isEvo) {
            for (let i = 0; i < 8; i++) {
              const ang = (i * Math.PI * 2) / 8;
              projectilesRef.current.push({
                id: nextEntityIdRef.current++,
                weaponId: 'brick',
                x: p.x,
                y: p.y,
                vx: Math.cos(ang) * 340,
                vy: Math.sin(ang) * 340,
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
            const count = Math.min(3, 1 + Math.floor(brickLv / 2));
            for (let i = 0; i < count; i++) {
              projectilesRef.current.push({
                id: nextEntityIdRef.current++,
                weaponId: 'brick',
                x: p.x + (i - (count - 1) / 2) * 26,
                y: p.y,
                vx: (i - (count - 1) / 2) * 55,
                vy: -360,
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
      }

      // 4F. CÓCTEL MOLOTOV / BARRIL DE COMBUSTIBLE AZUL (EVO)
      const molotovLv = weapons.molotov || 0;
      if (molotovLv > 0) {
        const isEvo = molotovLv >= 6;
        weaponTimersRef.current.molotov -= dt;
        if (weaponTimersRef.current.molotov <= 0) {
          weaponTimersRef.current.molotov = (isEvo ? 1.45 : 1.85) * stats.cooldownMult;
          const count = isEvo ? 5 : Math.min(4, 2 + Math.floor(molotovLv / 2));
          const dmg =
            WEAPONS_CATALOG.molotov.baseDamage *
            stats.totalDamageMult *
            (1 + (molotovLv - 1) * 0.34);

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
      }

      // 4G. DRON DESTRUCTOR A+B / DESTRUCTOR DIVINO (EVO)
      const droneLv = weapons.drone || 0;
      if (droneLv > 0) {
        const isEvo = droneLv >= 6;
        droneAngle += dt * 2.5;
        weaponTimersRef.current.drone -= dt;
        if (weaponTimersRef.current.drone <= 0 && enemiesRef.current.length > 0) {
          weaponTimersRef.current.drone = (isEvo ? 0.32 : 0.65) * stats.cooldownMult;
          const shots = isEvo ? 3 : 2;
          const dmg =
            WEAPONS_CATALOG.drone.baseDamage *
            stats.totalDamageMult *
            (1 + (droneLv - 1) * 0.32);

          for (let i = 0; i < shots; i++) {
            const target =
              enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
            if (!target) continue;
            const dx = p.x + Math.cos(droneAngle + i * Math.PI) * 38;
            const dy = p.y - 26 + Math.sin(droneAngle + i * Math.PI) * 20;
            const ang = Math.atan2(target.y - dy, target.x - dx);
            projectilesRef.current.push({
              id: nextEntityIdRef.current++,
              weaponId: 'drone',
              x: dx,
              y: dy,
              vx: Math.cos(ang) * 520,
              vy: Math.sin(ang) * 520,
              radius: isEvo ? 10 : 7,
              damage: dmg,
              pierce: isEvo ? 2 : 1,
              life: 1.1,
              maxLife: 1.1,
              color: isEvo ? '#ec4899' : '#c084fc',
              isEvo,
              rotation: ang,
              spinSpeed: 0,
              hitEnemyIds: new Set(),
            });
          }
        }
      }

      // 4H. KATANA CORTAVIENTO / ESPADA DEMONÍACA (EVO)
      const katanaLv = weapons.katana || 0;
      if (katanaLv > 0) {
        const isEvo = katanaLv >= 6;
        weaponTimersRef.current.katana -= dt;
        if (weaponTimersRef.current.katana <= 0) {
          weaponTimersRef.current.katana = (isEvo ? 0.65 : 0.95) * stats.cooldownMult;
          const dmg =
            WEAPONS_CATALOG.katana.baseDamage *
            stats.totalDamageMult *
            (1 + (katanaLv - 1) * 0.36);
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
      }

      // 5. Actualizar Proyectiles y Colisiones
      for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const proj = projectilesRef.current[i];
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        if (proj.weaponId === 'brick' && !proj.isEvo) {
          proj.vy += 680 * dt; // Gravedad de parábola para el ladrillo clásico
        }
        proj.rotation += proj.spinSpeed * dt;
        proj.life -= dt;

        if (proj.life <= 0) {
          projectilesRef.current.splice(i, 1);
          continue;
        }

        for (const e of enemiesRef.current) {
          if (proj.hitEnemyIds.has(e.id)) continue;
          if (Math.hypot(e.x - proj.x, e.y - proj.y) <= e.radius + proj.radius) {
            proj.hitEnemyIds.add(e.id);
            damageEnemy(e, proj.damage, proj.weaponId === 'katana' ? 18 : 7);
            proj.pierce -= 1;
            if (proj.pierce <= 0) {
              projectilesRef.current.splice(i, 1);
              break;
            }
          }
        }
      }

      // 6. Actualizar Charcos de Fuego (Molotov) y Rayos
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

      // 7. Actualizar Enemigos, Muertes, Botín y Jefe Activo
      let xpGainedThisFrame = 0;
      let goldGainedThisFrame = 0;
      let killsThisFrame = 0;
      let bossesDefeatedThisFrame = 0;
      let currentActiveBoss: { name: string; hp: number; maxHp: number } | null = null;

      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const e = enemiesRef.current[i];
        if (e.hitFlash > 0) e.hitFlash -= dt;

        // Comprobar si murió
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
                value: Math.round(65 * world.goldMultiplier),
                magnetized: true,
                bobPhase: c,
              });
            }
          } else if (e.isElite) {
            // Los élites sueltan Cofre Arcoíris o Monedas grandes
            if (Math.random() < 0.55) {
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
              value: Math.round(48 * world.xpMultiplier),
              magnetized: false,
              bobPhase: 0,
            });
          } else {
            // Drop normal: Gema de XP verde/azul + probabilidad de moneda/imán/carne/bomba
            const roll = Math.random();
            if (roll < 0.012) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'magnet',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            } else if (roll < 0.024) {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: 'meat',
                x: e.x,
                y: e.y,
                value: 1,
                magnetized: false,
                bobPhase: 0,
              });
            } else if (roll < 0.032) {
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
                value: Math.max(1, Math.round(6 * world.goldMultiplier)),
                magnetized: false,
                bobPhase: 0,
              });
            } else {
              dropsRef.current.push({
                id: nextEntityIdRef.current++,
                type: roll < 0.38 ? 'xp_blue' : 'xp_green',
                x: e.x,
                y: e.y,
                value: Math.round((roll < 0.38 ? 28 : 14) * world.xpMultiplier),
                magnetized: false,
                bobPhase: Math.random() * 6,
              });
            }
          }

          enemiesRef.current.splice(i, 1);
          continue;
        }

        // Despawn si queda lejísimos (excepto Jefes)
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

        // Mover hacia el jugador
        if (dist > 1) {
          e.x += (dx / dist) * e.speed * dt;
          e.y += (dy / dist) * e.speed * dt;
          e.facingLeft = dx < 0;
          e.walkCycle += dt * 9;
        }

        // Colisión cuerpo a cuerpo con el héroe
        if (dist < e.radius + 16 && p.invulnTimer <= 0) {
          p.hp -= e.damage;
          p.invulnTimer = 0.32;
          if (p.hp <= 0) {
            // En modo persistente no pierdes tu progreso: revives con escudo de emergencia
            p.hp = p.maxHp;
            p.invulnTimer = 2.0;
            soundEngine.playBombExplosion();
            for (const nearE of enemiesRef.current) {
              if (!nearE.isBoss && Math.hypot(nearE.x - p.x, nearE.y - p.y) < 260) {
                nearE.hp = 0;
              }
            }
          }
        }
      }

      // Separación suave entre zombis para que formen hordas orgánicas
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

      // 8. Recolección de Gemas, Monedas, Imanes, Carne, Bombas y Cofres Arcoíris
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

      // 9. Actualizar Popups de Daño y Fantasmas de muerte
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
    };

    // Función de renderizado estilo Survivor.io (idéntica a la captura)
    const renderScene = (viewW: number, viewH: number, nowMs: number) => {
      const p = playerRef.current;
      const world = worldRef.current;
      const save = saveRef.current;
      const stats = getPlayerStats();

      const camX = p.x - viewW / 2;
      const camY = p.y - viewH / 2;

      // 1. Fondo del Mundo (Asfalto de autopista con flechas blancas, líneas de carril y vallas laterales con cruces abiertos)
      ctx.fillStyle = world.bgPrimary;
      ctx.fillRect(0, 0, viewW, viewH);

      ctx.save();
      ctx.translate(-camX, -camY);

      // Dibujar cuadrícula vial infinita estilo Survivor.io
      const tileSize = 260;
      const startTileX = Math.floor(camX / tileSize) - 1;
      const endTileX = Math.ceil((camX + viewW) / tileSize) + 1;
      const startTileY = Math.floor(camY / tileSize) - 1;
      const endTileY = Math.ceil((camY + viewH) / tileSize) + 1;

      // Líneas centrales dobles verticales del puente principal (x = 0) y avenidas cada 700px
      const roadCentersX = [-700, 0, 700];
      for (const rcx of roadCentersX) {
        if (rcx + 240 < camX || rcx - 240 > camX + viewW) continue;

        // Sombra suave de los bordes del tramo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        ctx.fillRect(rcx - 205, camY - 100, 14, viewH + 200);
        ctx.fillRect(rcx + 191, camY - 100, 14, viewH + 200);

        // Doble línea central continua (exacta a la captura)
        ctx.fillStyle = world.laneLineColor;
        ctx.fillRect(rcx - 9, camY - 100, 6, viewH + 200);
        ctx.fillRect(rcx + 3, camY - 100, 6, viewH + 200);
      }

      // Dibujar marcas de carriles discontinuas y flechas ↓ ↑ como en la captura
      for (let ty = startTileY; ty <= endTileY; ty++) {
        const yPos = ty * tileSize;

        for (const rcx of roadCentersX) {
          if (rcx + 240 < camX || rcx - 240 > camX + viewW) continue;

          // Líneas blancas discontinuas a izquierda y derecha
          ctx.fillStyle = world.laneLineColor;
          ctx.fillRect(rcx - 108, yPos + 20, 7, 92);
          ctx.fillRect(rcx + 101, yPos + 20, 7, 92);

          // Flechas pintadas en el asfalto (↓ en carriles izquierdos, ↑ en carriles derechos, igual que la captura)
          const drawRoadArrow = (ax: number, ay: number, pointDown: boolean) => {
            ctx.save();
            ctx.translate(ax, ay);
            if (!pointDown) ctx.scale(1, -1);
            ctx.fillStyle = 'rgba(203, 213, 225, 0.38)';
            // Tallo de la flecha
            ctx.fillRect(-6, -24, 12, 26);
            // Punta triangular
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

          // Vallas de madera laterales estilo puente de la captura (dejando pasos abiertos cada 3 bloques para el mundo 360°)
          if (Math.abs(ty % 3) !== 1) {
            const drawWoodenRailSegment = (rx: number, ry: number, isLeft: boolean) => {
              ctx.save();
              const railW = 18;
              const bx = isLeft ? rx - railW : rx;
              // Fondo madera oscura
              ctx.fillStyle =
                world.borderFenceStyle === 'wood_highway'
                  ? '#9a5b25'
                  : world.borderFenceStyle === 'steel_military'
                  ? '#475569'
                  : world.borderFenceStyle === 'cyber_grid'
                  ? '#4f46e5'
                  : '#b45309';
              ctx.strokeStyle = '#0f172a';
              ctx.lineWidth = 3;
              ctx.fillRect(bx, ry + 8, railW, tileSize - 16);
              ctx.strokeRect(bx, ry + 8, railW, tileSize - 16);

              // Postes transversales cada 42px (igual al borde de la foto)
              for (let py = ry + 18; py < ry + tileSize - 20; py += 42) {
                ctx.fillStyle =
                  world.borderFenceStyle === 'wood_highway' ? '#c87d32' : '#94a3b8';
                ctx.fillRect(bx - 3, py, railW + 6, 14);
                ctx.strokeRect(bx - 3, py, railW + 6, 14);
              }
              ctx.restore();
            };

            drawWoodenRailSegment(rcx - 196, yPos, true);
            drawWoodenRailSegment(rcx + 196, yPos, false);
          }
        }

        // Suelo sutil en las plazas abiertas entre autopistas
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const xPos = tx * tileSize;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 2;
          ctx.strokeRect(xPos, yPos, tileSize, tileSize);
        }
      }

      // 2. Dibujar Portales / Teletransportadores Físicos del Mundo
      for (const tp of world.teleporters) {
        const pulse = Math.sin(nowMs * 0.005) * 6;
        ctx.save();
        ctx.translate(tp.x, tp.y);

        // Resplandor exterior
        const grad = ctx.createRadialGradient(0, 0, 12, 0, 0, 68 + pulse);
        grad.addColorStop(0, tp.color);
        grad.addColorStop(0.55, `${tp.color}66`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 68 + pulse, 0, Math.PI * 2);
        ctx.fill();

        // Anillo tecnológico con borde negro cartoon
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, 0, 44, 0, Math.PI * 2);
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = tp.color;
        ctx.beginPath();
        ctx.arc(0, 0, 40, nowMs * 0.003, nowMs * 0.003 + Math.PI * 1.4);
        ctx.stroke();

        // Etiqueta flotante del Portal
        ctx.font = '900 12px "Fredoka", "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#000000';
        ctx.strokeText(tp.badge, 0, -54);
        ctx.fillStyle = '#fde047';
        ctx.fillText(tp.badge, 0, -54);

        ctx.font = '700 11px "Inter", sans-serif';
        ctx.strokeText(tp.label, 0, 62);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(tp.label, 0, 62);

        // Si el jugador está cargando el teletransportador, dibujar anillo de progreso
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

      // 3. Dibujar Charcos de Fuego (Molotov)
      for (const h of hazardsRef.current) {
        ctx.save();
        ctx.globalAlpha = Math.min(0.75, h.life / 0.6);
        const grad = ctx.createRadialGradient(h.x, h.y, 6, h.x, h.y, h.radius);
        grad.addColorStop(0, h.isEvo ? '#ecfeff' : '#fef08a');
        grad.addColorStop(0.5, h.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 4. Dibujar el Aura Verde Hexagonal del Campo de Fuerza (Exacta a la captura)
      const forceLv = save.weapons.forcefield || 0;
      if (forceLv > 0) {
        const isEvo = forceLv >= 6;
        const auraRadius = (isEvo ? 128 : 68 + (forceLv - 1) * 11) * stats.areaMult;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(nowMs * 0.0008);

        const drawPolygonRing = (r: number, sides: number, strokeCol: string, fillCol: string, lineW: number) => {
          ctx.beginPath();
          for (let s = 0; s < sides; s++) {
            const ang = (s * Math.PI * 2) / sides;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (s === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = fillCol;
          ctx.fill();
          ctx.lineWidth = lineW;
          ctx.strokeStyle = strokeCol;
          ctx.stroke();
        };

        // Anillo exterior e interior verdes translúcidos como en la captura
        drawPolygonRing(
          auraRadius,
          8,
          isEvo ? '#10b981' : '#22c55e',
          isEvo ? 'rgba(16, 185, 129, 0.16)' : 'rgba(34, 197, 94, 0.16)',
          3.5
        );
        drawPolygonRing(
          auraRadius * 0.72,
          8,
          isEvo ? 'rgba(52, 211, 153, 0.85)' : 'rgba(74, 222, 128, 0.85)',
          'rgba(34, 197, 94, 0.08)',
          2.5
        );
        ctx.restore();
      }

      // 5. Dibujar Gemas de XP, Monedas, Imanes y el COFRE CON ESTELA ARCOÍRIS (Idéntico a la captura)
      for (const item of dropsRef.current) {
        if (item.type === 'chest_rainbow') {
          ctx.save();
          ctx.translate(item.x, item.y);

          // 5A. Estela vertical de arcoíris que sube hacia el cielo (como en la foto)
          const beamHeight = 750;
          const beamWidth = 42;
          const rainbowColors = [
            'rgba(239, 68, 68, 0.55)',
            'rgba(249, 115, 22, 0.55)',
            'rgba(250, 204, 21, 0.58)',
            'rgba(34, 197, 94, 0.55)',
            'rgba(56, 189, 248, 0.55)',
            'rgba(168, 85, 247, 0.55)',
          ];
          const stripeW = beamWidth / rainbowColors.length;
          for (let c = 0; c < rainbowColors.length; c++) {
            const sx = -beamWidth / 2 + c * stripeW;
            const vGrad = ctx.createLinearGradient(0, 0, 0, -beamHeight);
            vGrad.addColorStop(0, rainbowColors[c]);
            vGrad.addColorStop(0.85, rainbowColors[c]);
            vGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = vGrad;
            ctx.fillRect(sx, -beamHeight, stripeW + 0.5, beamHeight);
          }

          // 5B. Arcoíris semicircular sobre el cofre (exacto a la foto)
          const arcRadii = [58, 53, 48, 43, 38, 33];
          for (let c = 0; c < arcRadii.length; c++) {
            ctx.beginPath();
            ctx.arc(0, 6, arcRadii[c], Math.PI * 1.08, Math.PI * 1.92);
            ctx.strokeStyle = rainbowColors[c];
            ctx.lineWidth = 5;
            ctx.stroke();
          }

          // 5C. Cofre Rojo y Dorado con borde negro grueso
          const bobY = Math.sin(item.bobPhase) * 2.5;
          ctx.translate(0, bobY);
          ctx.fillStyle = '#dc2626';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(-20, -16, 40, 32, 5);
          ctx.fill();
          ctx.stroke();

          // Bordes dorados del cofre
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-20, -4, 40, 7);
          ctx.strokeRect(-20, -4, 40, 7);
          ctx.fillRect(-18, -15, 6, 30);
          ctx.fillRect(12, -15, 6, 30);

          // Cerradura central roja/dorada
          ctx.beginPath();
          ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fde047';
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();

          ctx.restore();
        } else if (
          item.type === 'xp_green' ||
          item.type === 'xp_blue' ||
          item.type === 'xp_gold'
        ) {
          // Gemas de experiencia en forma de rombo brillante con destello blanco (exactas a la foto)
          ctx.save();
          ctx.translate(item.x, item.y);
          const r = item.type === 'xp_gold' ? 8.5 : item.type === 'xp_blue' ? 7.5 : 6.5;
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fillStyle =
            item.type === 'xp_gold'
              ? '#facc15'
              : item.type === 'xp_blue'
              ? '#38bdf8'
              : '#4ade80';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#14532d';
          ctx.stroke();

          // Brillo interior blanco
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-1.5, -1.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (item.type === 'coin') {
          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
          ctx.fillStyle = '#ca8a04';
          ctx.fillRect(-2, -4, 4, 8);
          ctx.restore();
        } else {
          // Imán, Carne o Bomba
          ctx.save();
          ctx.translate(item.x, item.y + Math.sin(item.bobPhase) * 3);
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fillStyle =
            item.type === 'magnet'
              ? '#2563eb'
              : item.type === 'meat'
              ? '#16a34a'
              : '#dc2626';
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#000000';
          ctx.stroke();
          ctx.font = '14px sans-serif';
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

      // 6. Dibujar Fantasmas de disolución de enemigos eliminados (como el de "1310" en la foto)
      for (const g of ghostsRef.current) {
        ctx.save();
        ctx.globalAlpha = g.life / g.maxLife;
        ctx.translate(g.x, g.y - (1 - g.life / g.maxLife) * 18);
        ctx.fillStyle = '#d9f99d';
        ctx.beginPath();
        ctx.ellipse(0, 0, g.radius * 0.7, g.radius * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 7. Dibujar Soldados Zombi, Élites y Jefes (Con casco verde militar, ojos y rifle como en la foto)
      for (const e of enemiesRef.current) {
        ctx.save();
        const bob = Math.sin(e.walkCycle) * 2;
        ctx.translate(e.x, e.y + bob);

        // Sombra en el suelo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(0, e.radius + 2, e.radius * 0.85, e.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        if (e.isElite || e.isBoss) {
          ctx.beginPath();
          ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
          ctx.strokeStyle = e.isBoss ? '#ef4444' : '#facc15';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        const scale = e.radius / 17;
        ctx.scale(e.facingLeft ? -scale : scale, scale);

        // Cuerpo militar verde oliva
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.bodyColor;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.roundRect(-10, -2, 20, 16, 4);
        ctx.fill();
        ctx.stroke();

        // Cabeza zombi cuadrada redondeada
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#86efac';
        ctx.beginPath();
        ctx.roundRect(-12, -16, 24, 16, 5);
        ctx.fill();
        ctx.stroke();

        // Ojos blancos redondos de zombi (como en la foto)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(2, -9, 3.2, 0, Math.PI * 2);
        ctx.arc(8, -9, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(2.6, -9, 1.2, 0, Math.PI * 2);
        ctx.arc(8.6, -9, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Casco militar abombado con cinta marrón (idéntico a los soldados de la foto)
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.helmetColor;
        ctx.beginPath();
        ctx.arc(0, -14, 13.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cinta marrón del casco
        ctx.fillStyle = '#92400e';
        ctx.fillRect(-13, -16, 26, 3.5);
        ctx.strokeRect(-13, -16, 26, 3.5);

        // Rifle / Metralleta gris en las manos
        ctx.fillStyle = e.gunColor;
        ctx.fillRect(-2, 3, 18, 5);
        ctx.strokeRect(-2, 3, 18, 5);
        ctx.fillRect(6, 7, 4, 5);
        ctx.strokeRect(6, 7, 4, 5);

        ctx.restore();

        // Barra de vida para Élites y Jefes
        if ((e.isElite || e.isBoss) && e.hp < e.maxHp) {
          const bw = e.radius * 2.2;
          ctx.fillStyle = '#000000';
          ctx.fillRect(e.x - bw / 2 - 1, e.y - e.radius - 14, bw + 2, 7);
          ctx.fillStyle = e.isBoss ? '#ef4444' : '#f59e0b';
          ctx.fillRect(
            e.x - bw / 2,
            e.y - e.radius - 13,
            bw * Math.max(0, e.hp / e.maxHp),
            5
          );
        }
      }

      // 8. Dibujar Discos del Guardián Giratorio alrededor del Héroe
      const guardianLv = save.weapons.guardian || 0;
      if (guardianLv > 0) {
        const isEvo = guardianLv >= 6;
        const bladeCount = isEvo ? 6 : Math.min(5, 2 + Math.floor(guardianLv / 2));
        const orbitRadius = (isEvo ? 105 : 85) * stats.areaMult;
        for (let i = 0; i < bladeCount; i++) {
          const ang = guardianAngle + (i * Math.PI * 2) / bladeCount;
          const bx = p.x + Math.cos(ang) * orbitRadius;
          const by = p.y + Math.sin(ang) * orbitRadius;
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(nowMs * 0.015);
          ctx.fillStyle = isEvo ? '#ef4444' : '#f59e0b';
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, isEvo ? 16 : 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 9. Dibujar al Héroe Principal en el centro (Exacto al de la foto: visor celeste, bufanda roja, kunai en mano y barra de vida verde debajo)
      ctx.save();
      ctx.translate(p.x, p.y);

      // Flecha blanca/verde de dirección encima de la cabeza (exacta a la captura)
      ctx.save();
      ctx.translate(0, -30);
      ctx.fillStyle = '#dcfce7';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, 4);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Sombra del héroe
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(0, 17, 15, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      const heroBob = Math.sin(p.walkCycle) * 1.8;
      ctx.save();
      ctx.translate(0, heroBob);
      if (p.facingLeft) ctx.scale(-1, 1);

      // Capa / Bufanda roja ondeando
      ctx.fillStyle = stats.hero.scarfColor;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.roundRect(-14, -4, 24, 17, 4);
      ctx.fill();
      ctx.stroke();

      // Cabeza / Casco con visor celeste (idéntico al héroe de la foto)
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.roundRect(-11, -18, 22, 16, 5);
      ctx.fill();
      ctx.stroke();

      // Visor celeste brillante arriba
      ctx.fillStyle = stats.hero.visorColor;
      ctx.beginPath();
      ctx.roundRect(-10, -17, 20, 8, 3);
      ctx.fill();
      ctx.stroke();

      // Bufanda roja cubriendo la parte baja de la cara
      ctx.fillStyle = stats.hero.scarfColor;
      ctx.fillRect(-11, -6, 22, 6);
      ctx.strokeRect(-11, -6, 22, 6);

      // Kunai en la mano derecha apuntando (como en la foto)
      ctx.save();
      ctx.translate(13, 2);
      ctx.rotate(-0.35);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-2, -5);
      ctx.lineTo(1, 0);
      ctx.lineTo(-2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.restore();

      // Dron flotante si está desbloqueado
      if ((save.weapons.drone || 0) > 0) {
        const isEvo = (save.weapons.drone || 0) >= 6;
        const dx = Math.cos(droneAngle) * 34;
        const dy = -26 + Math.sin(droneAngle) * 14;
        ctx.fillStyle = isEvo ? '#ec4899' : '#38bdf8';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(dx, dy, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Barra de vida verde justo debajo de los pies del héroe (idéntica a la captura)
      const hpBarW = 46;
      const hpBarH = 7;
      ctx.fillStyle = '#000000';
      ctx.fillRect(-hpBarW / 2 - 2, 22, hpBarW + 4, hpBarH + 4);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(-hpBarW / 2, 24, hpBarW, hpBarH);
      const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp));
      ctx.fillStyle = hpPct > 0.35 ? '#84cc16' : '#ef4444';
      ctx.fillRect(-hpBarW / 2, 24, hpBarW * hpPct, hpBarH);

      ctx.restore();

      // 10. Dibujar Proyectiles (Kunais, Shurikens EVO, Ladrillos, Ondas de Katana)
      for (const proj of projectilesRef.current) {
        ctx.save();
        ctx.translate(proj.x, proj.y);
        ctx.rotate(proj.rotation);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.2;

        if (proj.weaponId === 'kunai') {
          if (proj.isEvo) {
            // Shuriken de 4 puntas carmesí
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            for (let s = 0; s < 4; s++) {
              const a = (s * Math.PI) / 2;
              ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
              ctx.lineTo(Math.cos(a + 0.4) * 5, Math.sin(a + 0.4) * 5);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else {
            // Kunai ninja clásico (idéntico al que impacta "1310" en la foto)
            ctx.fillStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(12, 0);
            ctx.lineTo(-4, -5);
            ctx.lineTo(-1, 0);
            ctx.lineTo(-4, 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Anillo en la empuñadura del kunai
            ctx.beginPath();
            ctx.arc(-7, 0, 2.5, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (proj.weaponId === 'katana') {
          // Onda de corte en medialuna
          ctx.strokeStyle = proj.color;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius, -0.85, 0.85);
          ctx.stroke();
        } else {
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.arc(0, 0, proj.radius * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }

      // 11. Dibujar Relámpagos del Cielo
      for (const bolt of lightningsRef.current) {
        ctx.save();
        ctx.globalAlpha = bolt.life / bolt.maxLife;
        ctx.strokeStyle = bolt.color;
        ctx.lineWidth = bolt.isEvo ? 6 : 4;
        ctx.beginPath();
        ctx.moveTo(bolt.x - 12, bolt.y - 320);
        ctx.lineTo(bolt.x + 10, bolt.y - 180);
        ctx.lineTo(bolt.x - 8, bolt.y - 90);
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(bolt.x, bolt.y, bolt.radius * 0.65, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // 12. Dibujar Números de Daño Flotantes ("1310" amarillos/blancos con borde negro grueso igual a la foto)
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

      // 13. Indicadores de borde de pantalla hacia Cofres Arcoíris y Portales cercanos
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
        if (dist < Math.min(viewW, viewH) * 0.42) return; // Ya está visible en pantalla

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

      // Mostrar indicador al Cofre Arcoíris más cercano y al Portal más cercano
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

      // 14. Dibujar el Joystick Circular Semitransparente en la parte inferior (IDÉNTICO A LA CAPTURA)
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
      // Círculo exterior blanco semitransparente
      ctx.beginPath();
      ctx.arc(jx, jy, outerRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.65)';
      ctx.stroke();

      // Círculo interior oscuro con borde blanco (igual a la foto)
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
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (!isPausedRef.current) {
        updateSimulation(dt, rect.width, rect.height);
      }
      renderScene(rect.width, rect.height, now);

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

  // Manejadores de Pointer Events para el Joystick Táctil en Móvil
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
