export type WeaponId =
  | 'kunai'
  | 'forcefield'
  | 'guardian'
  | 'lightning'
  | 'brick'
  | 'molotov'
  | 'drone'
  | 'katana'
  | 'soccer'
  | 'drill'
  | 'rpg'
  | 'boomerang'
  | 'durian'
  | 'laser';

export type PassiveId =
  | 'scroll'
  | 'energy_drink'
  | 'exo_bracer'
  | 'energy_cube'
  | 'fitness_guide'
  | 'gold_guide'
  | 'hi_power_bullet'
  | 'sneakers'
  | 'ammo_thruster'
  | 'he_fuel'
  | 'magnet_core'
  | 'ronin_armor';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  evoName: string;
  icon: string;
  evoIcon: string;
  color: string;
  evoColor: string;
  requiredPassive: PassiveId;
  description: string;
  evoDescription: string;
  baseDamage: number;
  baseCooldownMs: number;
}

export interface PassiveDefinition {
  id: PassiveId;
  name: string;
  icon: string;
  color: string;
  pairsWithWeapon: WeaponId;
  description: string;
  statPerLevel: string;
}

export interface WorldTeleporter {
  id: string;
  label: string;
  targetWorldId: string;
  x: number;
  y: number;
  color: string;
  badge: string;
}

export interface WorldDefinition {
  id: string;
  number: number;
  name: string;
  subtitle: string;
  recommendedLevel: number;
  bgPrimary: string;
  bgSecondary: string;
  laneLineColor: string;
  accentColor: string;
  borderFenceStyle:
    | 'wood_highway'
    | 'steel_military'
    | 'radioactive_canyon'
    | 'cyber_grid'
    | 'volcanic_abyss'
    | 'astral_gold';
  enemyHpMultiplier: number;
  enemyDamageMultiplier: number;
  xpMultiplier: number;
  goldMultiplier: number;
  enemyTypes: {
    id: string;
    name: string;
    helmetColor: string;
    bodyColor: string;
    gunColor: string;
    radius: number;
    speed: number;
    hpRatio: number;
    isRanged?: boolean;
  }[];
  bossName: string;
  bossColor: string;
  teleporters: WorldTeleporter[];
}

export interface HeroDefinition {
  id: string;
  name: string;
  title: string;
  visorColor: string;
  scarfColor: string;
  suitColor: string;
  starterWeapon: WeaponId;
  bonusText: string;
  atkMultiplier: number;
  hpMultiplier: number;
  speedMultiplier: number;
  unlockCost: number;
}

export interface PermanentUpgradeDef {
  id: 'atk' | 'hp' | 'speed' | 'magnet' | 'crit' | 'greed';
  name: string;
  icon: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  bonusPerLevelLabel: string;
}

export const WEAPONS_CATALOG: Record<WeaponId, WeaponDefinition> = {
  kunai: {
    id: 'kunai',
    name: 'Kunai Ninja',
    evoName: 'Shuriken Fantasma',
    icon: '🗡️',
    evoIcon: '🩸',
    color: '#38bdf8',
    evoColor: '#ef4444',
    requiredPassive: 'scroll',
    description: 'Auto-apunta y lanza kunais afilados al enemigo más cercano.',
    evoDescription: 'EVO ★: Ráfaga incesante de shurikens carmesí que atraviesan enemigos sin pausa.',
    baseDamage: 420,
    baseCooldownMs: 620,
  },
  forcefield: {
    id: 'forcefield',
    name: 'Campo de Fuerza',
    evoName: 'Campo de Presión',
    icon: '🟢',
    evoIcon: '☢️',
    color: '#22c55e',
    evoColor: '#10b981',
    requiredPassive: 'energy_drink',
    description: 'Aura verde octogonal que disuelve y daña a todos los enemigos que se acerquen.',
    evoDescription: 'EVO ★: Aura colosal que incinera, ralentiza y repele a las hordas.',
    baseDamage: 195,
    baseCooldownMs: 380,
  },
  drone: {
    id: 'drone',
    name: 'Dron Misiles A+B',
    evoName: 'Destructor Divino',
    icon: '🛸',
    evoIcon: '🚀',
    color: '#a855f7',
    evoColor: '#ec4899',
    requiredPassive: 'hi_power_bullet',
    description: 'Dos drones autónomos que disparan salvas continuas de misiles dirigibles con estela de humo.',
    evoDescription: 'EVO ★: Enjambre de misiles teledirigidos con cabeza explosiva que persiguen y detonan en área.',
    baseDamage: 390,
    baseCooldownMs: 520,
  },
  guardian: {
    id: 'guardian',
    name: 'Guardián Giratorio',
    evoName: 'Defensor Eterno',
    icon: '⚙️',
    evoIcon: '🛞',
    color: '#f59e0b',
    evoColor: '#dc2626',
    requiredPassive: 'exo_bracer',
    description: 'Cuchillas rotatorias que orbitan a tu alrededor y empujan a los zombis.',
    evoDescription: 'EVO ★: 6 discos de titanio carmesí permanentes con doble velocidad y empuje.',
    baseDamage: 280,
    baseCooldownMs: 100,
  },
  lightning: {
    id: 'lightning',
    name: 'Emisor de Rayos',
    evoName: 'Celda de Supercarga',
    icon: '⚡',
    evoIcon: '🌩️',
    color: '#60a5fa',
    evoColor: '#a855f7',
    requiredPassive: 'energy_cube',
    description: 'Invoca relámpagos del cielo con daño explosivo sobre objetivos aleatorios.',
    evoDescription: 'EVO ★: Tormenta eléctrica masiva que deja anillos de plasma ionizado.',
    baseDamage: 680,
    baseCooldownMs: 1350,
  },
  soccer: {
    id: 'soccer',
    name: 'Balón de Fútbol',
    evoName: 'Balón Cuántico',
    icon: '⚽',
    evoIcon: '☄️',
    color: '#10b981',
    evoColor: '#06b6d4',
    requiredPassive: 'sneakers',
    description: 'Dispara balones veloces que rebotan entre múltiples enemigos y bordes de pantalla.',
    evoDescription: 'EVO ★: Balones cuánticos supersónicos con estela neón y rebotes explosivos.',
    baseDamage: 510,
    baseCooldownMs: 1050,
  },
  drill: {
    id: 'drill',
    name: 'Taladro Silbante',
    evoName: 'Flecha Silbante',
    icon: '🔩',
    evoIcon: '💘',
    color: '#facc15',
    evoColor: '#f43f5e',
    requiredPassive: 'ammo_thruster',
    description: 'Taladro perforador que vuela y rebota sin parar por toda la pantalla.',
    evoDescription: 'EVO ★: La legendaria Flecha Silbante que persigue y atraviesa enemigos a velocidad extrema.',
    baseDamage: 360,
    baseCooldownMs: 400,
  },
  rpg: {
    id: 'rpg',
    name: 'Lanzacohetes RPG',
    evoName: 'Cañón Tiburón',
    icon: '🧨',
    evoIcon: '🦈',
    color: '#ef4444',
    evoColor: '#3b82f6',
    requiredPassive: 'he_fuel',
    description: 'Dispara cohetes pesados que provocan una gran explosión en área al impactar.',
    evoDescription: 'EVO ★: Torpedos Tiburón que detonan con ondas expansivas gigantes.',
    baseDamage: 880,
    baseCooldownMs: 1550,
  },
  boomerang: {
    id: 'boomerang',
    name: 'Bumerán Táctico',
    evoName: 'Dardo Magnético',
    icon: '🪃',
    evoIcon: '🧲',
    color: '#14b8a6',
    evoColor: '#f97316',
    requiredPassive: 'magnet_core',
    description: 'Lanza bumeranes que van y regresan atravesando filas enteras de zombis.',
    evoDescription: 'EVO ★: Dardos magnéticos bipolares que giran en espiral expansiva de 360°.',
    baseDamage: 490,
    baseCooldownMs: 1100,
  },
  durian: {
    id: 'durian',
    name: 'Durian Espinoso',
    evoName: 'Caltrops Gigante',
    icon: '🌵',
    evoIcon: '☸️',
    color: '#84cc16',
    evoColor: '#e11d48',
    requiredPassive: 'ronin_armor',
    description: 'Fruta gigante con púas que rueda por la pantalla aplastando todo a su paso.',
    evoDescription: 'EVO ★: Esfera colosal que lanza espinas perforantes en todas direcciones.',
    baseDamage: 460,
    baseCooldownMs: 320,
  },
  laser: {
    id: 'laser',
    name: 'Lanzador Láser',
    evoName: 'Matriz de Aniquilación',
    icon: '🔦',
    evoIcon: '🔮',
    color: '#38bdf8',
    evoColor: '#d946ef',
    requiredPassive: 'energy_cube',
    description: 'Haces láser gemelos que barren la pantalla e incineran hordas enteras.',
    evoDescription: 'EVO ★: Rayos orbitales convergentes que desintegran todo en espiral.',
    baseDamage: 610,
    baseCooldownMs: 1400,
  },
  brick: {
    id: 'brick',
    name: 'Ladrillo Pesado',
    evoName: 'Pesa de 1 Tonelada',
    icon: '🧱',
    evoIcon: '🏋️',
    color: '#ea580c',
    evoColor: '#f43f5e',
    requiredPassive: 'fitness_guide',
    description: 'Lanza ladrillos pesados que atraviesan y aplastan filas enteras de enemigos.',
    evoDescription: 'EVO ★: Dispara un anillo de 8 pesas de hierro gigantes en 360 grados.',
    baseDamage: 620,
    baseCooldownMs: 1450,
  },
  molotov: {
    id: 'molotov',
    name: 'Cóctel Molotov',
    evoName: 'Barril de Combustible',
    icon: '🔥',
    evoIcon: '🛢️',
    color: '#f97316',
    evoColor: '#06b6d4',
    requiredPassive: 'gold_guide',
    description: 'Lanza botellas incendiarias que cubren el suelo con charcos de fuego.',
    evoDescription: 'EVO ★: Fuego azul napalm de alta temperatura que incinera todo el perímetro.',
    baseDamage: 240,
    baseCooldownMs: 1650,
  },
  katana: {
    id: 'katana',
    name: 'Hoja Cortaviento',
    evoName: 'Espada Demoníaca',
    icon: '⚔️',
    evoIcon: '🌙',
    color: '#e2e8f0',
    evoColor: '#f43f5e',
    requiredPassive: 'ronin_armor',
    description: 'Desata tajos de energía en abanico que cortan hordas enteras.',
    evoDescription: 'EVO ★: Ondas de corte sangrientas de 360° que regeneran tu vida al impactar.',
    baseDamage: 540,
    baseCooldownMs: 980,
  },
};

export const PASSIVES_CATALOG: Record<PassiveId, PassiveDefinition> = {
  scroll: {
    id: 'scroll',
    name: 'Pergamino Koga',
    icon: '📜',
    color: '#fbbf24',
    pairsWithWeapon: 'kunai',
    description: 'Aumenta toda la experiencia (XP) obtenida y evoluciona el Kunai.',
    statPerLevel: '+16% XP Ganada / Nivel',
  },
  energy_drink: {
    id: 'energy_drink',
    name: 'Bebida Energética',
    icon: '🥤',
    color: '#22c55e',
    pairsWithWeapon: 'forcefield',
    description: 'Regenera tu barra de vida cada segundo y evoluciona el Campo de Fuerza.',
    statPerLevel: '+1.5% Vida/seg / Nivel',
  },
  hi_power_bullet: {
    id: 'hi_power_bullet',
    name: 'Balas de Alta Potencia',
    icon: '🎯',
    color: '#dc2626',
    pairsWithWeapon: 'drone',
    description: 'Aumenta el daño de ataque de todas las armas y evoluciona el Dron de Misiles.',
    statPerLevel: '+20% Daño Total / Nivel',
  },
  exo_bracer: {
    id: 'exo_bracer',
    name: 'Exoesqueleto',
    icon: '🦾',
    color: '#f59e0b',
    pairsWithWeapon: 'guardian',
    description: 'Aumenta la duración y empuje de tus habilidades. Evoluciona el Guardián.',
    statPerLevel: '+15% Duración y Empuje / Nivel',
  },
  energy_cube: {
    id: 'energy_cube',
    name: 'Cubo de Energía',
    icon: '🧊',
    color: '#38bdf8',
    pairsWithWeapon: 'lightning',
    description: 'Disminuye el tiempo de recarga de todas las armas. Evoluciona Rayo y Láser.',
    statPerLevel: '-10% Recarga (Cooldown) / Nivel',
  },
  sneakers: {
    id: 'sneakers',
    name: 'Botas Deportivas',
    icon: '👟',
    color: '#10b981',
    pairsWithWeapon: 'soccer',
    description: 'Aumenta tu velocidad de movimiento y evoluciona el Balón de Fútbol.',
    statPerLevel: '+14% Velocidad / Nivel',
  },
  ammo_thruster: {
    id: 'ammo_thruster',
    name: 'Propulsor de Munición',
    icon: '🚀',
    color: '#facc15',
    pairsWithWeapon: 'drill',
    description: 'Aumenta la velocidad de vuelo de todos los proyectiles y evoluciona el Taladro.',
    statPerLevel: '+20% Velocidad Proyectil / Nivel',
  },
  he_fuel: {
    id: 'he_fuel',
    name: 'Combustible HE',
    icon: '⛽',
    color: '#ef4444',
    pairsWithWeapon: 'rpg',
    description: 'Aumenta el tamaño y alcance de todos los proyectiles y explosiones. Evoluciona RPG.',
    statPerLevel: '+18% Radio Explosivo / Nivel',
  },
  magnet_core: {
    id: 'magnet_core',
    name: 'Imán de Alta Potencia',
    icon: '🧲',
    color: '#a855f7',
    pairsWithWeapon: 'boomerang',
    description: 'Amplía el radio de absorción de gemas y evoluciona el Bumerán.',
    statPerLevel: '+40% Radio de Imán / Nivel',
  },
  ronin_armor: {
    id: 'ronin_armor',
    name: 'Armadura Ronin',
    icon: '🥋',
    color: '#64748b',
    pairsWithWeapon: 'durian',
    description: 'Reduce todo el daño recibido y evoluciona el Durian Espinoso y la Katana.',
    statPerLevel: '-12% Daño Recibido / Nivel',
  },
  fitness_guide: {
    id: 'fitness_guide',
    name: 'Pesa de Gimnasio',
    icon: '💪',
    color: '#ef4444',
    pairsWithWeapon: 'brick',
    description: 'Incrementa tu Vida Máxima un 25% por nivel y evoluciona el Ladrillo.',
    statPerLevel: '+25% Vida Máxima / Nivel',
  },
  gold_guide: {
    id: 'gold_guide',
    name: 'Bono de Oro',
    icon: '🪙',
    color: '#eab308',
    pairsWithWeapon: 'molotov',
    description: 'Aumenta las monedas obtenidas y evoluciona el Cóctel Molotov.',
    statPerLevel: '+25% Oro Recolectado / Nivel',
  },
};

export const WORLDS: WorldDefinition[] = [
  {
    id: 'world_highway',
    number: 1,
    name: 'Autopista Zombi',
    subtitle: 'Zona Cero · Puente de Evacuación',
    recommendedLevel: 1,
    bgPrimary: '#637a91',
    bgSecondary: '#566c82',
    laneLineColor: '#9eb2c5',
    accentColor: '#22c55e',
    borderFenceStyle: 'wood_highway',
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 1,
    xpMultiplier: 1,
    goldMultiplier: 1,
    enemyTypes: [
      {
        id: 'zombie_soldier',
        name: 'Soldado Zombi',
        helmetColor: '#4d7c43',
        bodyColor: '#6ea159',
        gunColor: '#52525b',
        radius: 17,
        speed: 58,
        hpRatio: 1,
      },
      {
        id: 'zombie_runner',
        name: 'Corredor Infectado',
        helmetColor: '#b91c1c',
        bodyColor: '#84cc16',
        gunColor: '#3f3f46',
        radius: 15,
        speed: 84,
        hpRatio: 0.75,
      },
      {
        id: 'zombie_sergeant',
        name: 'Sargento Blindado',
        helmetColor: '#365314',
        bodyColor: '#4d7c0f',
        gunColor: '#27272a',
        radius: 22,
        speed: 46,
        hpRatio: 2.3,
      },
    ],
    bossName: 'General Zombi Mutante',
    bossColor: '#dc2626',
    teleporters: [
      {
        id: 'tp_hw_to_military',
        label: 'Portal ➔ Mundo 2: Base Militar',
        targetWorldId: 'world_military',
        x: 0,
        y: -750,
        color: '#38bdf8',
        badge: 'MUNDO 2',
      },
      {
        id: 'tp_hw_to_canyon',
        label: 'Portal ➔ Mundo 3: Desierto Radiactivo',
        targetWorldId: 'world_canyon',
        x: 680,
        y: 0,
        color: '#eab308',
        badge: 'MUNDO 3',
      },
      {
        id: 'tp_hw_to_cyber',
        label: 'Portal ➔ Mundo 4: Neo-Tokyo',
        targetWorldId: 'world_cyber',
        x: -680,
        y: 0,
        color: '#a855f7',
        badge: 'MUNDO 4',
      },
    ],
  },
  {
    id: 'world_military',
    number: 2,
    name: 'Base Militar Delta',
    subtitle: 'Sector Blindado de Cuarentena',
    recommendedLevel: 5,
    bgPrimary: '#475569',
    bgSecondary: '#334155',
    laneLineColor: '#94a3b8',
    accentColor: '#38bdf8',
    borderFenceStyle: 'steel_military',
    enemyHpMultiplier: 2.4,
    enemyDamageMultiplier: 1.6,
    xpMultiplier: 2.2,
    goldMultiplier: 2.5,
    enemyTypes: [
      {
        id: 'commando_zombie',
        name: 'Comando Táctico',
        helmetColor: '#1e293b',
        bodyColor: '#65a30d',
        gunColor: '#0f172a',
        radius: 18,
        speed: 66,
        hpRatio: 1.2,
      },
      {
        id: 'bio_hazmat',
        name: 'Soldado Bio-Químico',
        helmetColor: '#eab308',
        bodyColor: '#facc15',
        gunColor: '#334155',
        radius: 19,
        speed: 62,
        hpRatio: 1.5,
      },
      {
        id: 'heavy_riot',
        name: 'Escudo Antidisturbios',
        helmetColor: '#0f172a',
        bodyColor: '#475569',
        gunColor: '#1e293b',
        radius: 24,
        speed: 50,
        hpRatio: 2.8,
      },
    ],
    bossName: 'Mecha Destructor T-90',
    bossColor: '#f97316',
    teleporters: [
      {
        id: 'tp_mil_to_hw',
        label: 'Portal ➔ Mundo 1: Autopista Zombi',
        targetWorldId: 'world_highway',
        x: 0,
        y: 750,
        color: '#22c55e',
        badge: 'MUNDO 1',
      },
      {
        id: 'tp_mil_to_canyon',
        label: 'Portal ➔ Mundo 3: Desierto Radiactivo',
        targetWorldId: 'world_canyon',
        x: 0,
        y: -750,
        color: '#eab308',
        badge: 'MUNDO 3',
      },
      {
        id: 'tp_mil_to_abyss',
        label: 'Portal ➔ Mundo 5: Volcán Abisal',
        targetWorldId: 'world_abyss',
        x: 700,
        y: 0,
        color: '#ef4444',
        badge: 'MUNDO 5',
      },
    ],
  },
  {
    id: 'world_canyon',
    number: 3,
    name: 'Desierto Radiactivo',
    subtitle: 'Cañón de Uranio y Mutantes',
    recommendedLevel: 12,
    bgPrimary: '#78553a',
    bgSecondary: '#65462e',
    laneLineColor: '#a88463',
    accentColor: '#eab308',
    borderFenceStyle: 'radioactive_canyon',
    enemyHpMultiplier: 5.5,
    enemyDamageMultiplier: 2.4,
    xpMultiplier: 4.5,
    goldMultiplier: 5,
    enemyTypes: [
      {
        id: 'wasteland_raider',
        name: 'Saqueador del Yermo',
        helmetColor: '#7c2d12',
        bodyColor: '#a3e635',
        gunColor: '#451a03',
        radius: 18,
        speed: 72,
        hpRatio: 1.3,
      },
      {
        id: 'mutant_scorpion',
        name: 'Escorpión de Uranio',
        helmetColor: '#15803d',
        bodyColor: '#22c55e',
        gunColor: '#14532d',
        radius: 20,
        speed: 88,
        hpRatio: 1.1,
      },
      {
        id: 'nuclear_brute',
        name: 'Coloso Radiactivo',
        helmetColor: '#365314',
        bodyColor: '#84cc16',
        gunColor: '#1a2e05',
        radius: 25,
        speed: 52,
        hpRatio: 3.2,
      },
    ],
    bossName: 'Emperador Escorpión Nuclear',
    bossColor: '#84cc16',
    teleporters: [
      {
        id: 'tp_can_to_mil',
        label: 'Portal ➔ Mundo 2: Base Militar',
        targetWorldId: 'world_military',
        x: 0,
        y: 750,
        color: '#38bdf8',
        badge: 'MUNDO 2',
      },
      {
        id: 'tp_can_to_cyber',
        label: 'Portal ➔ Mundo 4: Neo-Tokyo Cyber',
        targetWorldId: 'world_cyber',
        x: 0,
        y: -750,
        color: '#a855f7',
        badge: 'MUNDO 4',
      },
      {
        id: 'tp_can_to_hw',
        label: 'Portal ➔ Mundo 1: Autopista Zombi',
        targetWorldId: 'world_highway',
        x: -700,
        y: 0,
        color: '#22c55e',
        badge: 'MUNDO 1',
      },
    ],
  },
  {
    id: 'world_cyber',
    number: 4,
    name: 'Laboratorio Cyber-Neón',
    subtitle: 'Distrito Sintético Neo-Tokyo',
    recommendedLevel: 20,
    bgPrimary: '#1e1b4b',
    bgSecondary: '#17153b',
    laneLineColor: '#4f46e5',
    accentColor: '#c084fc',
    borderFenceStyle: 'cyber_grid',
    enemyHpMultiplier: 12,
    enemyDamageMultiplier: 3.8,
    xpMultiplier: 9,
    goldMultiplier: 10,
    enemyTypes: [
      {
        id: 'cyber_trooper',
        name: 'Cyborg de Asalto',
        helmetColor: '#06b6d4',
        bodyColor: '#64748b',
        gunColor: '#0ea5e9',
        radius: 18,
        speed: 78,
        hpRatio: 1.4,
      },
      {
        id: 'neon_ninja',
        name: 'Asesino Holográfico',
        helmetColor: '#ec4899',
        bodyColor: '#312e81',
        gunColor: '#f43f5e',
        radius: 16,
        speed: 96,
        hpRatio: 1.1,
      },
      {
        id: 'plasma_golem',
        name: 'Guardián de Plasma',
        helmetColor: '#8b5cf6',
        bodyColor: '#4c1d95',
        gunColor: '#c084fc',
        radius: 25,
        speed: 58,
        hpRatio: 3.5,
      },
    ],
    bossName: 'Núcleo IA Omega-X',
    bossColor: '#ec4899',
    teleporters: [
      {
        id: 'tp_cyb_to_can',
        label: 'Portal ➔ Mundo 3: Desierto Radiactivo',
        targetWorldId: 'world_canyon',
        x: 0,
        y: 750,
        color: '#eab308',
        badge: 'MUNDO 3',
      },
      {
        id: 'tp_cyb_to_abyss',
        label: 'Portal ➔ Mundo 5: Volcán Abisal',
        targetWorldId: 'world_abyss',
        x: 0,
        y: -750,
        color: '#ef4444',
        badge: 'MUNDO 5',
      },
      {
        id: 'tp_cyb_to_astral',
        label: 'Portal ➔ Mundo 6: Santuario Astral',
        targetWorldId: 'world_astral',
        x: 700,
        y: 0,
        color: '#fbbf24',
        badge: 'MUNDO 6',
      },
    ],
  },
  {
    id: 'world_abyss',
    number: 5,
    name: 'Volcán Abisal',
    subtitle: 'Fortaleza de Magma y Obsidiana',
    recommendedLevel: 32,
    bgPrimary: '#451a1c',
    bgSecondary: '#361315',
    laneLineColor: '#991b1b',
    accentColor: '#f97316',
    borderFenceStyle: 'volcanic_abyss',
    enemyHpMultiplier: 26,
    enemyDamageMultiplier: 5.5,
    xpMultiplier: 20,
    goldMultiplier: 24,
    enemyTypes: [
      {
        id: 'magma_legion',
        name: 'Legionario de Magma',
        helmetColor: '#dc2626',
        bodyColor: '#7f1d1d',
        gunColor: '#f97316',
        radius: 19,
        speed: 82,
        hpRatio: 1.5,
      },
      {
        id: 'hell_hound',
        name: 'Sabueso Infernal',
        helmetColor: '#ea580c',
        bodyColor: '#9a3412',
        gunColor: '#fbbf24',
        radius: 17,
        speed: 102,
        hpRatio: 1.2,
      },
      {
        id: 'obsidian_titan',
        name: 'Titán de Obsidiana',
        helmetColor: '#18181b',
        bodyColor: '#b91c1c',
        gunColor: '#ef4444',
        radius: 26,
        speed: 62,
        hpRatio: 4,
      },
    ],
    bossName: 'Señor del Abismo Ignis',
    bossColor: '#f97316',
    teleporters: [
      {
        id: 'tp_aby_to_cyb',
        label: 'Portal ➔ Mundo 4: Neo-Tokyo Cyber',
        targetWorldId: 'world_cyber',
        x: 0,
        y: 750,
        color: '#a855f7',
        badge: 'MUNDO 4',
      },
      {
        id: 'tp_aby_to_astral',
        label: 'Portal ➔ Mundo 6: Santuario Astral',
        targetWorldId: 'world_astral',
        x: 0,
        y: -750,
        color: '#fbbf24',
        badge: 'MUNDO 6',
      },
      {
        id: 'tp_aby_to_hw',
        label: 'Portal ➔ Mundo 1: Autopista Zombi',
        targetWorldId: 'world_highway',
        x: -700,
        y: 0,
        color: '#22c55e',
        badge: 'MUNDO 1',
      },
    ],
  },
  {
    id: 'world_astral',
    number: 6,
    name: 'Santuario Astral',
    subtitle: 'Dimensión Divina · Recompensas x50',
    recommendedLevel: 45,
    bgPrimary: '#1e293b',
    bgSecondary: '#0f172a',
    laneLineColor: '#eab308',
    accentColor: '#facc15',
    borderFenceStyle: 'astral_gold',
    enemyHpMultiplier: 60,
    enemyDamageMultiplier: 8,
    xpMultiplier: 48,
    goldMultiplier: 55,
    enemyTypes: [
      {
        id: 'astral_sentinel',
        name: 'Centinela Estelar',
        helmetColor: '#facc15',
        bodyColor: '#38bdf8',
        gunColor: '#fde047',
        radius: 19,
        speed: 86,
        hpRatio: 1.6,
      },
      {
        id: 'void_reaper',
        name: 'Segador Cósmico',
        helmetColor: '#c084fc',
        bodyColor: '#6366f1',
        gunColor: '#e879f9',
        radius: 18,
        speed: 105,
        hpRatio: 1.3,
      },
      {
        id: 'seraph_knight',
        name: 'Arcángel Acorazado',
        helmetColor: '#fbbf24',
        bodyColor: '#f8fafc',
        gunColor: '#f59e0b',
        radius: 27,
        speed: 65,
        hpRatio: 4.5,
      },
    ],
    bossName: 'Soberano Eterno del Cosmos',
    bossColor: '#facc15',
    teleporters: [
      {
        id: 'tp_ast_to_aby',
        label: 'Portal ➔ Mundo 5: Volcán Abisal',
        targetWorldId: 'world_abyss',
        x: 0,
        y: 750,
        color: '#ef4444',
        badge: 'MUNDO 5',
      },
      {
        id: 'tp_ast_to_hw',
        label: 'Portal ➔ Mundo 1: Autopista Zombi',
        targetWorldId: 'world_highway',
        x: 0,
        y: -750,
        color: '#22c55e',
        badge: 'MUNDO 1',
      },
      {
        id: 'tp_ast_to_cyb',
        label: 'Portal ➔ Mundo 4: Neo-Tokyo Cyber',
        targetWorldId: 'world_cyber',
        x: -700,
        y: 0,
        color: '#a855f7',
        badge: 'MUNDO 4',
      },
    ],
  },
];

export const HEROES_CATALOG: HeroDefinition[] = [
  {
    id: 'survivor_alpha',
    name: 'Comandante Koga',
    title: 'Superviviente Original (Captura)',
    visorColor: '#7dd3fc',
    scarfColor: '#dc2626',
    suitColor: '#334155',
    starterWeapon: 'kunai',
    bonusText: 'Empieza con Kunai + Campo de Fuerza + Dron Misiles · +15% Cadencia',
    atkMultiplier: 1.15,
    hpMultiplier: 1.0,
    speedMultiplier: 1.05,
    unlockCost: 0,
  },
  {
    id: 'cyber_valkyrie',
    name: 'Valkiria Neón',
    title: 'Especialista de Drones y Láser',
    visorColor: '#f472b6',
    scarfColor: '#a855f7',
    suitColor: '#1e1b4b',
    starterWeapon: 'drone',
    bonusText: '+35% Daño Crítico y +20% Velocidad de Movimiento',
    atkMultiplier: 1.35,
    hpMultiplier: 1.15,
    speedMultiplier: 1.2,
    unlockCost: 600,
  },
  {
    id: 'titan_juggernaut',
    name: 'Titán Blindado Rex',
    title: 'Coloso de Cohetes RPG y Guardián',
    visorColor: '#facc15',
    scarfColor: '#ea580c',
    suitColor: '#3f6212',
    starterWeapon: 'rpg',
    bonusText: '+80% Vida Máxima y +50% Daño de Explosiones',
    atkMultiplier: 1.5,
    hpMultiplier: 1.8,
    speedMultiplier: 1.1,
    unlockCost: 1500,
  },
  {
    id: 'crimson_ronin',
    name: 'Maestro Ronin Tsukuyomi',
    title: 'Señor de las Cuchillas EVO',
    visorColor: '#f87171',
    scarfColor: '#ef4444',
    suitColor: '#18181b',
    starterWeapon: 'katana',
    bonusText: '+100% Daño Total y Robo de Vida Pasivo',
    atkMultiplier: 2.0,
    hpMultiplier: 1.5,
    speedMultiplier: 1.25,
    unlockCost: 3500,
  },
];

export const PERMANENT_UPGRADES: PermanentUpgradeDef[] = [
  {
    id: 'atk',
    name: 'Potencia de Ataque',
    icon: '⚔️',
    description: 'Incrementa permanentemente el daño de todas tus armas y evoluciones.',
    baseCost: 50,
    costMultiplier: 1.35,
    bonusPerLevelLabel: '+15% Daño Total',
  },
  {
    id: 'hp',
    name: 'Armadura Vital',
    icon: '🛡️',
    description: 'Incrementa tu Vida Máxima y la regeneración pasiva por segundo.',
    baseCost: 50,
    costMultiplier: 1.35,
    bonusPerLevelLabel: '+20% Vida Máx + Regen',
  },
  {
    id: 'speed',
    name: 'Propulsores Tácticos',
    icon: '⚡',
    description: 'Aumenta tu velocidad al caminar y la cadencia de ataque.',
    baseCost: 65,
    costMultiplier: 1.4,
    bonusPerLevelLabel: '+8% Velocidad y Cadencia',
  },
  {
    id: 'magnet',
    name: 'Núcleo Magnético',
    icon: '🧲',
    description: 'Amplía el radio en el que las gemas y monedas vuelan hacia ti.',
    baseCost: 60,
    costMultiplier: 1.38,
    bonusPerLevelLabel: '+25% Radio de Imán',
  },
  {
    id: 'crit',
    name: 'Instinto Letal',
    icon: '💥',
    description: 'Aumenta la probabilidad de golpe crítico y su multiplicador de daño.',
    baseCost: 80,
    costMultiplier: 1.42,
    bonusPerLevelLabel: '+5% Crítico / +25% Daño Crit',
  },
  {
    id: 'greed',
    name: 'Multiplicador de Fortuna',
    icon: '💰',
    description: 'Multiplica todas las monedas de oro y gemas de XP recolectadas.',
    baseCost: 90,
    costMultiplier: 1.45,
    bonusPerLevelLabel: '+20% Oro y XP',
  },
];
