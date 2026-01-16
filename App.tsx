import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { THEMES, CANVAS_SIZE, DEFAULT_GRID_SIZE, PLAYER_SPEED, COLLISION_MARGIN } from './constants';
import { GameState, Vector2, ColorTheme } from './types';
import { isCoprime, getRemappedPosition } from './services/mathUtils';
import { Joystick } from './components/Joystick';

const App: React.FC = () => {
  const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
  const [theme, setTheme] = useState<ColorTheme>(THEMES.modern);
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    inverted: false,
    cheatMode: false,
    gameFinished: false,
    gridSize: DEFAULT_GRID_SIZE,
    playerPos: { x: 0, y: 0 },
    eatenCount: 0,
    totalToEat: 0,
    startTime: null,
    elapsedTime: 0
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [touchDir, setTouchDir] = useState<Vector2 | null>(null);
  const eatenCells = useRef<Set<string>>(new Set());
  const requestRef = useRef<number>();
  
  const cellSize = useMemo(() => CANVAS_SIZE / gridSize, [gridSize]);
  const playerRef = useRef<Vector2>({ x: 0, y: CANVAS_SIZE - cellSize });

  // Pre-calculate total eatable points for the current mathematical state (Inverted vs Normal)
  const calculateTotalToEat = useCallback((size: number, inverted: boolean) => {
    let count = 0;
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const coprime = isCoprime(x, y);
        const isTarget = inverted ? !coprime : coprime;
        // Origin is usually not eatable in normal mode
        if (x === 0 && y === 0 && !inverted) continue;
        if (isTarget) count++;
      }
    }
    return count;
  }, []);

  const resetGame = useCallback((newSize: number, isInverted: boolean) => {
    eatenCells.current.clear();
    const cellWidth = CANVAS_SIZE / newSize;
    playerRef.current = { x: 0, y: CANVAS_SIZE - cellWidth };
    const total = calculateTotalToEat(newSize, isInverted);
    
    setGameState(prev => ({
      ...prev,
      score: 0,
      eatenCount: 0,
      gameFinished: false,
      gridSize: newSize,
      inverted: isInverted,
      totalToEat: total,
      startTime: null,
      elapsedTime: 0,
      cheatMode: prev.cheatMode // Persist cheat mode preference
    }));
  }, [calculateTotalToEat]);

  useEffect(() => {
    resetGame(DEFAULT_GRID_SIZE, false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: true }));
    const handleKeyUp = (e: KeyboardEvent) => setKeys(prev => ({ ...prev, [e.key.toLowerCase()]: false }));
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const isCellBlocked = useCallback((gx: number, gy: number, inverted: boolean) => {
    if (gameState.cheatMode) return false;
    if (gx < 0 || gx >= gridSize || gy < 0 || gy >= gridSize) return true;
    
    const coprime = isCoprime(gx, gy);
    if (gx === 0 && gy === 0 && !inverted) return false;
    if (inverted) return coprime && !(gx === 0 && gy === 0);
    return !coprime;
  }, [gridSize, gameState.cheatMode]);

  const update = useCallback(() => {
    if (gameState.gameFinished) return;

    let dx = 0;
    let dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= PLAYER_SPEED;
    if (keys['s'] || keys['arrowdown']) dy += PLAYER_SPEED;
    if (keys['a'] || keys['arrowleft']) dx -= PLAYER_SPEED;
    if (keys['d'] || keys['arrowright']) dx += PLAYER_SPEED;

    if (touchDir) {
      dx = touchDir.x * PLAYER_SPEED;
      dy = touchDir.y * PLAYER_SPEED;
    }

    // Start timer on first movement
    if ((dx !== 0 || dy !== 0) && !gameState.startTime) {
      setGameState(prev => ({ ...prev, startTime: Date.now() }));
    }

    if (dx !== 0 && dy !== 0) {
      const mag = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / mag) * PLAYER_SPEED;
      dy = (dy / mag) * PLAYER_SPEED;
    }

    const currentPos = { ...playerRef.current };
    
    // --- COLLISION LOGIC ---
    if (gameState.cheatMode) {
      // Free movement in Warp Mode
      let nextX = currentPos.x + dx;
      let nextY = currentPos.y + dy;
      playerRef.current = {
        x: Math.max(0, Math.min(CANVAS_SIZE - cellSize, nextX)),
        y: Math.max(0, Math.min(CANVAS_SIZE - cellSize, nextY))
      };
    } else {
      // Sliding Axis-Aligned Collision for Normal Mode
      const nextX = currentPos.x + dx;
      const nextY = currentPos.y + dy;
      const margin = cellSize * COLLISION_MARGIN;

      let finalX = currentPos.x;
      if (dx !== 0) {
        const testX = dx > 0 ? nextX + cellSize - 0.01 : nextX;
        const gx = Math.floor(testX / cellSize);
        const gyStart = Math.floor((currentPos.y + margin) / cellSize);
        const gyEnd = Math.floor((currentPos.y + cellSize - margin - 0.01) / cellSize);
        
        let collision = false;
        for (let gy = gyStart; gy <= gyEnd; gy++) {
          if (isCellBlocked(gx, gridSize - 1 - gy, gameState.inverted)) {
            collision = true;
            break;
          }
        }
        if (!collision && nextX >= 0 && nextX <= CANVAS_SIZE - cellSize) finalX = nextX;
        else if (collision) finalX = dx > 0 ? (gx * cellSize) - cellSize : (gx + 1) * cellSize;
      }

      let finalY = currentPos.y;
      if (dy !== 0) {
        const testY = dy > 0 ? nextY + cellSize - 0.01 : nextY;
        const gy = Math.floor(testY / cellSize);
        
        // Fix: Removed redundant loop with undefined variable 'gxRight' and fixed sliding Y logic
        let collisionY = false;
        const gxStart = Math.floor((finalX + margin) / cellSize);
        const gxEnd = Math.floor((finalX + cellSize - margin - 0.01) / cellSize);
        for (let gx = gxStart; gx <= gxEnd; gx++) {
          if (isCellBlocked(gx, gridSize - 1 - gy, gameState.inverted)) {
            collisionY = true;
            break;
          }
        }
        if (!collisionY && nextY >= 0 && nextY <= CANVAS_SIZE - cellSize) finalY = nextY;
        else if (collisionY) finalY = dy > 0 ? (gy * cellSize) - cellSize : (gy + 1) * cellSize;
      }
      playerRef.current = { x: finalX, y: finalY };
    }

    // --- EATING LOGIC ---
    let pointsAdded = 0;

    if (gameState.cheatMode) {
      // Warp Mode: Check overlap between player rect and remapped target rects
      const playerRect = { x: playerRef.current.x, y: playerRef.current.y, w: cellSize, h: cellSize };
      
      // Optimization: Only check points near current coordinates if gridSize is huge
      // But for 200x200, a simple loop is often acceptable or we check specifically target coordinates
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          const key = `${x},${y}`;
          if (eatenCells.current.has(key)) continue;

          const coprime = isCoprime(x, y);
          const isTarget = gameState.inverted ? !coprime : coprime;
          if (x === 0 && y === 0 && !gameState.inverted) continue;

          if (isTarget) {
            const remapped = getRemappedPosition(x, y, gridSize);
            const rX = remapped.x * cellSize;
            const rY = CANVAS_SIZE - (remapped.y + 1) * cellSize;
            
            // Intersection check
            if (playerRect.x < rX + cellSize &&
                playerRect.x + playerRect.w > rX &&
                playerRect.y < rY + cellSize &&
                playerRect.y + playerRect.h > rY) {
              eatenCells.current.add(key);
              pointsAdded++;
            }
          }
        }
      }
    } else {
      // Normal Mode: Grid-cell based eating
      const gx = Math.floor((playerRef.current.x + cellSize / 2) / cellSize);
      const gy = gridSize - 1 - Math.floor((playerRef.current.y + cellSize / 2) / cellSize);
      const key = `${gx},${gy}`;

      if (!eatenCells.current.has(key)) {
        const coprime = isCoprime(gx, gy);
        let eatable = gameState.inverted ? !coprime : coprime;
        if (gx === 0 && gy === 0 && !gameState.inverted) eatable = false;

        if (eatable) {
          eatenCells.current.add(key);
          pointsAdded++;
        }
      }
    }

    // Update state based on additions
    if (pointsAdded > 0 || (gameState.startTime && !gameState.gameFinished)) {
      setGameState(prev => {
        const newEatenCount = eatenCells.current.size;
        const isFinished = newEatenCount >= prev.totalToEat;
        const now = Date.now();
        const newElapsed = prev.startTime ? (isFinished ? prev.elapsedTime : now - prev.startTime) : 0;
        
        return {
          ...prev,
          score: prev.score + (prev.inverted ? -pointsAdded : pointsAdded),
          eatenCount: newEatenCount,
          gameFinished: isFinished,
          elapsedTime: isFinished ? prev.elapsedTime : (prev.startTime ? now - prev.startTime : 0)
        };
      });
    }
  }, [gameState.inverted, gameState.cheatMode, gameState.gameFinished, gameState.startTime, gridSize, cellSize, isCellBlocked, keys, touchDir]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${centis.toString().padStart(2, '0')}`;
  };

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Grid Drawing
    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        const key = `${x},${y}`;
        const coprime = isCoprime(x, y);
        let drawX, drawY;
        let isTarget = false;

        if (gameState.cheatMode) {
          const remapped = getRemappedPosition(x, y, gridSize);
          drawX = remapped.x * cellSize;
          drawY = CANVAS_SIZE - (remapped.y + 1) * cellSize;
          isTarget = coprime;
        } else {
          drawX = x * cellSize;
          drawY = CANVAS_SIZE - (y + 1) * cellSize;
          isTarget = gameState.inverted ? !coprime : coprime;
          if (x === 0 && y === 0) isTarget = gameState.inverted;
        }

        if (eatenCells.current.has(key)) {
          ctx.fillStyle = theme.eaten;
        } else if (isTarget) {
          ctx.fillStyle = theme.eatable;
        } else {
          ctx.fillStyle = theme.nonEatable;
        }
        ctx.fillRect(drawX, drawY, cellSize, cellSize);
      }
    }

    // Player Drawing
    ctx.fillStyle = theme.player;
    ctx.shadowBlur = 15;
    ctx.shadowColor = theme.player;
    ctx.fillRect(playerRef.current.x, playerRef.current.y, cellSize, cellSize);
    ctx.shadowBlur = 0;

    // Scanline CRT Effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < CANVAS_SIZE; i += 4) {
      ctx.fillRect(0, i, CANVAS_SIZE, 1);
    }
  }, [gridSize, cellSize, theme, gameState.inverted, gameState.cheatMode]);

  useEffect(() => {
    const render = () => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(render);
    };
    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [update, draw]);

  const progress = Math.min(100, (gameState.eatenCount / (gameState.totalToEat || 1)) * 100);

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-slate-950 p-4 md:p-8 gap-8 items-center justify-center overflow-hidden">
      
      {/* HUD & CONTROLS */}
      <div className="w-full md:w-80 flex flex-col gap-6 z-10">
        <header className="space-y-1">
          <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-br from-white to-slate-500 tracking-tighter uppercase italic leading-none">
            POPCORN
          </h1>
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-slate-800"></span>
            <p className="text-sky-500 text-[10px] font-bold tracking-[0.2em] uppercase">Coprime Architect</p>
            <span className="h-px flex-1 bg-slate-800"></span>
          </div>
        </header>

        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2">
             <div className={`w-2 h-2 rounded-full ${gameState.startTime && !gameState.gameFinished ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}></div>
          </div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-slate-500 uppercase text-[10px] font-black tracking-widest">Score</span>
            <span className="mono text-4xl font-bold text-white tracking-tighter">{gameState.score}</span>
          </div>
          <div className="flex justify-between items-baseline mb-4">
            <span className="text-slate-500 uppercase text-[10px] font-black tracking-widest">Time</span>
            <span className="mono text-xl font-bold text-sky-400 tracking-tight">{formatTime(gameState.elapsedTime)}</span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Progress</span>
            <span className="text-[10px] text-sky-500 font-bold">{Math.floor(progress)}%</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-slate-500 uppercase text-[10px] font-black tracking-widest px-1">Dimensional Toggles</label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => resetGame(gridSize, !gameState.inverted)}
                className={`py-3 px-4 rounded-2xl font-bold text-xs transition-all border ${
                  gameState.inverted 
                  ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]' 
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                {gameState.inverted ? 'NON-COPRIME' : 'COPRIME'}
              </button>
              <button 
                onClick={() => setGameState(p => ({ ...p, cheatMode: !p.cheatMode }))}
                className={`py-3 px-4 rounded-2xl font-bold text-xs transition-all border ${
                  gameState.cheatMode 
                  ? 'bg-rose-500/10 border-rose-500/50 text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.15)]' 
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                WARP GRID
              </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between px-1 mb-2">
              <label className="text-slate-500 uppercase text-[10px] font-black tracking-widest">Resolution</label>
              <span className="mono text-[10px] text-sky-500 font-bold">{gridSize}×{gridSize}</span>
            </div>
            <div className="bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <input 
                type="range" 
                min="10" 
                max="200" 
                step="10"
                value={gridSize}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setGridSize(val);
                  resetGame(val, gameState.inverted);
                }}
                className="w-full accent-sky-500 h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-500 uppercase text-[10px] font-black tracking-widest px-1">Visual Matrix</label>
            <select 
              className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-xs font-bold text-slate-300 outline-none focus:ring-2 focus:ring-sky-500/20 mt-2 appearance-none cursor-pointer"
              value={Object.keys(THEMES).find(key => THEMES[key].name === theme.name)}
              onChange={(e) => setTheme(THEMES[e.target.value])}
            >
              {Object.keys(THEMES).map(k => (
                <option key={k} value={k}>{THEMES[k].name.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          onClick={() => resetGame(gridSize, gameState.inverted)}
          className="w-full py-5 bg-gradient-to-br from-white to-slate-200 text-slate-950 rounded-3xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-sky-500/5"
        >
          Initialize Matrix
        </button>
      </div>

      {/* GAME CANVAS */}
      <div className="relative group p-1 bg-gradient-to-br from-slate-700/50 to-slate-900/50 rounded-[2.5rem] shadow-2xl border border-white/5">
        <div className="absolute -inset-4 bg-sky-500/10 blur-3xl opacity-20 pointer-events-none group-hover:opacity-40 transition-opacity"></div>
        <canvas 
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-[2.4rem] w-full max-w-[85vh] aspect-square shadow-2xl shadow-black/50 cursor-none"
        />
        
        {/* Victory Screen */}
        {gameState.gameFinished && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl rounded-[2.4rem] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500 z-50">
            <div className="mb-6">
              <div className="w-20 h-20 bg-sky-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-sky-500/50">
                <div className="w-10 h-10 bg-sky-500 rounded-full animate-pulse shadow-[0_0_20px_rgba(14,165,233,0.5)]"></div>
              </div>
              <h2 className="text-5xl font-black text-white italic tracking-tighter mb-2">MISSION COMPLETE</h2>
              <p className="text-sky-400 font-bold uppercase tracking-[0.3em] text-[10px]">Matrix Fully Reconstructed</p>
            </div>
            
            <div className="grid grid-cols-2 gap-12 mb-12">
               <div>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Final Time</p>
                 <p className="mono text-3xl font-bold text-white tracking-tighter">{formatTime(gameState.elapsedTime)}</p>
               </div>
               <div>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Score Delta</p>
                 <p className="mono text-3xl font-bold text-white tracking-tighter">{gameState.score}</p>
               </div>
            </div>

            <button 
              onClick={() => resetGame(gridSize, gameState.inverted)}
              className="px-12 py-5 bg-white text-slate-950 rounded-full font-black text-xs uppercase tracking-[0.2em] hover:bg-sky-400 hover:text-white transition-all shadow-xl shadow-white/5"
            >
              Sequence Restart
            </button>
          </div>
        )}

        <div className="absolute bottom-8 right-8 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-4 shadow-xl">
             <div className="relative">
                <div className={`w-2.5 h-2.5 rounded-full ${gameState.gameFinished ? 'bg-rose-500' : 'bg-sky-500'}`}></div>
                {!gameState.gameFinished && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping opacity-75"></div>}
             </div>
             <span className="mono text-[10px] text-white/90 font-bold uppercase tracking-widest">
               X:{Math.floor(playerRef.current.x / cellSize)} Y:{gridSize - 1 - Math.floor(playerRef.current.y / cellSize)}
             </span>
          </div>
        </div>
      </div>

      <Joystick onMove={setTouchDir} />
    </div>
  );
};

export default App;