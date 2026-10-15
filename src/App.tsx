import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  DIVISIBILITY_RULES,
  generateWaveQuestion,
  WaveQuestion,
  RULE_KEYS,
} from "./data/rules";
import { sound } from "./utils/sound";
import { RulesModal } from "./components/RulesModal";
import { getSingleFileHtml } from "./utils/singleHtmlTemplate";
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  BookOpen,
  Download,
  Copy,
  Check,
  Zap,
  Gauge,
  Trophy,
  Heart,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  decay: number;
}

interface FloatingText {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;
}

export type SpeedLevel = "slow" | "normal" | "fast";

export const SPEED_PRESETS: Record<
  SpeedLevel,
  { baseSpeed: number; label: string; icon: string; desc: string }
> = {
  slow: { baseSpeed: 2.0, label: "Rahat Hız", icon: "🐢", desc: "~7 sn düşünme süresi (Önerilen)" },
  normal: { baseSpeed: 2.7, label: "Dengeli Hız", icon: "🚗", desc: "~5 sn düşünme süresi" },
  fast: { baseSpeed: 3.5, label: "Hızlı Mod", icon: "⚡", desc: "~3.8 sn düşünme süresi" },
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game UI States
  const [gameState, setGameState] = useState<"start" | "playing" | "paused" | "gameover">("start");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem("bolunebilme_highscore") || "0", 10);
  });
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [isHardMode, setIsHardMode] = useState(false);
  const [speedLevel, setSpeedLevel] = useState<SpeedLevel>("slow");
  const [isMuted, setIsMuted] = useState(() => sound.getMuted());
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active question info for HUD
  const [currentRuleInfo, setCurrentRuleInfo] = useState({
    title: "2 ile Bölünebilme",
    question: "2 ile KALANSIZ BÖLÜNEN sayıya çarp!",
    tip: "Son rakamı çift (0, 2, 4, 6, 8) olmalı!",
    divisor: 2,
  });

  // Recent mistake explanation for learning
  const [lastFeedback, setLastFeedback] = useState<{
    text: string;
    subtext?: string;
    isCorrect: boolean;
  } | null>(null);

  const [mistakesList, setMistakesList] = useState<
    { rule: string; value: number; explanation: string }[]
  >([]);

  // Engine Refs to avoid stale closures in requestAnimationFrame
  const stateRef = useRef({
    gameState: "start" as "start" | "playing" | "paused" | "gameover",
    score: 0,
    lives: 3,
    combo: 1,
    correctCount: 0,
    playerLane: 1, // 0, 1, 2
    playerX: 0,
    targetX: 0,
    playerY: 0,
    playerTilt: 0,
    invincibleTimer: 0,
    turboTimer: 0,
    screenShake: 0,
    speedLevel: "slow" as SpeedLevel,
    baseSpeed: 2.0,
    speed: 2.0,
    roadOffset: 0,
    currentWave: null as WaveQuestion | null,
    waveY: -120,
    waveHandled: false,
    particles: [] as Particle[],
    floatingTexts: [] as FloatingText[],
    isHardMode: false,
  });

  // Keep stateRef synced with mode and speed
  useEffect(() => {
    stateRef.current.isHardMode = isHardMode;
    const preset = SPEED_PRESETS[speedLevel];
    const mult = isHardMode ? 1.15 : 1.0;
    const base = preset.baseSpeed * mult;
    stateRef.current.speedLevel = speedLevel;
    stateRef.current.baseSpeed = base;
    if (stateRef.current.turboTimer <= 0) {
      stateRef.current.speed = base;
    }
  }, [isHardMode, speedLevel]);

  // Update canvas size
  const updateCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
    }

    stateRef.current.playerY = rect.height - 145;
    const initialLaneX = getLaneCenterX(stateRef.current.playerLane, rect.width);
    stateRef.current.targetX = initialLaneX;
    stateRef.current.playerX = initialLaneX;
  }, []);

  useEffect(() => {
    updateCanvasDimensions();
    window.addEventListener("resize", updateCanvasDimensions);
    return () => window.removeEventListener("resize", updateCanvasDimensions);
  }, [updateCanvasDimensions]);

  function getLaneCenterX(lane: number, width: number) {
    const roadWidth = width * 0.88;
    const roadLeft = (width - roadWidth) / 2;
    const laneWidth = roadWidth / 3;
    return roadLeft + lane * laneWidth + laneWidth / 2;
  }

  // Steering handlers
  const steerLeft = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState !== "playing") return;
    if (s.playerLane > 0) {
      s.playerLane--;
      sound.playLaneSwitch();
    }
  }, []);

  const steerRight = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState !== "playing") return;
    if (s.playerLane < 2) {
      s.playerLane++;
      sound.playLaneSwitch();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        steerLeft();
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        steerRight();
      } else if (e.key === " ") {
        // Space to toggle pause
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [steerLeft, steerRight]);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
  };

  const togglePause = () => {
    setGameState((prev) => {
      if (prev === "playing") {
        stateRef.current.gameState = "paused";
        sound.stopEngine();
        return "paused";
      }
      if (prev === "paused") {
        stateRef.current.gameState = "playing";
        sound.startEngine(stateRef.current.speed / stateRef.current.baseSpeed);
        return "playing";
      }
      return prev;
    });
  };

  const addFloatingText = (text: string, x: number, y: number, color: string) => {
    stateRef.current.floatingTexts.push({
      id: Math.random(),
      text,
      x,
      y,
      color,
      life: 1.0,
    });
  };

  const spawnExplosion = (x: number, y: number, color: string, count = 28) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      stateRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 4 + 2,
        life: 1.0,
        decay: Math.random() * 1.5 + 1.2,
      });
    }
  };

  const startNewGame = (hard = isHardMode) => {
    const s = stateRef.current;
    s.score = 0;
    s.lives = 3;
    s.combo = 1;
    s.correctCount = 0;
    s.playerLane = 1;
    s.invincibleTimer = 0;
    s.turboTimer = 0;
    s.screenShake = 0;
    const preset = SPEED_PRESETS[speedLevel];
    const base = preset.baseSpeed * (hard ? 1.15 : 1.0);
    s.baseSpeed = base;
    s.speed = base;
    s.particles = [];
    s.floatingTexts = [];
    s.waveHandled = false;
    s.gameState = "playing";

    const initialWave = generateWaveQuestion(undefined, hard);
    s.currentWave = initialWave;
    s.waveY = -110;

    setCurrentRuleInfo({
      title: initialWave.rule.title,
      question: initialWave.rule.question,
      tip: initialWave.rule.shortTip,
      divisor: initialWave.divisor,
    });

    setScore(0);
    setLives(3);
    setCombo(1);
    setCorrectCount(0);
    setMistakesList([]);
    setLastFeedback(null);
    setGameState("playing");

    sound.playTurbo();
    sound.startEngine(1);
  };

  const handleGameOver = (reason: string) => {
    const s = stateRef.current;
    s.gameState = "gameover";
    setGameState("gameover");
    sound.stopEngine();
    sound.playGameOver();

    if (s.score > highScore) {
      setHighScore(s.score);
      localStorage.setItem("bolunebilme_highscore", String(s.score));
    }
  };

  // Main Animation & Physics Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const canvas = canvasRef.current;
      const container = containerRef.current;
      const s = stateRef.current;

      if (canvas && container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          // --- UPDATE LOGIC ---
          if (s.gameState === "playing") {
            // Turbo timer
            if (s.turboTimer > 0) {
              s.turboTimer -= dt;
              s.speed = s.baseSpeed * 1.35;
            } else {
              s.speed = s.baseSpeed;
            }

            // Invincibility cooldown
            if (s.invincibleTimer > 0) {
              s.invincibleTimer -= dt;
            }

            // Screen shake dampening
            if (s.screenShake > 0) {
              s.screenShake -= dt * 35;
              if (s.screenShake < 0) s.screenShake = 0;
            }

            // Engine sound modulation
            sound.startEngine(s.speed / s.baseSpeed);

            // Road offset scrolling (smoother and calmer)
            s.roadOffset = (s.roadOffset + s.speed * 50 * dt) % 80;

            // Player car horizontal smoothing
            s.targetX = getLaneCenterX(s.playerLane, width);
            const dx = s.targetX - s.playerX;
            s.playerX += dx * Math.min(dt * 16, 1);
            s.playerTilt = dx * 0.07;

            // Wave movement - slowed down for comfortable mental math calculation
            if (s.currentWave) {
              s.waveY += s.speed * 48 * dt;

              // Check collision with player
              const bumperY = s.playerY - 45;
              if (!s.waveHandled && s.waveY >= bumperY - 20 && s.waveY <= s.playerY + 25) {
                s.waveHandled = true;
                const hitItem = s.currentWave.options.find((opt) => opt.lane === s.playerLane);

                if (hitItem && hitItem.isCorrect) {
                  // CORRECT ANSWER!
                  const earned = 100 * s.combo;
                  s.score += earned;
                  s.combo = Math.min(s.combo + 1, 5);
                  s.correctCount++;
                  s.turboTimer = 2.8;

                  setScore(s.score);
                  setCombo(s.combo);
                  setCorrectCount(s.correctCount);
                  setLastFeedback({
                    text: `HARİKA! +${earned} PUAN`,
                    subtext: `${hitItem.value}: ${hitItem.explanation}`,
                    isCorrect: true,
                  });

                  sound.playCorrect();
                  sound.playTurbo();
                  spawnExplosion(s.playerX, s.playerY - 35, "#34d399", 35);
                  addFloatingText(`+${earned} TURBO!`, s.playerX, s.playerY - 60, "#34d399");
                } else {
                  // WRONG ANSWER!
                  if (s.invincibleTimer <= 0) {
                    s.lives--;
                    s.combo = 1;
                    s.invincibleTimer = 1.8;
                    s.screenShake = 18;
                    s.speed = s.baseSpeed * 0.65; // speed drop

                    setLives(s.lives);
                    setCombo(1);

                    const chosenVal = hitItem ? hitItem.value : 0;
                    const explanation = hitItem ? hitItem.explanation : "Hatalı kulvar!";
                    setLastFeedback({
                      text: "DİKKAT! -1 CAN",
                      subtext: `${chosenVal} kurala uymaz! (${explanation})`,
                      isCorrect: false,
                    });

                    if (hitItem && s.currentWave) {
                      setMistakesList((prev) => [
                        ...prev,
                        {
                          rule: s.currentWave!.rule.title,
                          value: hitItem.value,
                          explanation: hitItem.explanation,
                        },
                      ]);
                    }

                    sound.playWrong();
                    sound.playHeartLost();
                    spawnExplosion(s.playerX, s.playerY - 35, "#ef4444", 30);
                    addFloatingText("-1 CAN!", s.playerX, s.playerY - 60, "#ef4444");

                    if (s.lives <= 0) {
                      handleGameOver("Canların tükendi!");
                    }
                  }
                }
              }

              // Wave went past bottom of screen -> spawn next wave
              if (s.waveY > height + 60) {
                const nextWave = generateWaveQuestion(s.currentWave.divisor, s.isHardMode);
                s.currentWave = nextWave;
                s.waveY = -120;
                s.waveHandled = false;

                setCurrentRuleInfo({
                  title: nextWave.rule.title,
                  question: nextWave.rule.question,
                  tip: nextWave.rule.shortTip,
                  divisor: nextWave.divisor,
                });
              }
            }

            // Update particles
            for (let i = s.particles.length - 1; i >= 0; i--) {
              const p = s.particles[i];
              p.x += p.vx * dt * 60;
              p.y += p.vy * dt * 60;
              p.life -= dt * p.decay;
              if (p.life <= 0) s.particles.splice(i, 1);
            }

            // Update floating texts
            for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
              const ft = s.floatingTexts[i];
              ft.y -= dt * 45;
              ft.life -= dt * 1.2;
              if (ft.life <= 0) s.floatingTexts.splice(i, 1);
            }
          }

          // --- RENDER LOGIC ---
          ctx.save();

          // Screen Shake
          if (s.screenShake > 0) {
            const rx = (Math.random() - 0.5) * s.screenShake;
            const ry = (Math.random() - 0.5) * s.screenShake;
            ctx.translate(rx, ry);
          }

          ctx.clearRect(0, 0, width, height);

          // Deep cyber background
          const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
          bgGrad.addColorStop(0, "#030712");
          bgGrad.addColorStop(1, "#0b1329");
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, width, height);

          // Road setup
          const roadWidth = width * 0.88;
          const roadLeft = (width - roadWidth) / 2;
          const roadRight = roadLeft + roadWidth;
          const laneWidth = roadWidth / 3;

          // Asphalt texture
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(roadLeft, 0, roadWidth, height);

          // Road side curbs (Alternating Neon Red & White)
          const curbWidth = 10;
          const curbStep = 38;
          for (let y = -curbStep + (s.roadOffset % curbStep); y < height + curbStep; y += curbStep) {
            const isRed = Math.floor((y - s.roadOffset) / curbStep) % 2 === 0;
            ctx.fillStyle = isRed ? "#ef4444" : "#f1f5f9";
            ctx.fillRect(roadLeft - curbWidth, y, curbWidth, curbStep);
            ctx.fillRect(roadRight, y, curbWidth, curbStep);
          }

          // Neon Lane Divider Dashed Lines
          ctx.strokeStyle = s.turboTimer > 0 ? "#f59e0b" : "#06b6d4";
          ctx.lineWidth = 3;
          ctx.setLineDash([26, 26]);
          ctx.lineDashOffset = -s.roadOffset;

          // Left divider
          ctx.beginPath();
          ctx.moveTo(roadLeft + laneWidth, 0);
          ctx.lineTo(roadLeft + laneWidth, height);
          ctx.stroke();

          // Right divider
          ctx.beginPath();
          ctx.moveTo(roadLeft + laneWidth * 2, 0);
          ctx.lineTo(roadLeft + laneWidth * 2, height);
          ctx.stroke();
          ctx.setLineDash([]);

          // Turbo Speed lines
          if (s.turboTimer > 0) {
            ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
            ctx.lineWidth = 2;
            for (let i = 0; i < 9; i++) {
              const sx = roadLeft + (i * 53) % roadWidth;
              const sy = (s.roadOffset * 4 + i * 90) % height;
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(sx, sy + 45);
              ctx.stroke();
            }
          }

          // Render Wave Gates
          if (s.currentWave) {
            s.currentWave.options.forEach((item) => {
              const cx = roadLeft + item.lane * laneWidth + laneWidth / 2;
              const gateW = laneWidth * 0.88;
              const gateH = 56;
              const gx = cx - gateW / 2;
              const gy = s.waveY - gateH / 2;

              ctx.save();
              // All options have identical neon styling so player must solve the rule mentally
              ctx.shadowColor = "rgba(6, 182, 212, 0.65)";
              ctx.shadowBlur = 14;

              ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
              ctx.strokeStyle = "#38bdf8";
              ctx.lineWidth = 2.5;

              drawRoundedRect(ctx, gx, gy, gateW, gateH, 12, true, true);

              // Inside fill accent (identical for all gates)
              ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
              drawRoundedRect(ctx, gx + 2, gy + 2, gateW - 4, gateH - 4, 10, true, false);

              // Gate Number text
              ctx.shadowBlur = 0;
              ctx.fillStyle = "#ffffff";
              ctx.font = '800 24px "Chakra Petch", sans-serif';
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(String(item.value), cx, gy + gateH / 2);

              // Small neon top beacon (identical for all gates)
              ctx.fillStyle = "#38bdf8";
              ctx.beginPath();
              ctx.arc(cx, gy + 8, 3, 0, Math.PI * 2);
              ctx.fill();

              ctx.restore();
            });
          }

          // Render Player Car
          renderPlayerCar(
            ctx,
            s.playerX,
            s.playerY,
            s.playerTilt,
            s.invincibleTimer > 0,
            s.turboTimer > 0
          );

          // Render Particles
          s.particles.forEach((p) => {
            ctx.save();
            ctx.globalAlpha = Math.max(p.life, 0);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          // Render Floating texts
          s.floatingTexts.forEach((ft) => {
            ctx.save();
            ctx.globalAlpha = Math.max(ft.life, 0);
            ctx.fillStyle = ft.color;
            ctx.shadowColor = ft.color;
            ctx.shadowBlur = 10;
            ctx.font = '800 18px "Chakra Petch", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.restore();
          });

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  function renderPlayerCar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    tilt: number,
    isInvincible: boolean,
    isTurbo: boolean
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    // Blinking effect during invulnerability
    if (isInvincible && Math.floor(Date.now() / 90) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    const carW = 46;
    const carH = 84;

    // Underglow Neon Glow
    ctx.save();
    ctx.shadowColor = isTurbo ? "#f59e0b" : "#06b6d4";
    ctx.shadowBlur = isTurbo ? 32 : 18;
    ctx.fillStyle = isTurbo ? "rgba(245, 158, 11, 0.6)" : "rgba(6, 182, 212, 0.4)";
    ctx.fillRect(-carW / 2 + 6, -carH / 2 + 10, carW - 12, carH - 20);
    ctx.restore();

    // Dual Exhaust Flames
    const flameLen = isTurbo ? 32 + Math.random() * 16 : 14 + Math.random() * 8;
    ctx.fillStyle = isTurbo ? "#f97316" : "#38bdf8";

    // Left flame
    ctx.beginPath();
    ctx.moveTo(-14, carH / 2);
    ctx.lineTo(-9, carH / 2);
    ctx.lineTo(-11.5, carH / 2 + flameLen);
    ctx.fill();

    // Right flame
    ctx.beginPath();
    ctx.moveTo(9, carH / 2);
    ctx.lineTo(14, carH / 2);
    ctx.lineTo(11.5, carH / 2 + flameLen);
    ctx.fill();

    // Outer Aerodynamic Car Body
    ctx.fillStyle = isTurbo ? "#ea580c" : "#0284c7";
    drawRoundedRect(ctx, -carW / 2, -carH / 2, carW, carH, 12, true, false);

    // Dark Tint Cockpit
    ctx.fillStyle = "#090d16";
    drawRoundedRect(ctx, -carW / 2 + 7, -carH / 2 + 20, carW - 14, 28, 6, true, false);

    // Windshield Reflection
    ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
    drawRoundedRect(ctx, -carW / 2 + 10, -carH / 2 + 23, carW - 20, 10, 4, true, false);

    // Engine Hood Scoop
    ctx.fillStyle = isTurbo ? "#c2410c" : "#0369a1";
    drawRoundedRect(ctx, -10, -5, 20, 24, 4, true, false);

    // Rear Spoiler
    ctx.fillStyle = "#030712";
    ctx.fillRect(-carW / 2 - 2, carH / 2 - 8, carW + 4, 7);

    // Dual Front Xenon Headlights
    ctx.fillStyle = "#fef08a";
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 10;
    ctx.fillRect(-carW / 2 + 4, -carH / 2 + 2, 8, 4);
    ctx.fillRect(carW / 2 - 12, -carH / 2 + 2, 8, 4);

    // Wheels
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-carW / 2 - 3, -carH / 2 + 12, 4, 16);
    ctx.fillRect(carW / 2 - 1, -carH / 2 + 12, 4, 16);
    ctx.fillRect(-carW / 2 - 3, carH / 2 - 28, 4, 18);
    ctx.fillRect(carW / 2 - 1, carH / 2 - 28, 4, 18);

    ctx.restore();
  }

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: boolean,
    stroke: boolean
  ) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // Handle direct lane tap on canvas
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = clickX / rect.width;

    if (fraction < 0.33) {
      stateRef.current.playerLane = 0;
      sound.playLaneSwitch();
    } else if (fraction < 0.66) {
      stateRef.current.playerLane = 1;
      sound.playLaneSwitch();
    } else {
      stateRef.current.playerLane = 2;
      sound.playLaneSwitch();
    }
  };

  // Export single file HTML
  const downloadSingleFile = () => {
    const html = getSingleFileHtml();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bolunebilme-kurallari-araba-yarisi.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySingleFileCode = () => {
    const html = getSingleFileHtml();
    navigator.clipboard.writeText(html).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-0 sm:p-4 select-none overflow-hidden font-['Outfit']">
      
      {/* Game Outer Shell */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg h-screen sm:h-[840px] bg-slate-950 sm:rounded-2xl border-x sm:border-2 border-slate-800 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col overflow-hidden"
      >
        {/* Top Floating HUD */}
        <header className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-slate-950/95 via-slate-950/80 to-transparent pointer-events-auto">
          {/* Top row: Score, Combo, Lives, Controls */}
          <div className="flex items-center justify-between gap-2 mb-2 font-['Chakra_Petch']">
            {/* Score & Combo */}
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-slate-400 font-bold tracking-wider">SKOR</span>
                <span className="text-lg font-extrabold text-amber-400 text-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                  {score}
                </span>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                  combo > 1
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {combo}x KOMBO
              </div>
            </div>

            {/* Lives & Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 text-base">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`transition-transform duration-200 ${
                      i < lives ? "scale-100" : "scale-75 opacity-25 grayscale"
                    }`}
                  >
                    ❤️
                  </span>
                ))}
              </div>

              {/* Speed Mode Quick Button */}
              <button
                onClick={() => {
                  const next: SpeedLevel =
                    speedLevel === "slow" ? "normal" : speedLevel === "normal" ? "fast" : "slow";
                  setSpeedLevel(next);
                  setLastFeedback({
                    text: `HIZ SEVİYESİ: ${SPEED_PRESETS[next].icon} ${SPEED_PRESETS[next].label}`,
                    subtext: SPEED_PRESETS[next].desc,
                    isCorrect: true,
                  });
                }}
                className="px-2 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer text-xs font-bold font-['Chakra_Petch'] flex items-center gap-1"
                title={`Oyun Hızı: ${SPEED_PRESETS[speedLevel].label} (Değiştirmek için tıkla)`}
                aria-label="Oyun Hızı"
              >
                <span>{SPEED_PRESETS[speedLevel].icon}</span>
                <span className="hidden sm:inline text-[11px]">{SPEED_PRESETS[speedLevel].label}</span>
              </button>

              {/* Rules Modal Button */}
              <button
                onClick={() => setIsRulesOpen(true)}
                className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 transition-colors cursor-pointer"
                title="Bölünebilme Kuralları Rehberi"
                aria-label="Kurallar Rehberi"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                title={isMuted ? "Sesi Aç" : "Sesi Kapat"}
                aria-label="Ses"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

              {/* Pause Toggle */}
              {gameState === "playing" && (
                <button
                  onClick={togglePause}
                  className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-colors cursor-pointer text-xs font-bold"
                  title="Duraklat"
                >
                  ⏸️
                </button>
              )}
            </div>
          </div>

          {/* Question Banner */}
          <div
            className={`rounded-xl p-2.5 text-center transition-all duration-300 backdrop-blur-md border ${
              stateRef.current.turboTimer > 0
                ? "bg-amber-950/80 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.5)]"
                : "bg-slate-900/85 border-cyan-500/70 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 font-['Chakra_Petch'] font-extrabold text-sm sm:text-base text-white tracking-wide uppercase">
              <span className="text-cyan-400">🎯</span>
              <span>{currentRuleInfo.question}</span>
            </div>
            <div className="mt-1 text-xs text-cyan-300 flex items-center justify-center gap-1 font-medium">
              <span className="text-amber-400">💡 İpucu:</span>
              <span>{currentRuleInfo.tip}</span>
            </div>
          </div>

          {/* Last feedback banner (educational explanation of hit) */}
          {lastFeedback && (
            <div
              className={`mt-2 py-1 px-2.5 rounded-lg text-xs font-['Chakra_Petch'] font-bold text-center animate-in fade-in duration-200 border ${
                lastFeedback.isCorrect
                  ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                  : "bg-rose-950/85 border-rose-500/60 text-rose-200"
              }`}
            >
              <div>{lastFeedback.text}</div>
              {lastFeedback.subtext && (
                <div className="text-[11px] font-normal opacity-90 mt-0.5">
                  {lastFeedback.subtext}
                </div>
              )}
            </div>
          )}
        </header>

        {/* Main Canvas View */}
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className="w-full h-full block cursor-pointer"
        />

        {/* Bottom Touch Steering Controls */}
        <div className="absolute bottom-5 left-4 right-4 z-20 flex justify-between gap-4 pointer-events-auto">
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              steerLeft();
            }}
            className="flex-1 h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 active:scale-95 border-2 border-cyan-500/40 active:border-cyan-400 active:shadow-[0_0_25px_rgba(6,182,212,0.7)] text-cyan-300 font-['Chakra_Petch'] font-extrabold text-lg flex items-center justify-center gap-2 backdrop-blur-md transition-all cursor-pointer shadow-lg"
            aria-label="Sol Kulvar"
          >
            <ChevronLeft className="w-6 h-6" /> SOL
          </button>
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              steerRight();
            }}
            className="flex-1 h-16 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 active:scale-95 border-2 border-cyan-500/40 active:border-cyan-400 active:shadow-[0_0_25px_rgba(6,182,212,0.7)] text-cyan-300 font-['Chakra_Petch'] font-extrabold text-lg flex items-center justify-center gap-2 backdrop-blur-md transition-all cursor-pointer shadow-lg"
            aria-label="Sağ Kulvar"
          >
            SAĞ <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        {/* Pause Overlay */}
        {gameState === "paused" && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h2 className="text-3xl font-extrabold text-amber-400 font-['Chakra_Petch'] tracking-wider mb-2">
              OYUN DURAKLATILDI
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              Hazır olduğunda yarışa devam edebilir veya kuralları tekrar inceleyebilirsin.
            </p>
            <button
              onClick={togglePause}
              className="w-full max-w-xs py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold font-['Chakra_Petch'] uppercase tracking-wider text-base shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all cursor-pointer mb-3"
            >
              Yarışa Devam Et
            </button>
            <button
              onClick={() => setIsRulesOpen(true)}
              className="py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold border border-slate-700 transition-colors cursor-pointer"
            >
              📖 Kurallar Rehberini Aç
            </button>
          </div>
        )}

        {/* Start Game Overlay */}
        {gameState === "start" && (
          <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Zap className="w-9 h-9" />
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-['Chakra_Petch'] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-yellow-300 to-amber-500 tracking-wider uppercase leading-tight mb-1">
              BÖLÜNEBİLME KURALLARI
            </h1>
            <div className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2 font-['Chakra_Petch']">
              ARABA YARIŞI &bull; 6. SINIF MATEMATİK
            </div>
            <p className="text-xs text-slate-400 max-w-xs mb-5 leading-relaxed">
              Yolda akan sayılardan yukarıdaki kurala uyan <strong>DOĞRU SAYIYA</strong> çarparak turbo hızına ulaş ve rekor kır!
            </p>

            {/* Quick How to play */}
            <div className="w-full max-w-xs bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 text-left text-xs space-y-2 mb-5">
              <div className="font-bold text-amber-300 flex items-center gap-1.5 font-['Chakra_Petch'] text-sm">
                <Sparkles className="w-4 h-4 text-amber-400" /> OYUN REHBERİ:
              </div>
              <div className="text-slate-300 flex items-start gap-2">
                <span className="text-cyan-400 font-bold">1.</span>
                <span>3 kulvarda akan sayılardan sadece biri kurala uyar.</span>
              </div>
              <div className="text-slate-300 flex items-start gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                <span>Doğru sayı: <strong>+100 Puan</strong> & <strong>Turbo Hızı!</strong></span>
              </div>
              <div className="text-slate-300 flex items-start gap-2">
                <span className="text-rose-400 font-bold">3.</span>
                <span>Yanlış sayı: <strong>1 Can Kaybı</strong> ve hız düşüşü!</span>
              </div>
            </div>

            {/* Speed Selector */}
            <div className="w-full max-w-xs mb-3.5">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between font-['Chakra_Petch']">
                <span>Oyun Hızı</span>
                <span className="text-amber-400">{SPEED_PRESETS[speedLevel].desc}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
                {(["slow", "normal", "fast"] as SpeedLevel[]).map((lvl) => {
                  const cfg = SPEED_PRESETS[lvl];
                  const isSel = speedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSpeedLevel(lvl)}
                      className={`py-1.5 px-1 rounded-lg text-xs font-bold font-['Chakra_Petch'] transition-all flex flex-col items-center justify-center cursor-pointer ${
                        isSel
                          ? "bg-cyan-500 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.5)] scale-[1.02]"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <span className="text-sm">{cfg.icon}</span>
                      <span className="text-[11px]">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Toggle */}
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setIsHardMode(false)}
                className={`px-3 py-1 rounded-lg text-xs font-bold font-['Chakra_Petch'] transition-all cursor-pointer ${
                  !isHardMode
                    ? "bg-slate-700 text-cyan-300 border border-cyan-500/40"
                    : "bg-slate-900 text-slate-500 border border-slate-800"
                }`}
              >
                2-3 Basamaklı Sayılar
              </button>
              <button
                type="button"
                onClick={() => setIsHardMode(true)}
                className={`px-3 py-1 rounded-lg text-xs font-bold font-['Chakra_Petch'] transition-all cursor-pointer ${
                  isHardMode
                    ? "bg-slate-700 text-amber-300 border border-amber-500/40"
                    : "bg-slate-900 text-slate-500 border border-slate-800"
                }`}
              >
                3-4 Basamaklı Sayılar
              </button>
            </div>

            {/* Play Button */}
            <button
              onClick={() => startNewGame(isHardMode)}
              className="w-full max-w-xs py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-['Chakra_Petch'] uppercase tracking-widest text-lg shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all cursor-pointer mb-2.5 active:scale-95"
            >
              GAZA BAS (OYUNA BAŞLA)
            </button>

            {/* Secondary Buttons */}
            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                onClick={() => setIsRulesOpen(true)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Kurallar
              </button>
              <button
                onClick={() => setIsExportOpen(true)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" /> Tek Dosya HTML
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {gameState === "gameover" && (
          <div className="absolute inset-0 z-40 bg-slate-950/94 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in overflow-y-auto">
            <h2 className="text-3xl font-black font-['Chakra_Petch'] text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-amber-500 uppercase tracking-wider mb-1">
              YARIŞ BİTTİ!
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Canların tükendi, aracın pite çekildi. İşte yarış analizin:
            </p>

            {/* Results card */}
            <div className="w-full max-w-xs bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-4 text-center">
              <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase font-['Chakra_Petch']">
                KAZANILAN PUAN
              </div>
              <div className="text-4xl font-black text-amber-400 font-['Chakra_Petch'] my-1 text-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
                {score}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 font-['Chakra_Petch']">
                <div className="bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-400">DOĞRU KAPILAR</div>
                  <div className="text-lg font-bold text-emerald-400">{correctCount}</div>
                </div>
                <div className="bg-slate-950/60 p-2 rounded-xl">
                  <div className="text-[10px] text-slate-400">EN İYİ REKOR</div>
                  <div className="text-lg font-bold text-cyan-400">{highScore}</div>
                </div>
              </div>

              {/* Review mistakes if any */}
              {mistakesList.length > 0 && (
                <div className="mt-3 text-left">
                  <div className="text-[11px] font-bold text-rose-400 font-['Chakra_Petch'] mb-1.5 flex items-center gap-1">
                    <span>⚠️ Tekrar Edilmesi Gereken Kurallar:</span>
                  </div>
                  <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                    {mistakesList.slice(-3).map((m, idx) => (
                      <div
                        key={idx}
                        className="bg-rose-950/30 border border-rose-500/20 rounded p-1.5 text-[11px] text-slate-300"
                      >
                        <span className="font-bold text-rose-300">{m.rule}:</span> {m.value}{" "}
                        <span className="text-slate-400">({m.explanation})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Restart Button */}
            <button
              onClick={() => startNewGame(isHardMode)}
              className="w-full max-w-xs py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black font-['Chakra_Petch'] uppercase tracking-widest text-base shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all cursor-pointer mb-2.5 active:scale-95"
            >
              YENİDEN YARIŞ (GAZA BAS)
            </button>

            <div className="flex items-center gap-2 w-full max-w-xs">
              <button
                onClick={() => setIsRulesOpen(true)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                📖 Kuralları İncele
              </button>
              <button
                onClick={() => setIsExportOpen(true)}
                className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                💾 HTML İndir
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Single-File HTML Export & Download Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-cyan-500/50 rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.3)] p-5 text-slate-100 font-['Outfit']">
            <h3 className="text-lg font-extrabold text-cyan-400 font-['Chakra_Petch'] uppercase tracking-wider mb-2">
              Tek Dosya HTML (Single File HTML)
            </h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Oyun HTML5, CSS ve Vanilla JavaScript kullanılarak hiçbir harici kütüphane veya Node sunucusu gerektirmeden tek bir <code>.html</code> dosyası halinde paketlendi. İstediğin bilgisayarda çift tıklayarak internetsiz oynayabilirsin.
            </p>

            <div className="space-y-2 mb-5">
              <button
                onClick={downloadSingleFile}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold font-['Chakra_Petch'] text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all"
              >
                <Download className="w-4 h-4" />
                .html Dosyasını İndir
              </button>

              <button
                onClick={copySingleFileCode}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold font-['Chakra_Petch'] text-sm tracking-wider flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" /> Kopyalandı!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-cyan-400" /> HTML Kodunu Panoya Kopyala
                  </>
                )}
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800 mb-4">
              📌 Ayrıca bu dosya projenin ana dizininde <strong>/bolunebilme-yarisi.html</strong> olarak kaydedilmiştir.
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsExportOpen(false)}
                className="px-5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
