import { PassiveId, WeaponId } from '../data/gameCatalog';

export interface PersistentSaveData {
  version: number;
  heroName: string;
  selectedHeroId: string;
  unlockedHeroes: string[];
  currentWorldId: string;
  unlockedWorlds: string[];
  playerX: number;
  playerY: number;
  level: number;
  xp: number;
  gold: number;
  totalKills: number;
  bossesDefeated: number;
  playTimeSeconds: number;
  weapons: Partial<Record<WeaponId, number>>; // 1..5 = Estrellas Amarillas, 6 = EVO Estrella Roja, 7+ = EVO Maestro (+1, +2...)
  passives: Partial<Record<PassiveId, number>>; // 1..5+ = Niveles de suministro pasivo
  permanentUpgrades: {
    atk: number;
    hp: number;
    speed: number;
    magnet: number;
    crit: number;
    greed: number;
  };
  lastSavedAt: number;
}

const SAVE_STORAGE_KEY = 'survivor_io_openworld_save_v1';

export function getDefaultSaveData(): PersistentSaveData {
  return {
    version: 1,
    heroName: 'Comandante Koga',
    selectedHeroId: 'survivor_alpha',
    unlockedHeroes: ['survivor_alpha'],
    currentWorldId: 'world_highway',
    unlockedWorlds: [
      'world_highway',
      'world_military',
      'world_canyon',
      'world_cyber',
      'world_abyss',
      'world_astral',
    ],
    playerX: 0,
    playerY: 0,
    level: 1,
    xp: 0,
    gold: 150,
    totalKills: 5,
    bossesDefeated: 0,
    playTimeSeconds: 4,
    weapons: {
      kunai: 1,
      forcefield: 1,
    },
    passives: {
      scroll: 1,
    },
    permanentUpgrades: {
      atk: 1,
      hp: 1,
      speed: 1,
      magnet: 1,
      crit: 1,
      greed: 1,
    },
    lastSavedAt: Date.now(),
  };
}

export function loadSaveData(): PersistentSaveData {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return getDefaultSaveData();
    const parsed = JSON.parse(raw) as Partial<PersistentSaveData>;
    const def = getDefaultSaveData();
    return {
      ...def,
      ...parsed,
      weapons: {
        ...def.weapons,
        ...(parsed.weapons || {}),
      },
      passives: {
        ...def.passives,
        ...(parsed.passives || {}),
      },
      permanentUpgrades: {
        ...def.permanentUpgrades,
        ...(parsed.permanentUpgrades || {}),
      },
      unlockedWorlds: Array.from(
        new Set([...def.unlockedWorlds, ...(parsed.unlockedWorlds || [])])
      ),
      unlockedHeroes: Array.from(
        new Set([...def.unlockedHeroes, ...(parsed.unlockedHeroes || [])])
      ),
    };
  } catch {
    return getDefaultSaveData();
  }
}

export function saveGameData(data: PersistentSaveData): void {
  try {
    const payload: PersistentSaveData = {
      ...data,
      lastSavedAt: Date.now(),
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function getXpRequiredForLevel(level: number): number {
  return Math.floor(45 + Math.pow(level, 1.45) * 28);
}

export function formatWeaponTierLabel(level: number): {
  stars: number;
  isEvo: boolean;
  masteryPlus: number;
  badgeText: string;
} {
  if (level <= 0) {
    return { stars: 0, isEvo: false, masteryPlus: 0, badgeText: 'NUEVO' };
  }
  if (level <= 5) {
    return { stars: level, isEvo: false, masteryPlus: 0, badgeText: `NV.${level}` };
  }
  const mastery = level - 6;
  return {
    stars: 6,
    isEvo: true,
    masteryPlus: mastery,
    badgeText: mastery > 0 ? `EVO +${mastery}` : 'EVO ★',
  };
}
