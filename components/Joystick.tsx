
import React from 'react';

interface JoystickProps {
  onMove: (dir: { x: number; y: number } | null) => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onMove }) => {
  const handleStart = (dir: { x: number; y: number }) => {
    onMove(dir);
  };

  const handleEnd = () => {
    onMove(null);
  };

  const btnClass = "w-16 h-16 bg-slate-800/60 border-2 border-slate-600/50 rounded-full flex items-center justify-center text-2xl active:bg-sky-500/50 active:border-sky-400 transition-all touch-none select-none";

  return (
    <div className="flex flex-col items-center gap-2 p-4 md:hidden fixed bottom-8 right-8 z-50">
      <div className="flex flex-col items-center">
        <button 
          className={btnClass}
          onPointerDown={() => handleStart({ x: 0, y: -1 })}
          onPointerUp={handleEnd}
          onPointerLeave={handleEnd}
        >↑</button>
        <div className="flex gap-4 my-2">
          <button 
            className={btnClass}
            onPointerDown={() => handleStart({ x: -1, y: 0 })}
            onPointerUp={handleEnd}
            onPointerLeave={handleEnd}
          >←</button>
          <button 
            className={btnClass}
            onPointerDown={() => handleStart({ x: 1, y: 0 })}
            onPointerUp={handleEnd}
            onPointerLeave={handleEnd}
          >→</button>
        </div>
        <button 
          className={btnClass}
          onPointerDown={() => handleStart({ x: 0, y: 1 })}
          onPointerUp={handleEnd}
          onPointerLeave={handleEnd}
        >↓</button>
      </div>
    </div>
  );
};
