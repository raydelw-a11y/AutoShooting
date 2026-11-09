import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Pause,
  Play,
  Volume2,
  VolumeX,
  Compass,
  Sparkles,
  Shield,
  Skull,
  Lock,
  CheckCircle2,
  Swords,
  Zap,
  Crown,
  RotateCcw,
} from 'lucide-react';
import {
  HEROES_CATALOG,
  PASSIVES_CATALOG,
  PERMANENT_UPGRADES,
  PassiveId,
  WEAPONS_CATALOG,
  WORLDS,
  WeaponId,
  WorldTeleporter,
} from './data/gameCatalog';
import {
  PersistentSaveData,
  formatWeaponTierLabel,
  getDefaultSaveData,
  getXpRequiredForLevel,
  loadSaveData,
  saveGameData,
} from './utils/saveState';
import { SurvivorCanvas } from './components/SurvivorCanvas';
import { soundEngine } from './utils/soundEngine';

declare const __BUILD_TIMESTAMP__: string | undefined;

const FALLBACK_TIMESTAMP = '07:40 PM - 11/08/2026';

interface UpgradeOption {
  kind: 'weapon' | 'passive';
  id: WeaponId | PassiveId;
  nextLevel: number;
  isEvoUnlock: boolean;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  accentColor: string;
  pairLabel?: string;
}

export default function App() {
  const buildTimestamp =
    typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : FALLBACK_TIMESTAMP;

  // 1. Pantalla de Acceso Privado (Regla Global con soporte Enter)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('survivor_auth_ok') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  // 2. Estado Persistente con Auto-Save Continuo
  const [saveData, setSaveData] = useState<PersistentSaveData>(() => loadSaveData());
  const [autoSaveFlash, setAutoSaveFlash] = useState<boolean>(false);

  // 3. Modales y Estado de Interfaz
  const [activeModal, setActiveModal] = useState<
    null | 'pause_arsenal' | 'level_up' | 'rainbow_chest' | 'portals' | 'shop' | 'heroes'
  >(null);
  const [pendingLevelUps, setPendingLevelUps] = useState<number>(0);
  const [levelUpOptions, setLevelUpOptions] = useState<UpgradeOption[]>([]);
  const [chestRewards, setChestRewards] = useState<{
    upgrades: UpgradeOption[];
    bonusGold: number;
  } | null>(null);
  const [nearbyTeleporter, setNearbyTeleporter] = useState<WorldTeleporter | null>(null);
  const [activeBoss, setActiveBoss] = useState<{
    name: string;
    hp: number;
    maxHp: number;
  } | null>(null);
  const [spawnBossSignal, setSpawnBossSignal] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [warpBanner, setWarpBanner] = useState<string | null>(null);

  const currentWorld = useMemo(() => {
    return WORLDS.find((w) => w.id === saveData.currentWorldId) || WORLDS[0];
  }, [saveData.currentWorldId]);

  const xpRequired = useMemo(() => getXpRequiredForLevel(saveData.level), [saveData.level]);
  const xpProgressPct = Math.min(100, Math.round((saveData.xp / xpRequired) * 100));

  // Auto-Save en localStorage cada vez que cambia saveData
  useEffect(() => {
    saveGameData(saveData);
    setAutoSaveFlash(true);
    const t = setTimeout(() => setAutoSaveFlash(false), 900);
    return () => clearTimeout(t);
  }, [saveData]);

  // Cronómetro persistente de sesión (exacto al "00:04" de la captura)
  useEffect(() => {
    if (!isAuthenticated || activeModal !== null) return;
    const interval = setInterval(() => {
      setSaveData((prev) => ({
        ...prev,
        playTimeSeconds: prev.playTimeSeconds + 1,
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, activeModal]);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Generador de 3 opciones de mejora al subir de nivel (priorizando EVOs disponibles)
  const buildUpgradePool = useCallback((data: PersistentSaveData): UpgradeOption[] => {
    const pool: UpgradeOption[] = [];

    (Object.keys(WEAPONS_CATALOG) as WeaponId[]).forEach((wId) => {
      const def = WEAPONS_CATALOG[wId];
      const currentLv = data.weapons[wId] || 0;
      const passiveLv = data.passives[def.requiredPassive] || 0;
      const nextLv = currentLv + 1;

      // Para evolucionar al Nivel 6 (EVO Estrella Roja), requiere tener la pasiva asociada (o si ya está en 6+, sube Maestría infinita)
      const isEvoStep = currentLv === 5;
      const canEvo = !isEvoStep || passiveLv >= 1;
      const effectiveNextLv = isEvoStep && !canEvo ? 5 : nextLv;
      const isEvoUnlock = isEvoStep && canEvo;

      const passiveDef = PASSIVES_CATALOG[def.requiredPassive];
      pool.push({
        kind: 'weapon',
        id: wId,
        nextLevel: effectiveNextLv,
        isEvoUnlock,
        title: isEvoUnlock || effectiveNextLv >= 6 ? def.evoName : def.name,
        subtitle: isEvoUnlock
          ? '¡EVOLUCIÓN SUPREMA EVO ★!'
          : effectiveNextLv > 6
          ? `Maestría EVO +${effectiveNextLv - 6}`
          : currentLv === 0
          ? 'Nueva Arma Activa'
          : `Mejorar a Nivel ${effectiveNextLv}`,
        description: isEvoUnlock || effectiveNextLv >= 6 ? def.evoDescription : def.description,
        icon: isEvoUnlock || effectiveNextLv >= 6 ? def.evoIcon : def.icon,
        accentColor: isEvoUnlock || effectiveNextLv >= 6 ? def.evoColor : def.color,
        pairLabel: `EVO con: ${passiveDef.icon} ${passiveDef.name}`,
      });
    });

    (Object.keys(PASSIVES_CATALOG) as PassiveId[]).forEach((pId) => {
      const def = PASSIVES_CATALOG[pId];
      const currentLv = data.passives[pId] || 0;
      const nextLv = currentLv + 1;
      const weaponDef = WEAPONS_CATALOG[def.pairsWithWeapon];
      pool.push({
        kind: 'passive',
        id: pId,
        nextLevel: nextLv,
        isEvoUnlock: false,
        title: def.name,
        subtitle: currentLv === 0 ? 'Nuevo Suministro Pasivo' : `Nivel ${nextLv} (${def.statPerLevel})`,
        description: def.description,
        icon: def.icon,
        accentColor: def.color,
        pairLabel: `Evoluciona: ${weaponDef.icon} ${weaponDef.name}`,
      });
    });

    // Mezclar pero dar prioridad a EVOs listas
    const evoReady = pool.filter((o) => o.isEvoUnlock);
    const others = pool.filter((o) => !o.isEvoUnlock).sort(() => Math.random() - 0.5);
    return [...evoReady, ...others].slice(0, 3);
  }, []);

  // Cuando hay subidas de nivel pendientes y no hay otro modal abierto, mostrar selector de cartas
  useEffect(() => {
    if (pendingLevelUps > 0 && activeModal === null) {
      setLevelUpOptions(buildUpgradePool(saveData));
      setActiveModal('level_up');
    }
  }, [pendingLevelUps, activeModal, saveData, buildUpgradePool]);

  const handleSelectUpgradeOption = (opt: UpgradeOption) => {
    soundEngine.playLevelUp();
    setSaveData((prev) => {
      const updated = { ...prev };
      if (opt.kind === 'weapon') {
        const wId = opt.id as WeaponId;
        updated.weapons = {
          ...prev.weapons,
          [wId]: (prev.weapons[wId] || 0) + 1,
        };
      } else {
        const pId = opt.id as PassiveId;
        updated.passives = {
          ...prev.passives,
          [pId]: (prev.passives[pId] || 0) + 1,
        };
      }
      return updated;
    });

    setPendingLevelUps((prev) => Math.max(0, prev - 1));
    setActiveModal(null);
  };

  // Callback del Canvas al ganar XP, Monedas y Bajas
  const handleGainXpAndCoins = useCallback(
    (xpDelta: number, goldDelta: number, killsDelta: number, bossesDelta: number) => {
      let levelsGainedNow = 0;
      setSaveData((prev) => {
        let newXp = prev.xp + xpDelta;
        let newLevel = prev.level;
        let req = getXpRequiredForLevel(newLevel);

        while (newXp >= req) {
          newXp -= req;
          newLevel += 1;
          levelsGainedNow += 1;
          req = getXpRequiredForLevel(newLevel);
        }

        return {
          ...prev,
          xp: newXp,
          level: newLevel,
          gold: prev.gold + goldDelta,
          totalKills: prev.totalKills + killsDelta,
          bossesDefeated: prev.bossesDefeated + bossesDelta,
        };
      });

      if (levelsGainedNow > 0) {
        soundEngine.playLevelUp();
        setPendingLevelUps((c) => c + levelsGainedNow);
      }
    },
    []
  );

  // Abrir el Cofre con Estela Arcoíris (otorga 3 mejoras directas + Oro)
  const handleOpenRainbowChest = useCallback(() => {
    setSaveData((prev) => {
      const rewards = buildUpgradePool(prev);
      const bonusGold = Math.round(120 * currentWorld.goldMultiplier);
      const nextWeapons = { ...prev.weapons };
      const nextPassives = { ...prev.passives };

      rewards.forEach((r) => {
        if (r.kind === 'weapon') {
          const wId = r.id as WeaponId;
          nextWeapons[wId] = (nextWeapons[wId] || 0) + 1;
        } else {
          const pId = r.id as PassiveId;
          nextPassives[pId] = (nextPassives[pId] || 0) + 1;
        }
      });

      setChestRewards({ upgrades: rewards, bonusGold });
      setActiveModal('rainbow_chest');

      return {
        ...prev,
        gold: prev.gold + bonusGold,
        weapons: nextWeapons,
        passives: nextPassives,
      };
    });
  }, [buildUpgradePool, currentWorld.goldMultiplier]);

  const handlePlayerPositionChange = useCallback((x: number, y: number) => {
    setSaveData((prev) => {
      if (Math.abs(prev.playerX - x) < 8 && Math.abs(prev.playerY - y) < 8) return prev;
      return {
        ...prev,
        playerX: x,
        playerY: y,
      };
    });
  }, []);

  const handleTravelToWorld = useCallback((targetWorldId: string) => {
    const targetWorld = WORLDS.find((w) => w.id === targetWorldId);
    if (!targetWorld) return;
    soundEngine.playPortalWarp();
    setSaveData((prev) => ({
      ...prev,
      currentWorldId: targetWorld.id,
      playerX: 0,
      playerY: 0,
      unlockedWorlds: Array.from(new Set([...prev.unlockedWorlds, targetWorld.id])),
    }));
    setActiveModal(null);
    setNearbyTeleporter(null);
    setWarpBanner(`🌀 Teletransportado a: ${targetWorld.name}`);
    setTimeout(() => setWarpBanner(null), 2800);
  }, []);

  const handleEnterTeleporter = useCallback(
    (tp: WorldTeleporter) => {
      handleTravelToWorld(tp.targetWorldId);
    },
    [handleTravelToWorld]
  );

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.muted = next;
  };

  // Comprar mejora permanente en la Tienda con monedas
  const handleBuyPermanentUpgrade = (id: 'atk' | 'hp' | 'speed' | 'magnet' | 'crit' | 'greed') => {
    const def = PERMANENT_UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const currentLv = saveData.permanentUpgrades[id] || 1;
    const cost = Math.round(def.baseCost * Math.pow(def.costMultiplier, currentLv - 1));
    if (saveData.gold < cost) return;

    soundEngine.playLevelUp();
    setSaveData((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      permanentUpgrades: {
        ...prev.permanentUpgrades,
        [id]: currentLv + 1,
      },
    }));
  };

  // Mejorar un arma directamente con Oro desde el Arsenal
  const handleDirectWeaponUpgradeWithGold = (wId: WeaponId) => {
    const currentLv = saveData.weapons[wId] || 0;
    const cost = Math.round(95 * Math.pow(1.45, currentLv));
    if (saveData.gold < cost) return;
    soundEngine.playLevelUp();
    setSaveData((prev) => ({
      ...prev,
      gold: prev.gold - cost,
      weapons: {
        ...prev.weapons,
        [wId]: currentLv + 1,
      },
    }));
  };

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    sessionStorage.setItem('survivor_auth_ok', 'true');
    setIsAuthenticated(true);
    setAuthError('');
    soundEngine.playLevelUp();
  };

  // ============================================================================
  // PANTALLA DE CONTRASEÑA (ACCESO PRIVADO - REGLA GLOBAL)
  // ============================================================================
  if (!isAuthenticated) {
    return (
      <div className="relative w-screen h-[100dvh] bg-slate-950 flex items-center justify-center overflow-hidden select-none px-4">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            background:
              'radial-gradient(circle at 50% 25%, rgba(34, 197, 94, 0.32), rgba(56, 189, 248, 0.18), rgba(9, 13, 22, 0.98))',
          }}
        />

        {/* Indicador de actualización obligatorio en esquina */}
        <div className="fixed bottom-2 right-3 z-50 text-[10px] text-slate-300/90 font-mono bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700 pointer-events-none">
          Actualizado: {buildTimestamp}
        </div>

        <div className="relative z-10 w-full max-w-sm bg-slate-900/95 border-4 border-black rounded-3xl p-6 shadow-[0_8px_0_#000] backdrop-blur-md">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 border-3 border-black shadow-[0_4px_0_#000] flex items-center justify-center mb-3 text-3xl">
              🗡️
            </div>
            <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-extrabold">
              Mundo Abierto · Auto-Save · Evolución EVO
            </span>
            <h1 className="font-survivor text-3xl text-white mt-1 text-stroke-md tracking-wide">
              SURVIVOR.IO MOBILE
            </h1>
            <p className="text-xs text-slate-300 mt-1">
              Acceso Privado · Tu personaje conserva todas sus mejoras y posición automáticamente
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                Clave de Acceso Privado
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleLoginSubmit();
                  }
                }}
                placeholder="Presiona Enter o escribe tu clave..."
                autoFocus
                className="w-full px-3.5 py-3 rounded-xl bg-slate-950 border-2 border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-400"
              />
              {authError && <p className="text-xs text-red-400 mt-1">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 hover:from-emerald-300 hover:to-green-500 text-white font-survivor text-lg tracking-wider uppercase survivor-btn text-stroke-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              Entrar al Mundo [Enter]
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PANTALLA PRINCIPAL DEL JUEGO (FORMATO VERTICAL MÓVIL IDÉNTICO A LA CAPTURA)
  // ============================================================================
  return (
    <div className="relative w-screen h-[100dvh] bg-slate-950 overflow-hidden select-none flex flex-col">
      {/* Lienzo 2D a 60 FPS en pantalla completa */}
      <div className="relative flex-1 w-full h-full">
        <SurvivorCanvas
          saveData={saveData}
          currentWorld={currentWorld}
          isPaused={activeModal !== null}
          spawnBossSignal={spawnBossSignal}
          onGainXpAndCoins={handleGainXpAndCoins}
          onOpenRainbowChest={handleOpenRainbowChest}
          onPlayerPositionChange={handlePlayerPositionChange}
          onEnterTeleporter={handleEnterTeleporter}
          onNearbyTeleporterChange={setNearbyTeleporter}
          onActiveBossChange={setActiveBoss}
        />

        {/* ====================================================================
            HUD SUPERIOR IDÉNTICO A LA CAPTURA DE SURVIVOR.IO
           ==================================================================== */}
        <div className="absolute top-0 left-0 right-0 z-20 pt-2 px-2.5 pointer-events-none">
          {/* Fila 1: Botón Pausa [||] · Cronómetro 00:04 · Contadores de Monedas y Calaveras */}
          <div className="flex items-start justify-between mb-1.5">
            {/* Botón Pausa gris/metálico con dos barras verticales blancas igual a la captura */}
            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                onClick={() => setActiveModal('pause_arsenal')}
                className="w-12 h-10 rounded-lg bg-gradient-to-b from-slate-500 to-slate-700 survivor-btn flex items-center justify-center cursor-pointer"
                title="Pausa y Arsenal"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-5 bg-white border border-black rounded-[1px]" />
                  <span className="w-2 h-5 bg-white border border-black rounded-[1px]" />
                </div>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="w-9 h-9 rounded-lg bg-slate-800/90 border-2 border-black shadow-[0_3px_0_#000] flex items-center justify-center text-white cursor-pointer"
                title="Sonido"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>

            {/* Centro: Cronómetro gigante "00:04" con borde negro grueso + Mundo Actual */}
            <div className="flex flex-col items-center">
              <div className="font-survivor text-4xl sm:text-5xl text-white text-stroke-lg leading-none tracking-wider">
                {formatTimer(saveData.playTimeSeconds)}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 bg-slate-950/75 border border-black/80 px-2.5 py-0.5 rounded-full">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentWorld.accentColor }}
                />
                <span className="text-[10px] font-extrabold text-white tracking-wide uppercase">
                  M{currentWorld.number}: {currentWorld.name}
                </span>
                <span
                  className={`text-[9px] font-bold flex items-center gap-0.5 transition-opacity ${
                    autoSaveFlash ? 'text-emerald-400 opacity-100' : 'text-slate-400 opacity-75'
                  }`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Auto-Save
                </span>
              </div>
            </div>

            {/* Derecha: Pastilla de Monedas (arriba) y Pastilla de Calavera/Bajas (abajo) exactas a la foto */}
            <div className="flex flex-col gap-1 items-end pointer-events-auto">
              <button
                type="button"
                onClick={() => setActiveModal('shop')}
                className="min-w-[82px] h-6 bg-slate-950/90 border-2 border-black rounded-md px-2 flex items-center justify-between gap-2 shadow-[0_2px_0_#000] cursor-pointer"
              >
                <span className="w-4 h-4 rounded-full bg-amber-400 border border-black flex items-center justify-center text-[10px] font-black text-amber-900">
                  $
                </span>
                <span className="font-survivor text-sm text-white text-stroke-sm">
                  {saveData.gold.toLocaleString()}
                </span>
              </button>

              <div className="min-w-[82px] h-6 bg-slate-950/90 border-2 border-black rounded-md px-2 flex items-center justify-between gap-2 shadow-[0_2px_0_#000]">
                <span className="w-4 h-4 rounded-full bg-slate-100 border border-black flex items-center justify-center text-[9px] font-black text-black">
                  💀
                </span>
                <span className="font-survivor text-sm text-white text-stroke-sm">
                  {saveData.totalKills.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Fila 2: Barra de Experiencia completa de lado a lado + Etiqueta Trapezoidal "LV.1" a la izquierda */}
          <div className="relative w-full">
            <div className="w-full h-7 bg-slate-800/95 border-[3px] border-black rounded-sm overflow-hidden shadow-[0_3px_0_#000]">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-green-400 to-lime-300 transition-all duration-200"
                style={{ width: `${xpProgressPct}%` }}
              />
            </div>

            {/* Etiqueta negra "LV.1" colgando a la izquierda exactamente como en la captura */}
            <div className="inline-flex items-center bg-black text-white font-survivor text-sm px-3 py-0.5 rounded-b-md border-x-2 border-b-2 border-black shadow-md">
              LV.{saveData.level}
              <span className="ml-2 text-[10px] font-sans font-bold text-emerald-300">
                ({xpProgressPct}%)
              </span>
            </div>
          </div>

          {/* Fila 3: Mini-iconos de tus Armas Activas y Evoluciones EVO actuales */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap pointer-events-auto">
              {(Object.keys(saveData.weapons) as WeaponId[]).map((wId) => {
                const lv = saveData.weapons[wId] || 0;
                if (lv <= 0) return null;
                const def = WEAPONS_CATALOG[wId];
                const tier = formatWeaponTierLabel(lv);
                return (
                  <button
                    key={wId}
                    type="button"
                    onClick={() => setActiveModal('pause_arsenal')}
                    className={`px-1.5 py-0.5 rounded-md border-2 border-black flex items-center gap-1 text-[11px] font-extrabold shadow-[0_2px_0_#000] cursor-pointer ${
                      tier.isEvo
                        ? 'bg-gradient-to-b from-red-500 to-rose-700 text-white'
                        : 'bg-slate-800/95 text-white'
                    }`}
                  >
                    <span>{tier.isEvo ? def.evoIcon : def.icon}</span>
                    <span className="text-[10px] text-amber-300">{tier.badgeText}</span>
                  </button>
                );
              })}
            </div>

            {/* Coordenadas actuales en el Mundo Abierto */}
            <div className="bg-slate-950/80 border border-black px-2 py-0.5 rounded text-[10px] font-mono text-slate-200">
              X:{saveData.playerX} Y:{saveData.playerY}
            </div>
          </div>

          {/* Barra de Vida de Jefe si hay un Boss activo en el mundo */}
          {activeBoss && (
            <div className="mt-2 mx-auto max-w-md bg-slate-950/95 border-3 border-black rounded-xl p-2 shadow-[0_4px_0_#000]">
              <div className="flex items-center justify-between text-xs font-survivor text-red-400 mb-1">
                <span className="flex items-center gap-1">
                  <Skull className="w-4 h-4 text-red-500" />
                  JEFE DE MUNDO: {activeBoss.name}
                </span>
                <span className="text-white">
                  {Math.max(0, Math.round(activeBoss.hp)).toLocaleString()} HP
                </span>
              </div>
              <div className="w-full h-3.5 bg-slate-800 border-2 border-black rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-amber-400 transition-all duration-100"
                  style={{
                    width: `${Math.max(0, Math.min(100, (activeBoss.hp / activeBoss.maxHp) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Banner emergente al teletransportarse de mundo */}
        {warpBanner && (
          <div className="absolute top-36 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border-3 border-black px-4 py-2 rounded-2xl shadow-[0_5px_0_#000] text-center pointer-events-none animate-bounce">
            <span className="font-survivor text-base text-amber-300 text-stroke-sm">
              {warpBanner}
            </span>
          </div>
        )}

        {/* Botón emergente cuando estás sobre un Teletransportador en el mapa */}
        {nearbyTeleporter && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleTravelToWorld(nearbyTeleporter.targetWorldId)}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-b from-cyan-400 to-blue-600 text-white font-survivor text-sm tracking-wide survivor-btn text-stroke-sm flex items-center gap-2 cursor-pointer animate-pulse"
            >
              <span>🌀</span>
              <span>{nearbyTeleporter.label} (Toca o mantente dentro)</span>
            </button>
          </div>
        )}

        {/* ====================================================================
            BARRA INFERIOR DE ACCIONES RÁPIDAS MÓVILES (Portales, Arsenal, Tienda, Héroes, Jefe)
           ==================================================================== */}
        <div className="absolute bottom-6 left-2.5 right-2.5 z-20 flex items-center justify-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setActiveModal('portals')}
            className="flex-1 max-w-[105px] py-2 px-2 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 text-white font-survivor text-xs survivor-btn text-stroke-sm flex flex-col items-center justify-center cursor-pointer"
          >
            <Compass className="w-4 h-4 mb-0.5" />
            <span>Mundos (6)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('pause_arsenal')}
            className="flex-1 max-w-[105px] py-2 px-2 rounded-xl bg-gradient-to-b from-amber-400 to-orange-600 text-white font-survivor text-xs survivor-btn text-stroke-sm flex flex-col items-center justify-center cursor-pointer"
          >
            <Swords className="w-4 h-4 mb-0.5" />
            <span>Armas EVO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('shop')}
            className="flex-1 max-w-[105px] py-2 px-2 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 text-white font-survivor text-xs survivor-btn text-stroke-sm flex flex-col items-center justify-center cursor-pointer"
          >
            <Zap className="w-4 h-4 mb-0.5" />
            <span>Mejoras</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('heroes')}
            className="flex-1 max-w-[105px] py-2 px-2 rounded-xl bg-gradient-to-b from-purple-400 to-indigo-600 text-white font-survivor text-xs survivor-btn text-stroke-sm flex flex-col items-center justify-center cursor-pointer"
          >
            <Crown className="w-4 h-4 mb-0.5" />
            <span>Héroes</span>
          </button>

          <button
            type="button"
            onClick={() => setSpawnBossSignal((s) => s + 1)}
            className="flex-1 max-w-[95px] py-2 px-2 rounded-xl bg-gradient-to-b from-rose-500 to-red-700 text-white font-survivor text-xs survivor-btn text-stroke-sm flex flex-col items-center justify-center cursor-pointer"
          >
            <Skull className="w-4 h-4 mb-0.5" />
            <span>¡Jefe!</span>
          </button>
        </div>

        {/* ====================================================================
            MODAL 1: SELECCIÓN DE HABILIDAD AL SUBIR DE NIVEL (ESTILO SURVIVOR.IO)
           ==================================================================== */}
        {activeModal === 'level_up' && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-800 border-4 border-black rounded-3xl p-4 shadow-[0_8px_0_#000]">
              <div className="text-center mb-3">
                <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400 border-2 border-black text-black font-survivor text-xs uppercase">
                  Nivel {saveData.level} Alcanzado
                </span>
                <h2 className="font-survivor text-2xl sm:text-3xl text-white text-stroke-md mt-1">
                  ¡SELECCIONA HABILIDAD!
                </h2>
                <p className="text-xs text-slate-300">
                  Tus armas y mejoras se guardan permanentemente en tu personaje
                </p>
              </div>

              <div className="space-y-2.5">
                {levelUpOptions.map((opt) => (
                  <button
                    key={`${opt.kind}_${opt.id}`}
                    type="button"
                    onClick={() => handleSelectUpgradeOption(opt)}
                    className={`w-full text-left p-3 rounded-2xl border-3 border-black shadow-[0_4px_0_#000] transition active:translate-y-1 flex items-center gap-3 cursor-pointer ${
                      opt.isEvoUnlock
                        ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-500'
                        : opt.kind === 'weapon'
                        ? 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700'
                        : 'bg-gradient-to-r from-emerald-900/90 to-slate-800 hover:from-emerald-800'
                    }`}
                  >
                    <div
                      className="w-14 h-14 rounded-2xl border-3 border-black flex items-center justify-center text-3xl shrink-0 shadow-inner"
                      style={{ backgroundColor: opt.accentColor }}
                    >
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-survivor text-lg text-white text-stroke-sm truncate">
                          {opt.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-black/60 text-amber-300 font-survivor text-xs shrink-0">
                          {opt.subtitle}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 mt-0.5 line-clamp-2">
                        {opt.description}
                      </p>
                      {opt.pairLabel && (
                        <div className="mt-1 inline-flex items-center gap-1 bg-black/45 px-2 py-0.5 rounded text-[10px] font-bold text-amber-200">
                          {opt.pairLabel}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 2: COFRE DE LA SUERTE CON ARCOÍRIS (3 MEJORAS + ORO)
           ==================================================================== */}
        {activeModal === 'rainbow_chest' && chestRewards && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gradient-to-b from-amber-500 via-orange-600 to-red-700 border-4 border-black rounded-3xl p-5 shadow-[0_8px_0_#000] text-center">
              <div className="text-5xl mb-1">🌈🧰</div>
              <h2 className="font-survivor text-3xl text-white text-stroke-md">
                ¡COFRE ARCOÍRIS ABIERTO!
              </h2>
              <p className="text-xs font-bold text-amber-100 mt-0.5 mb-3">
                Has recibido +{chestRewards.bonusGold} Monedas de Oro y 3 Mejoras Directas:
              </p>

              <div className="space-y-2 text-left mb-4">
                {chestRewards.upgrades.map((up, i) => (
                  <div
                    key={i}
                    className="bg-slate-900/95 border-3 border-black rounded-2xl p-2.5 flex items-center gap-3 shadow-[0_3px_0_#000]"
                  >
                    <div
                      className="w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center text-2xl shrink-0"
                      style={{ backgroundColor: up.accentColor }}
                    >
                      {up.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-survivor text-base text-white text-stroke-sm">
                        {up.title}
                      </div>
                      <div className="text-[11px] font-bold text-amber-300">{up.subtitle}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full py-3 rounded-2xl bg-gradient-to-b from-emerald-400 to-green-600 text-white font-survivor text-xl survivor-btn text-stroke-sm cursor-pointer"
              >
                ¡GENIAL! CONTINUAR
              </button>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 3: RED DE PORTALES Y TELETRANSPORTADORES A OTROS MUNDOS
           ==================================================================== */}
        {activeModal === 'portals' && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-[88dvh] bg-slate-900 border-4 border-black rounded-3xl p-4 shadow-[0_8px_0_#000] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-survivor text-2xl text-white text-stroke-md flex items-center gap-2">
                    <span>🌀</span> TELETRANSPORTADORES
                  </h2>
                  <p className="text-xs text-slate-300">
                    Viaja a cualquier Mundo Abierto conservando todo tu nivel y armas
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-survivor text-sm survivor-btn cursor-pointer"
                >
                  X
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {WORLDS.map((w) => {
                  const isCurrent = w.id === saveData.currentWorldId;
                  return (
                    <div
                      key={w.id}
                      className={`p-3 rounded-2xl border-3 border-black shadow-[0_4px_0_#000] flex items-center justify-between gap-3 ${
                        isCurrent ? 'bg-slate-800 ring-2 ring-emerald-400' : 'bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-2xl border-2 border-black flex flex-col items-center justify-center font-survivor text-white shrink-0"
                          style={{ backgroundColor: w.bgPrimary }}
                        >
                          <span className="text-[10px] leading-none">MUNDO</span>
                          <span className="text-lg leading-none">{w.number}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-survivor text-base text-white text-stroke-sm truncate">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">{w.subtitle}</div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold">
                            <span className="px-1.5 py-0.5 rounded bg-black/50 text-emerald-300">
                              XP x{w.xpMultiplier}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-black/50 text-amber-300">
                              Oro x{w.goldMultiplier}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-black/50 text-rose-300">
                              Jefe: {w.bossName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTravelToWorld(w.id)}
                        className={`px-3.5 py-2 rounded-xl font-survivor text-xs survivor-btn text-stroke-sm shrink-0 cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gradient-to-b from-cyan-400 to-blue-600 text-white'
                        }`}
                      >
                        {isCurrent ? 'AQUÍ' : 'VIAJAR 🌀'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 4: PAUSA / ARSENAL DE ARMAS Y EVOLUCIONES EVO
           ==================================================================== */}
        {activeModal === 'pause_arsenal' && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-[88dvh] bg-slate-900 border-4 border-black rounded-3xl p-4 shadow-[0_8px_0_#000] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-survivor text-2xl text-white text-stroke-md">
                    🗡️ ARSENAL & EVOLUCIONES EVO
                  </h2>
                  <p className="text-xs text-slate-300">
                    Oro disponible: <span className="text-amber-400 font-bold">{saveData.gold.toLocaleString()}</span> · Puedes mejorar también con Oro
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white font-survivor text-sm survivor-btn cursor-pointer"
                >
                  SEGUIR ▶
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {(Object.keys(WEAPONS_CATALOG) as WeaponId[]).map((wId) => {
                  const def = WEAPONS_CATALOG[wId];
                  const lv = saveData.weapons[wId] || 0;
                  const tier = formatWeaponTierLabel(lv);
                  const passiveDef = PASSIVES_CATALOG[def.requiredPassive];
                  const hasPassive = (saveData.passives[def.requiredPassive] || 0) > 0;
                  const goldCost = Math.round(95 * Math.pow(1.45, lv));

                  return (
                    <div
                      key={wId}
                      className="p-2.5 rounded-2xl bg-slate-800 border-3 border-black shadow-[0_3px_0_#000] flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl border-2 border-black flex items-center justify-center text-2xl shrink-0"
                          style={{ backgroundColor: tier.isEvo ? def.evoColor : def.color }}
                        >
                          {tier.isEvo ? def.evoIcon : def.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-survivor text-sm text-white text-stroke-sm truncate">
                              {tier.isEvo ? def.evoName : def.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-survivor ${
                                tier.isEvo
                                  ? 'bg-red-600 text-white'
                                  : lv > 0
                                  ? 'bg-amber-400 text-black'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {tier.badgeText}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            {tier.isEvo ? def.evoDescription : def.description}
                          </div>
                          <div className="text-[10px] font-bold text-amber-300 mt-0.5">
                            Pareja EVO: {passiveDef.icon} {passiveDef.name}{' '}
                            {hasPassive ? '✓' : '(Falta)'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={saveData.gold < goldCost}
                        onClick={() => handleDirectWeaponUpgradeWithGold(wId)}
                        className={`px-2.5 py-2 rounded-xl font-survivor text-xs survivor-btn shrink-0 cursor-pointer ${
                          saveData.gold >= goldCost
                            ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-white text-stroke-sm'
                            : 'bg-slate-700 text-slate-400 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div>+1 NV</div>
                        <div className="text-[10px]">🪙 {goldCost}</div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 5: TIENDA DE MEJORAS PERMANENTES CON ORO
           ==================================================================== */}
        {activeModal === 'shop' && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-[88dvh] bg-slate-900 border-4 border-black rounded-3xl p-4 shadow-[0_8px_0_#000] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-survivor text-2xl text-white text-stroke-md">
                    ⚡ MEJORAS PERMANENTES
                  </h2>
                  <p className="text-xs text-slate-300">
                    Tus Monedas: <span className="text-amber-400 font-bold">🪙 {saveData.gold.toLocaleString()}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-survivor text-sm survivor-btn cursor-pointer"
                >
                  X
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {PERMANENT_UPGRADES.map((up) => {
                  const lv = saveData.permanentUpgrades[up.id] || 1;
                  const cost = Math.round(up.baseCost * Math.pow(up.costMultiplier, lv - 1));
                  const canAfford = saveData.gold >= cost;

                  return (
                    <div
                      key={up.id}
                      className="p-3 rounded-2xl bg-slate-800 border-3 border-black shadow-[0_3px_0_#000] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-slate-700 border-2 border-black flex items-center justify-center text-2xl shrink-0">
                          {up.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-survivor text-base text-white text-stroke-sm">
                              {up.name}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-bold">
                              NV.{lv}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300">{up.description}</p>
                          <span className="text-[10px] font-bold text-amber-300">
                            {up.bonusPerLevelLabel}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => handleBuyPermanentUpgrade(up.id)}
                        className={`px-3.5 py-2 rounded-xl font-survivor text-xs survivor-btn shrink-0 cursor-pointer ${
                          canAfford
                            ? 'bg-gradient-to-b from-emerald-400 to-green-600 text-white text-stroke-sm'
                            : 'bg-slate-700 text-slate-400 opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <div>MEJORAR</div>
                        <div className="text-[10px]">🪙 {cost}</div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            MODAL 6: SELECCIÓN DE HÉROES
           ==================================================================== */}
        {activeModal === 'heroes' && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-[88dvh] bg-slate-900 border-4 border-black rounded-3xl p-4 shadow-[0_8px_0_#000] flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-survivor text-2xl text-white text-stroke-md">
                    🦸 HÉROES SUPERVIVIENTES
                  </h2>
                  <p className="text-xs text-slate-300">
                    Monedas: <span className="text-amber-400 font-bold">🪙 {saveData.gold.toLocaleString()}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-survivor text-sm survivor-btn cursor-pointer"
                >
                  X
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {HEROES_CATALOG.map((hero) => {
                  const isUnlocked = saveData.unlockedHeroes.includes(hero.id);
                  const isSelected = saveData.selectedHeroId === hero.id;
                  const canAfford = saveData.gold >= hero.unlockCost;

                  return (
                    <div
                      key={hero.id}
                      className={`p-3 rounded-2xl border-3 border-black shadow-[0_4px_0_#000] flex items-center justify-between gap-3 ${
                        isSelected ? 'bg-slate-800 ring-2 ring-amber-400' : 'bg-slate-800/85'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-2xl border-2 border-black flex items-center justify-center font-survivor text-xl shrink-0"
                          style={{ backgroundColor: hero.scarfColor }}
                        >
                          🥷
                        </div>
                        <div className="min-w-0">
                          <div className="font-survivor text-base text-white text-stroke-sm truncate">
                            {hero.name}
                          </div>
                          <div className="text-[11px] text-amber-300 font-bold">{hero.title}</div>
                          <div className="text-[10px] text-slate-300 mt-0.5">{hero.bonusText}</div>
                        </div>
                      </div>

                      {isUnlocked ? (
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playLevelUp();
                            setSaveData((prev) => ({
                              ...prev,
                              selectedHeroId: hero.id,
                              weapons: {
                                ...prev.weapons,
                                [hero.starterWeapon]: Math.max(1, prev.weapons[hero.starterWeapon] || 0),
                              },
                            }));
                          }}
                          className={`px-3.5 py-2 rounded-xl font-survivor text-xs survivor-btn shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500 text-white text-stroke-sm'
                              : 'bg-sky-500 text-white text-stroke-sm'
                          }`}
                        >
                          {isSelected ? 'EQUIPADO' : 'ELEGIR'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            if (!canAfford) return;
                            soundEngine.playLevelUp();
                            setSaveData((prev) => ({
                              ...prev,
                              gold: prev.gold - hero.unlockCost,
                              selectedHeroId: hero.id,
                              unlockedHeroes: [...prev.unlockedHeroes, hero.id],
                              weapons: {
                                ...prev.weapons,
                                [hero.starterWeapon]: Math.max(1, prev.weapons[hero.starterWeapon] || 0),
                              },
                            }));
                          }}
                          className={`px-3.5 py-2 rounded-xl font-survivor text-xs survivor-btn shrink-0 cursor-pointer ${
                            canAfford
                              ? 'bg-gradient-to-b from-amber-400 to-orange-600 text-white text-stroke-sm'
                              : 'bg-slate-700 text-slate-400 opacity-60 cursor-not-allowed'
                          }`}
                        >
                          <div>DESBLOQUEAR</div>
                          <div className="text-[10px]">🪙 {hero.unlockCost}</div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Indicador de actualización obligatorio en esquina (Regla Global) */}
      <div className="fixed bottom-1 right-2 z-50 text-[9px] text-slate-300/85 font-mono bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800 pointer-events-none">
        Actualizado: {buildTimestamp}
      </div>
    </div>
  );
}
