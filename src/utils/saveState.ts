import {
  EquipSlotKey,
  MAX_ITEM_LEVEL,
  PassiveId,
  WEAPONS_CATALOG,
  WeaponId,
} from '../data/gameCatalog';

export type EquippedLoadout = Record<EquipSlotKey, WeaponId | null>;

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
  weapons: Partial<Record<WeaponId, number>>; // 1..9 = Niveles, 10 = NV.10 ★ EVO MÁX
  equippedSlots: EquippedLoadout;
  passives: Partial<Record<PassiveId, number>>; // 1..10 = Niveles de suministro pasivo
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

export function getDefaultEquippedLoadout(): EquippedLoadout {
  return {
    rightHand: 'kunai',
    leftHand: null,
    leftShoulder: null,
    rightShoulder: null,
    helmet: 'helmet_visor',
    body: 'forcefield',
    companion1: 'drone',
    companion2: null,
  };
}

export function equipItemIntoLoadout(
  loadout: EquippedLoadout,
  itemId: WeaponId,
  preferredSlot?: EquipSlotKey
): EquippedLoadout {
  const def = WEAPONS_CATALOG[itemId];
  if (!def) return loadout;
  const next = { ...loadout };

  // Si ya está equipado en alguna ranura y no se pidió cambiar de ranura específica, mantenerlo
  const existingEntry = (Object.keys(next) as EquipSlotKey[]).find((k) => next[k] === itemId);
  if (existingEntry && !preferredSlot) {
    return next;
  }

  // Si se indicó ranura preferida, limpiar si estaba en la otra ranura gemela y colocarlo
  if (preferredSlot) {
    if (existingEntry) next[existingEntry] = null;
    next[preferredSlot] = itemId;
    return next;
  }

  // Auto-equipar si hay ranura libre de su categoría; si no hay libre, equipar en la primera de su categoría
  if (def.category === 'hand') {
    if (!next.rightHand) next.rightHand = itemId;
    else if (!next.leftHand) next.leftHand = itemId;
  } else if (def.category === 'shoulder') {
    if (!next.leftShoulder) next.leftShoulder = itemId;
    else if (!next.rightShoulder) next.rightShoulder = itemId;
  } else if (def.category === 'helmet') {
    if (!next.helmet) next.helmet = itemId;
  } else if (def.category === 'body') {
    if (!next.body) next.body = itemId;
  } else if (def.category === 'companion') {
    if (!next.companion1) next.companion1 = itemId;
    else if (!next.companion2) next.companion2 = itemId;
  }

  return next;
}

export function isItemEquipped(loadout: EquippedLoadout, itemId: WeaponId): EquipSlotKey | null {
  for (const key of Object.keys(loadout) as EquipSlotKey[]) {
    if (loadout[key] === itemId) return key;
  }
  return null;
}

export function getActiveEquippedLevels(
  data: PersistentSaveData
): Partial<Record<WeaponId, number>> {
  const active: Partial<Record<WeaponId, number>> = {};
  (Object.keys(data.equippedSlots) as EquipSlotKey[]).forEach((slotKey) => {
    const wId = data.equippedSlots[slotKey];
    if (wId) {
      const lv = Math.min(MAX_ITEM_LEVEL, Math.max(1, data.weapons[wId] || 1));
      active[wId] = lv;
    }
  });
  return active;
}

export function getDefaultSaveData(): PersistentSaveData {
  return {
    version: 3,
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
    gold: 350,
    totalKills: 5,
    bossesDefeated: 0,
    playTimeSeconds: 4,
    weapons: {
      kunai: 1,
      helmet_visor: 1,
      forcefield: 1,
      drone: 1,
    },
    equippedSlots: getDefaultEquippedLoadout(),
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

    const rawWeapons: Partial<Record<WeaponId, number>> = {
      ...def.weapons,
      ...(parsed.weapons || {}),
    };
    // Limitar todas las armas desbloqueadas al tope Nivel 10
    const clampedWeapons: Partial<Record<WeaponId, number>> = {};
    (Object.keys(rawWeapons) as WeaponId[]).forEach((k) => {
      if (WEAPONS_CATALOG[k] && (rawWeapons[k] || 0) > 0) {
        clampedWeapons[k] = Math.min(MAX_ITEM_LEVEL, rawWeapons[k] || 1);
      }
    });

    let loadout: EquippedLoadout = {
      ...def.equippedSlots,
      ...(parsed.equippedSlots || {}),
    };

    // Asegurar que los ítems desbloqueados llenen las ranuras vacías válidas
    (Object.keys(clampedWeapons) as WeaponId[]).forEach((wId) => {
      if ((clampedWeapons[wId] || 0) > 0) {
        loadout = equipItemIntoLoadout(loadout, wId);
      }
    });

    return {
      ...def,
      ...parsed,
      version: 3,
      weapons: clampedWeapons,
      equippedSlots: loadout,
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
  return Math.floor(180 + (level - 1) * 95 + Math.pow(level, 1.85) * 65);
}

export function formatWeaponTierLabel(level: number): {
  stars: number;
  isEvo: boolean;
  isMax: boolean;
  badgeText: string;
} {
  if (level <= 0) {
    return { stars: 0, isEvo: false, isMax: false, badgeText: 'NUEVO' };
  }
  const clamped = Math.min(MAX_ITEM_LEVEL, level);
  if (clamped < MAX_ITEM_LEVEL) {
    return {
      stars: clamped,
      isEvo: false,
      isMax: false,
      badgeText: `NV.${clamped}/10`,
    };
  }
  return {
    stars: 10,
    isEvo: true,
    isMax: true,
    badgeText: 'NV.10 ★ MÁX',
  };
}
