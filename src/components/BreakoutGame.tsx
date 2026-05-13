import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Ball, Paddle, Brick, GameStatus, Particle, BrickType, LevelConfig } from '../types';
import { Trophy, Heart, Play, RefreshCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 120;
const PADDLE_HEIGHT = 15;
const BALL_RADIUS = 8;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 60;
const BRICK_OFFSET_LEFT = 35;
const BRICK_HEIGHT = 25;
const BRICK_WIDTH = 85;

const LEVELS: LevelConfig[] = [
  {
      id: 1,
      ballSpeed: 4,
      brickMap: [
          [-1,-1,-1,-1,-1,-1,-1,-1],
          [0,0,0,0,0,0,0,0],
          [0,1,1,1,1,1,1,0],
          [0,1,0,0,0,0,1,0],
          [0,1,1,1,1,1,1,0],
          [-1,-1,-1,-1,-1,-1,-1,-1],
      ]
  },
  {
      id: 2,
      ballSpeed: 5,
      brickMap: [
          [2,0,3,0,4,0,5,0],
          [0,1,1,1,1,1,1,0],
          [0,3,4,5,3,4,5,0],
          [1,1,1,1,1,1,1,1],
          [2,2,2,2,2,2,2,2],
      ]
  },
  {
      id: 3,
      ballSpeed: 6,
      brickMap: [
          [5,5,5,5,5,5,5,5],
          [0,4,4,4,4,4,4,0],
          [3,3,3,3,3,3,3,3],
          [0,2,2,2,2,2,2,0],
          [1,1,1,1,1,1,1,1],
          [0,5,4,3,2,1,0,0],
      ]
  }
];

const BRICK_TYPE_COLORS: Record<BrickType, string> = {
    [BrickType.NORMAL]: '#00F2FF',
    [BrickType.STRONG]: '#FF007A',
    [BrickType.BONUS]: '#FFCC00',
    [BrickType.SPEEDUP]: '#FF3B30',
    [BrickType.EXPAND]: '#4CD964',
    [BrickType.MULTIBALL]: '#5AC8FA',
};

export default function BreakoutGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [levelIndex, setLevelIndex] = useState(0);

  const currentLevel = useMemo(() => LEVELS[levelIndex], [levelIndex]);

  // Audio Context
  const audioCtx = useRef<AudioContext | null>(null);

  const playSound = (type: 'hit' | 'break' | 'lose') => {
      if (!audioCtx.current) return;
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.current.destination);

      if (type === 'hit') {
          osc.frequency.setValueAtTime(440, audioCtx.current.currentTime);
          gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.1);
          osc.start();
          osc.stop(audioCtx.current.currentTime + 0.1);
      } else if (type === 'break') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, audioCtx.current.currentTime);
          osc.frequency.exponentialRampToValueAtTime(440, audioCtx.current.currentTime + 0.2);
          gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.2);
          osc.start();
          osc.stop(audioCtx.current.currentTime + 0.2);
      } else if (type === 'lose') {
          osc.frequency.setValueAtTime(220, audioCtx.current.currentTime);
          osc.frequency.exponentialRampToValueAtTime(110, audioCtx.current.currentTime + 0.5);
          gain.gain.setValueAtTime(0.2, audioCtx.current.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.current.currentTime + 0.5);
          osc.start();
          osc.stop(audioCtx.current.currentTime + 0.5);
      }
  };

  // Game state refs
  const ballRef = useRef<Ball>({
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50 },
    vel: { dx: currentLevel.ballSpeed, dy: -currentLevel.ballSpeed },
    radius: BALL_RADIUS,
  });
  
  const paddleRef = useRef<Paddle>({
    x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    color: '#007AFF',
  });
  const targetPaddleX = useRef(paddleRef.current.x);

  const bricksRef = useRef<Brick[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const ballTrailRef = useRef<{x:number, y:number}[]>([]);
  const animationFrameRef = useRef<number>(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  const statusRef = useRef<GameStatus>(status);
  const livesRef = useRef<number>(lives);
  const scoreRef = useRef<number>(score);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const initBricks = useCallback((level: LevelConfig) => {
    const newBricks: Brick[] = [];
    level.brickMap.forEach((row, r) => {
      row.forEach((type, c) => {
        if (type !== -1) {
            newBricks.push({
                x: c * (BRICK_WIDTH + BRICK_PADDING) + BRICK_OFFSET_LEFT,
                y: r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP,
                width: BRICK_WIDTH,
                height: BRICK_HEIGHT,
                status: type === BrickType.STRONG ? 2 : 1,
                type: type as BrickType,
                color: BRICK_TYPE_COLORS[type as BrickType],
            });
        }
      });
    });
    bricksRef.current = newBricks;
  }, []);

  const resetBall = useCallback(() => {
    ballRef.current = {
      pos: { x: (CANVAS_WIDTH / 2), y: CANVAS_HEIGHT - 50 },
      vel: { dx: currentLevel.ballSpeed, dy: -currentLevel.ballSpeed },
      radius: BALL_RADIUS,
    };
  }, [currentLevel]);

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
        particlesRef.current.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1.0,
            color,
            size: Math.random() * 4 + 2
        });
    }
  };

  const update = useCallback(() => {
    if (statusRef.current !== GameStatus.PLAYING) return;

    // Paddle lerp movement
    const paddleSpeed = 0.2;
    paddleRef.current.x += (targetPaddleX.current - paddleRef.current.x) * paddleSpeed;

    const ball = ballRef.current;
    
    // Wall collisions
    if (ball.pos.x + ball.vel.dx > CANVAS_WIDTH - ball.radius || ball.pos.x + ball.vel.dx < ball.radius) {
      ball.vel.dx = -ball.vel.dx;
      playSound('hit');
    }
    if (ball.pos.y + ball.vel.dy < ball.radius) {
      ball.vel.dy = -ball.vel.dy;
      playSound('hit');
    } else if (ball.pos.y + ball.vel.dy > CANVAS_HEIGHT - ball.radius - 10) {
      // Paddle collision
      if (
        ball.pos.y < CANVAS_HEIGHT - 10 &&
        ball.pos.x > paddleRef.current.x - ball.radius && 
        ball.pos.x < paddleRef.current.x + paddleRef.current.width + ball.radius
      ) {
        const hitPos = (ball.pos.x - (paddleRef.current.x + paddleRef.current.width / 2)) / (paddleRef.current.width / 2);
        ball.vel.dx = hitPos * 8; 
        ball.vel.dy = -Math.abs(ball.vel.dy);
        ball.pos.y = CANVAS_HEIGHT - paddleRef.current.height - 15;
        playSound('hit');
      } else if (ball.pos.y + ball.vel.dy > CANVAS_HEIGHT - ball.radius) {
        // Lose life
        playSound('lose');
        if (livesRef.current <= 1) {
            setStatus(GameStatus.GAMEOVER);
            statusRef.current = GameStatus.GAMEOVER;
        } else {
            setLives(l => l - 1);
            livesRef.current -= 1;
            resetBall();
        }
      }
    }

    // Brick collisions
    bricksRef.current.forEach((brick) => {
      if (brick.status >= 1) {
        if (
          ball.pos.x > brick.x &&
          ball.pos.x < brick.x + brick.width &&
          ball.pos.y > brick.y &&
          ball.pos.y < brick.y + brick.height
        ) {
          ball.vel.dy = -ball.vel.dy;
          brick.status -= 1;
          
          if (brick.status === 0) {
              setScore(s => s + 10);
              scoreRef.current += 10;
              createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color);
              playSound('break');
          } else {
              playSound('hit');
          }
        }
      }
    });

    // Move ball
    ball.pos.x += ball.vel.dx;
    ball.pos.y += ball.vel.dy;
    
    // Add trail
    ballTrailRef.current.push({x: ball.pos.x, y: ball.pos.y});
    if (ballTrailRef.current.length > 5) ballTrailRef.current.shift();

    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        return p.life > 0;
    });

    // Win condition check
    if (bricksRef.current.length > 0 && bricksRef.current.every(b => b.status === 0)) {
        if (levelIndex < LEVELS.length - 1) {
            setLevelIndex(i => i + 1);
            initBricks(LEVELS[levelIndex + 1]);
            resetBall();
        } else {
            setStatus(GameStatus.WON);
            statusRef.current = GameStatus.WON;
        }
    }
  }, [resetBall, levelIndex, initBricks]);


  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Trail
    ballTrailRef.current.forEach((t, i) => {
        ctx.fillStyle = `rgba(255, 255, 255, ${i / ballTrailRef.current.length})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL_RADIUS * (i / ballTrailRef.current.length), 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Paddle
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00F2FF';
    ctx.fillStyle = '#00F2FF';
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(paddleRef.current.x, CANVAS_HEIGHT - paddleRef.current.height - 10, paddleRef.current.width, paddleRef.current.height, 5);
    } else {
        ctx.rect(paddleRef.current.x, CANVAS_HEIGHT - paddleRef.current.height - 10, paddleRef.current.width, paddleRef.current.height);
    }
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Ball
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FFFFFF';
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(ballRef.current.pos.x, ballRef.current.pos.y, ballRef.current.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Bricks
    bricksRef.current.forEach((brick) => {
      if (brick.status >= 1) {
        // Gradient fill
        const grad = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
        grad.addColorStop(0, brick.color);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(brick.x, brick.y, brick.width, brick.height, 4);
        } else {
            ctx.rect(brick.x, brick.y, brick.width, brick.height);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();
      }
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;
  }, []);

  useEffect(() => {
    if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    const gameLoop = (time: number) => {
      if (ctx) {
        update();
        draw(ctx);
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [update, draw]);

  useEffect(() => {
    initBricks(LEVELS[levelIndex]);
    
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const relativeX = (e.clientX - rect.left) * scaleX;
        if (relativeX > 0 && relativeX < CANVAS_WIDTH) {
            targetPaddleX.current = relativeX - paddleRef.current.width / 2;
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [initBricks, levelIndex]);
  const startGame = () => {
    setLevelIndex(0);
    initBricks(LEVELS[0]);
    resetBall();
    setScore(0);
    setLives(3);
    setStatus(GameStatus.PLAYING);
    if(audioCtx.current?.state === 'suspended') audioCtx.current.resume();
  };

  const restartGame = () => {
    startGame();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-bg)]">
      <header className="w-full h-20 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between px-12 mb-8">
         <div className="flex items-center gap-4">
             <div className="w-3 h-3 bg-[var(--color-accent)] rounded-full shadow-[0_0_10px_var(--color-accent)]"></div>
             <h1 className="text-2xl font-black tracking-tighter text-[var(--color-accent)] italic">NEON BREAKER</h1>
         </div>
      </header>

      <div className="w-full max-w-4xl space-y-6">
        {/* HUD */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-[var(--color-surface)] p-4 rounded border border-[var(--color-border)] flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">分數</span>
            <span className="hud-value text-white">{score.toString().padStart(6, '0')}</span>
          </div>
          <div className="bg-[var(--color-surface)] p-4 rounded border border-[var(--color-border)] flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">生命</span>
            <div className="flex gap-2 mt-1">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className={`w-4 h-2 ${i < lives ? 'bg-[var(--color-accent)]' : 'bg-[#333]'} rounded-sm`}></div>
                ))}
            </div>
          </div>
          <div className="bg-[var(--color-surface)] p-4 rounded border border-[var(--color-border)] flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest text-[#666]">關卡</span>
            <span className="hud-value text-[var(--color-accent)]">{levelIndex + 1}</span>
          </div>
        </div>

        {/* Game Area */}
        <div className="game-container aspect-[800/600] w-full relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
              <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(#1a1a2e 1px, transparent 1px), linear-gradient(90deg, #1a1a2e 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          </div>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full cursor-none relative z-10"
          />

          {/* Overlays */}
          <AnimatePresence>
            {status !== GameStatus.PLAYING && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
              >
                <div className="text-center space-y-6">
                    {status === GameStatus.START && (
                        <>
                            <h1 className="text-6xl font-black italic tracking-tighter text-[var(--color-accent)]">霓虹打磚塊</h1>
                            <p className="text-[#666] font-medium uppercase tracking-widest">擊碎所有磚塊以獲勝</p>
                            <button
                                onClick={startGame}
                                className="px-8 py-3 bg-[var(--color-accent)] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                            >
                                啟動系統
                            </button>
                        </>
                    )}

                    {status === GameStatus.GAMEOVER && (
                        <>
                            <h1 className="text-6xl font-black tracking-tighter text-[var(--color-secondary)]">遊戲結束</h1>
                            <p className="text-xl font-medium">最終分數: <span className="text-[var(--color-accent)] font-bold">{score}</span></p>
                            <button
                                onClick={restartGame}
                                className="px-8 py-3 bg-[var(--color-accent)] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                            >
                                重新啟動
                            </button>
                        </>
                    )}

                    {status === GameStatus.WON && (
                        <>
                            <Trophy size={80} className="mx-auto text-[var(--color-accent)] animate-bounce" />
                            <h1 className="text-6xl font-black tracking-tighter text-[var(--color-accent)]">勝利</h1>
                            <p className="text-xl font-medium">分數: <span className="text-white font-bold">{score}</span></p>
                            <button
                                onClick={restartGame}
                                className="px-8 py-3 bg-[var(--color-accent)] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors"
                            >
                                再玩一次
                            </button>
                        </>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
