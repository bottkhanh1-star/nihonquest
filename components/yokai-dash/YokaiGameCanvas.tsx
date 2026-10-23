"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  YokaiQuestion,
  GameZone,
  SpiritBeast,
  YokaiGameResult,
  ObstacleType,
  CollectibleType,
} from "@/lib/yokai-dash/types";
import { yokaiSound } from "@/lib/yokai-dash/sound";
import {
  evaluateObstacleEncounter,
  generateTrackSegment,
  getObstacleMeta,
  getObstacleAction,
} from "@/lib/yokai-dash/generator";
import {
  createBeast3DModel,
  animateBeastMotion,
  BeastMeshBundle,
  createChaserYokai3DModel,
  animateChaserYokai,
} from "./models/YokaiBeast3D";
import { disposeThreeHierarchy, disposeSingleMaterial } from "@/lib/yokai-dash/three-utils";
import { buildZoneScenery, createObstacleSkin, getZoneTheme } from "@/lib/yokai-dash/zone-scenery";
import { HeartIcon, HudChip, HudIconButton } from "./YokaiGameUI";
import { useNativeLanguage } from "@/components/LanguageContext";
import { useSoundAndTheme } from "@/components/SoundAndThemeContext";
import { getObstacleMetaLocalized, localizeYokaiQuestion } from "@/lib/yokai-dash/yokaiLocalization";

interface YokaiGameCanvasProps {
  zone: GameZone;
  beast: SpiritBeast;
  questions: YokaiQuestion[];
  isPractice: boolean;
  speedDifficulty?: "EASY" | "MEDIUM" | "CUSTOM";
  customSpeed?: number;
  questionMode?: string;
  showGateHint?: boolean;
  onToggleGateHint?: (show: boolean) => void;
  isPausedExternal?: boolean;
  onPauseChange?: (paused: boolean) => void;
  onFinishGame: (result: YokaiGameResult) => void;
  onExitGame: () => void;
}

interface ActiveObstacle {
  mesh: THREE.Group;
  type: ObstacleType;
  lane: 0 | 1 | 2;
  z: number;
  cleared: boolean;
}

interface ActiveCollectible {
  mesh: THREE.Group;
  type: CollectibleType;
  lane: 0 | 1 | 2;
  y: number;
  z: number;
  points: number;
  collected: boolean;
}

interface ActiveGate {
  group: THREE.Group;
  questionIndex: number;
  z: number;
  cleared: boolean;
  signMeshes: THREE.Mesh[];
  arches?: { mesh: THREE.Mesh; laneIdx: number; correctLane: number }[];
}

const LANE_X = [-2.6, 0, 2.6];
const BASE_SPEED = 14.0;
const MAX_SPEED = 21.0;
const JUMP_DURATION = 0.68;
const JUMP_HEIGHT = 2.5;
const SLIDE_DURATION = 0.65;
const INVULNERABLE_TIME = 1.25;

export function YokaiGameCanvas({
  zone,
  beast,
  questions,
  isPractice,
  speedDifficulty = "MEDIUM",
  customSpeed = 14.0,
  questionMode = "ALL",
  showGateHint: showGateHintProp = true,
  onToggleGateHint,
  isPausedExternal,
  onPauseChange,
  onFinishGame,
  onExitGame,
}: YokaiGameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeGateRef = useRef<ActiveGate | null>(null);
  const onFinishGameRef = useRef(onFinishGame);
  onFinishGameRef.current = onFinishGame;
  const hasReportedFinishRef = useRef(false);

  // Yatagarasu (八咫烏) Thần Điểu Ba Chân Ánh Dương — Cơ chế bay lượn trên không & cổng trên mây
  const isFlyingBeast = beast.id === "yatagarasu";

  // Gợi ý vòng vàng (đáp án đúng): Có thể bật / tắt realtime
  const { nativeLanguage } = useNativeLanguage();
  const { speak, soundEnabled } = useSoundAndTheme();
  const isEn = nativeLanguage === "en";
  const isZh = nativeLanguage === "zh-CN" || nativeLanguage === "zh-TW";
  const isKo = nativeLanguage === "ko";

  const [showGateHint, setShowGateHint] = useState<boolean>(showGateHintProp);
  const showGateHintRef = useRef<boolean>(showGateHintProp);
  showGateHintRef.current = showGateHint;

  useEffect(() => {
    setShowGateHint(showGateHintProp);
    showGateHintRef.current = showGateHintProp;
  }, [showGateHintProp]);

  const toggleGateHint = useCallback(() => {
    setShowGateHint((prev) => {
      const next = !prev;
      showGateHintRef.current = next;
      // Cập nhật tức thời màu vòng Torus của cổng đang chạy
      if (activeGateRef.current?.arches) {
        activeGateRef.current.arches.forEach((a) => {
          const mat = a.mesh.material as THREE.MeshBasicMaterial;
          if (mat) {
            mat.color.setHex(next && a.laneIdx === a.correctLane ? 0xffea00 : 0x00e5ff);
          }
        });
      }
      onToggleGateHint?.(next);
      return next;
    });
  }, [onToggleGateHint]);

  // Gameplay React State (Only updated on discrete events, NEVER in 60fps loop)
  const [hearts, setHearts] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isVictory, setIsVictory] = useState<boolean>(false);
  const [activePrompt, setActivePrompt] = useState<YokaiQuestion | null>(questions[0] || null);
  const [hasFirstHitShield, setHasFirstHitShield] = useState<boolean>(beast.bonusType === "SHIELD_ONE");
  const [impactFlash, setImpactFlash] = useState<"red" | "gold" | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  // UI feedback, Sound & Pause state
  const [isPaused, setIsPaused] = useState<boolean>(Boolean(isPausedExternal));
  const [isMuted, setIsMuted] = useState<boolean>(() => yokaiSound.getMuted());
  const [currentLaneUI, setCurrentLaneUI] = useState<0 | 1 | 2>(1);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: "obstacle" | "wrong_gate" | "correct_gate" | "shield";
    title: string;
    detail?: string;
  } | null>(null);
  const [actionPopup, setActionPopup] = useState<{
    id: number;
    text: string;
    tone: "perfect" | "orb";
  } | null>(null);

  const reducedMotionRef = useRef<boolean>(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotion((prev) => {
      const next = !prev;
      reducedMotionRef.current = next;
      return next;
    });
  }, []);

  // Continuous high-frequency game physics & loop state stored in ref
  const gameStateRef = useRef({
    currentLane: 1 as 0 | 1 | 2,
    lastLane: 1 as 0 | 1 | 2,
    timeSinceLaneSwitch: 99,
    targetX: 0,
    currentX: 0,
    playerY: 0,
    isJumping: false,
    jumpTimer: 0,
    isSliding: false,
    slideTimer: 0,
    landingSquash: 0,
    stumbleTimer: 0,
    cheerTimer: 0,
    shakeTimer: 0,
    isVictoryAnim: false,
    hearts: 3,
    score: 0,
    combo: 0,
    maxCombo: 0,
    currentQuestionIndex: 0,
    distance: 0,
    isOver: false,
    isPaused: Boolean(isPausedExternal),
    questions,
    answeredQuestions: [] as YokaiGameResult["answeredQuestions"],
    hasShield: beast.bonusType === "SHIELD_ONE",
    invulnerableTimer: 0,
    currentSpeed: BASE_SPEED,
  });

  // Sync external pause state changes (e.g. from browser Back/Forward or URL param)
  useEffect(() => {
    if (typeof isPausedExternal === "boolean" && isPausedExternal !== isPaused) {
      setIsPaused(isPausedExternal);
      gameStateRef.current.isPaused = isPausedExternal;
    }
  }, [isPausedExternal, isPaused]);

  // Auto-pause when tab loses visibility or window loses focus
  useEffect(() => {
    const pauseIfActive = () => {
      const s = gameStateRef.current;
      if (!s.isOver && !s.isPaused) {
        s.isPaused = true;
        setIsPaused(true);
        onPauseChange?.(true);
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) pauseIfActive();
    };
    window.addEventListener("blur", pauseIfActive);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("blur", pauseIfActive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onPauseChange]);

  // Touch swipe handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // Timestamp of the latest touch event on interactive controls to suppress synthetic onClick
  const lastTouchTimeRef = useRef<number>(0);
  // Hard cooldown guards: physically prevents double-lane skip or double-actions in a single tap
  const lastLaneSwitchTimeRef = useRef<number>(0);
  const lastJumpTimeRef = useRef<number>(0);
  const lastSlideTimeRef = useRef<number>(0);
  // Track all timeouts for clean teardown
  const timeoutsRef = useRef<number[]>([]);

  const handleButtonTouch = useCallback(
    (action: () => void) => (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      lastTouchTimeRef.current = performance.now();
      action();
    },
    []
  );

  const handleButtonClick = useCallback(
    (action: () => void) => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // On mobile browsers, synthetic click fires 150-400ms after touchstart. Suppress it!
      if (performance.now() - lastTouchTimeRef.current < 600) return;
      action();
    },
    []
  );

  const safeSetTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = window.setTimeout(fn, delayMs);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // TTS helper with multi-tier fallback & sound toggle check
  const speakCurrentQuestion = useCallback(() => {
    if (!soundEnabled) return;
    const q = gameStateRef.current.questions[gameStateRef.current.currentQuestionIndex];
    if (!q || !q.audioText) return;
    speak(q.audioText, 0.85);
  }, [speak, soundEnabled]);

  // Controls with strict cooldown guards (prevents skipping 2 lanes in 1 tap)
  const selectLane = useCallback((laneIdx: 0 | 1 | 2) => {
    const now = performance.now();
    // Khóa tối thiểu 280ms giữa 2 lần chuyển làn: bảo đảm bấm 1 lần chỉ nhảy đúng 1 làn
    if (now - lastLaneSwitchTimeRef.current < 280) return;
    const s = gameStateRef.current;
    if (s.isOver || s.isPaused || s.currentLane === laneIdx) return;
    lastLaneSwitchTimeRef.current = now;
    s.lastLane = s.currentLane;
    s.currentLane = laneIdx;
    s.timeSinceLaneSwitch = 0.01;
    s.targetX = LANE_X[s.currentLane];
    setCurrentLaneUI(s.currentLane);
    yokaiSound.playDash();
  }, []);

  const moveLeft = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isOver || s.isPaused) return;
    if (s.currentLane > 0) {
      selectLane((s.currentLane - 1) as 0 | 1 | 2);
    }
  }, [selectLane]);

  const moveRight = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isOver || s.isPaused) return;
    if (s.currentLane < 2) {
      selectLane((s.currentLane + 1) as 0 | 1 | 2);
    }
  }, [selectLane]);

  const jump = useCallback(() => {
    const now = performance.now();
    if (now - lastJumpTimeRef.current < 280) return;
    const s = gameStateRef.current;
    if (s.isOver || s.isPaused || s.isJumping) return;
    lastJumpTimeRef.current = now;
    // Allow jump to cancel slide for responsive sequence handling (Slide -> Jump)
    if (s.isSliding) {
      s.isSliding = false;
      s.slideTimer = 0;
    }
    s.isJumping = true;
    s.jumpTimer = 0;
    yokaiSound.playJump();
  }, []);

  const slide = useCallback(() => {
    const now = performance.now();
    if (now - lastSlideTimeRef.current < 280) return;
    const s = gameStateRef.current;
    if (s.isOver || s.isPaused || s.isSliding) return;
    lastSlideTimeRef.current = now;
    // Allow fast-drop from jump into slide for responsive sequence handling (Jump -> Slide)
    if (s.isJumping) {
      s.isJumping = false;
      s.jumpTimer = 0;
      s.playerY = 0;
    }
    s.isSliding = true;
    s.slideTimer = 0;
    yokaiSound.playDash();
  }, []);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      gameStateRef.current.isPaused = next;
      onPauseChange?.(next);
      return next;
    });
  }, [onPauseChange]);

  // Trigger flash effect
  const triggerFlash = useCallback(
    (type: "red" | "gold") => {
      if (reducedMotionRef.current) return;
      setImpactFlash(type);
      safeSetTimeout(() => setImpactFlash(null), 260);
    },
    [safeSetTimeout]
  );

  const showQuickActionPopup = useCallback(
    (text: string, tone: "perfect" | "orb") => {
      setActionPopup({ id: Date.now(), text, tone });
      safeSetTimeout(() => setActionPopup(null), 950);
    },
    [safeSetTimeout]
  );

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        togglePause();
        return;
      }
      if (gameStateRef.current.isPaused) return;

      if (["ArrowLeft", "KeyA"].includes(e.code)) {
        e.preventDefault();
        moveLeft();
      } else if (["ArrowRight", "KeyD"].includes(e.code)) {
        e.preventDefault();
        moveRight();
      } else if (["ArrowUp", "KeyW", "Space"].includes(e.code)) {
        e.preventDefault();
        jump();
      } else if (["ArrowDown", "KeyS"].includes(e.code)) {
        e.preventDefault();
        slide();
      } else if (e.code === "Digit1") {
        e.preventDefault();
        selectLane(0);
      } else if (e.code === "Digit2") {
        e.preventDefault();
        selectLane(1);
      } else if (e.code === "Digit3") {
        e.preventDefault();
        selectLane(2);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveLeft, moveRight, jump, slide, selectLane, togglePause]);

  // Prevent unintended page scrolling / pull-to-refresh on touch devices
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventScroll = (e: TouchEvent) => {
      if (!gameStateRef.current.isPaused && !gameStateRef.current.isOver) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", preventScroll, { passive: false });
    return () => el.removeEventListener("touchmove", preventScroll);
  }, []);

  // Touch controls listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    // If the touch originated from an interactive UI button, ignore container swipe tracking
    if ((e.target as HTMLElement)?.closest?.("button, .yk-control-btn")) {
      touchStartRef.current = null;
      return;
    }
    if (e.touches.length > 0) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const start = touchStartRef.current;
    const end = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    const threshold = 22;

    if (Math.max(absX, absY) > threshold) {
      if (absX > absY) {
        if (dx > 0) moveRight();
        else moveLeft();
      } else {
        if (dy < 0) jump();
        else slide();
      }
    }
    touchStartRef.current = null;
  };

  // TTS prompt speak when question changes
  useEffect(() => {
    if (activePrompt && activePrompt.category === "LISTENING") {
      speakCurrentQuestion();
    }
  }, [activePrompt, speakCurrentQuestion]);

  // Three.js Game Engine Lifecycle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset game state for this new run
    const state = gameStateRef.current;
    state.currentLane = 1;
    state.lastLane = 1;
    state.timeSinceLaneSwitch = 99;
    state.targetX = 0;
    state.currentX = 0;
    state.playerY = 0;
    state.isJumping = false;
    state.jumpTimer = 0;
    state.isSliding = false;
    state.slideTimer = 0;
    state.landingSquash = 0;
    state.stumbleTimer = 0;
    state.cheerTimer = 0;
    state.shakeTimer = 0;
    state.isVictoryAnim = false;
    state.hearts = 3;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.currentQuestionIndex = 0;
    state.distance = 0;
    state.isOver = false;
    hasReportedFinishRef.current = false;
    state.questions = questions;
    state.answeredQuestions = [];
    const initialBaseSpeed =
      speedDifficulty === "EASY"
        ? 10.5
        : speedDifficulty === "CUSTOM"
        ? Math.max(8.0, Math.min(25.0, customSpeed || 14.0))
        : 14.0;
    state.currentSpeed = initialBaseSpeed;

    // High performance WebGLRenderer with mobile-aware pixelRatio & shadow resolution
    const width = container.clientWidth;
    const height = container.clientHeight;
    const isMobileViewport = width < 640;
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobileViewport,
      alpha: false,
      powerPreference: "high-performance",
      precision: "mediump",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobileViewport ? 1.25 : 1.5));
    renderer.shadowMap.enabled = !reducedMotionRef.current;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Scene + môi trường riêng cho từng map (trời, núi, nước/mây, cổng torii, đèn, cây, đảo nổi...)
    const theme = getZoneTheme(zone.id);
    const scene = new THREE.Scene();
    const scenery = buildZoneScenery(scene, zone.id, {
      mobile: isMobileViewport,
      reduced: reducedMotionRef.current,
    });
    const obstacleSkin = createObstacleSkin(zone.id);

    // Yatagarasu (八咫烏) Thần Điểu Ba Chân Ánh Dương — Bay cao ngút ngàn trên chín tầng mây (Y = 8.5m)
    const FLIGHT_BASE_Y = isFlyingBeast ? 8.5 : 0;

    // Camera Base Helper: góc nhìn runner tự nhiên, nhìn xa thấy rõ vật cản, Torii ở trên cao không chắn đường
    const getCameraBase = (aspect: number) => {
      if (aspect < 1.0) {
        // Mobile portrait: Khi bay cao ở Y=8.5m, nâng camera lên Y=11.4m nhìn thoáng bao quát toàn bộ tầng không
        return {
          fov: 58,
          y: isFlyingBeast ? 11.4 : 3.65,
          z: isFlyingBeast ? 8.8 : 7.2,
          lookAtY: isFlyingBeast ? 8.0 : 2.15,
          lookAtZ: -42,
        };
      }
      return {
        fov: 54,
        y: isFlyingBeast ? 11.0 : 3.5,
        z: isFlyingBeast ? 8.4 : 6.8,
        lookAtY: isFlyingBeast ? 7.9 : 2.05,
        lookAtZ: -42,
      };
    };

    let currentAspect = width / height;
    let cameraBase = getCameraBase(currentAspect);
    const camera = new THREE.PerspectiveCamera(cameraBase.fov, currentAspect, 0.1, 350);
    camera.position.set(0, cameraBase.y, cameraBase.z);
    camera.lookAt(0, cameraBase.lookAtY, cameraBase.lookAtZ);

    // Lighting theo bảng màu của map
    const ambientLight = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, theme.hemiIntensity);
    scene.add(ambientLight);

    const rimLight = new THREE.DirectionalLight(theme.rimColor, theme.rimIntensity);
    rimLight.position.set(-8, 10, -18);
    scene.add(rimLight);

    // Đèn lồng đi theo nhân vật
    const lanternGlow = new THREE.PointLight(theme.lanternGlowColor, 18, 14, 1.8);
    lanternGlow.position.set(0, isFlyingBeast ? FLIGHT_BASE_Y + 1.2 : 3.2, 2.5);
    scene.add(lanternGlow);

    const shadowMapSize = isMobileViewport ? 512 : 1024;
    const dirLight = new THREE.DirectionalLight(theme.dirColor, theme.dirIntensity);
    dirLight.position.set(12, 28, 18);
    dirLight.castShadow = !reducedMotionRef.current;
    dirLight.shadow.mapSize.width = shadowMapSize;
    dirLight.shadow.mapSize.height = shadowMapSize;
    dirLight.shadow.camera.near = 4;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -6;
    dirLight.shadow.camera.right = 6;
    dirLight.shadow.camera.top = 8;
    dirLight.shadow.camera.bottom = -3;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Player Group (Anime Spirit Beast - đặt ở FLIGHT_BASE_Y nếu bay)
    const playerGroup = new THREE.Group();
    playerGroup.position.set(0, FLIGHT_BASE_Y, 0);
    scene.add(playerGroup);

    const beastBundle: BeastMeshBundle = createBeast3DModel(beast);
    playerGroup.add(beastBundle.group);

    // Chaser Yōkai Pursuer behind the player
    const chaserBundle = createChaserYokai3DModel();
    chaserBundle.group.position.set(0, isFlyingBeast ? FLIGHT_BASE_Y : 0, 5.2);
    scene.add(chaserBundle.group);

    // Sacred Glowing Lane Divider Lines (nền đường/lan can/torii nền do zone-scenery dựng)
    const lineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(theme.accent),
      transparent: true,
      opacity: 0.8,
    });
    const laneLineGeos: THREE.BufferGeometry[] = [];
    [-1.3, 1.3].forEach((lx) => {
      const lineGeo = new THREE.PlaneGeometry(0.09, 400);
      lineGeo.rotateX(-Math.PI / 2);
      laneLineGeos.push(lineGeo);
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(lx, 0.05, -120);
      scene.add(lineMesh);
    });

    // Luồng gió định hướng làn bay trên tầng không cho Yatagarasu
    if (isFlyingBeast) {
      // 3 luồng gió ánh dương nhẹ nhàng dẫn hướng 3 làn bay
      [-2.8, 0, 2.8].forEach((lx) => {
        const streamGeo = new THREE.PlaneGeometry(0.5, 400);
        streamGeo.rotateX(-Math.PI / 2);
        laneLineGeos.push(streamGeo);
        const streamMesh = new THREE.Mesh(
          streamGeo,
          new THREE.MeshBasicMaterial({
            color: 0xffd54f,
            transparent: true,
            opacity: 0.22,
          })
        );
        streamMesh.position.set(lx, FLIGHT_BASE_Y - 0.35, -120);
        scene.add(streamMesh);
      });

      // 2 dải phân cách làn bay rực rỡ sắc vàng
      [-1.4, 1.4].forEach((lx) => {
        const airLineGeo = new THREE.PlaneGeometry(0.08, 400);
        airLineGeo.rotateX(-Math.PI / 2);
        laneLineGeos.push(airLineGeo);
        const airLineMesh = new THREE.Mesh(
          airLineGeo,
          new THREE.MeshBasicMaterial({
            color: 0xffea00,
            transparent: true,
            opacity: 0.6,
          })
        );
        airLineMesh.position.set(lx, FLIGHT_BASE_Y - 0.32, -120);
        scene.add(airLineMesh);
      });
    }

    // Torii gate kit dùng cho Cổng Câu Hỏi
    const sharedToriiPillarGeo = new THREE.CylinderGeometry(0.25, 0.3, 6.5, 8);
    const sharedToriiPillarMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(theme.toriiColor),
      roughness: 0.4,
    });
    const sharedToriiTopMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.3 });
    const sharedTopBeamGeo = new THREE.BoxGeometry(13.2, 0.55, 0.65);
    const sharedRoofCapGeo = new THREE.BoxGeometry(14.0, 0.18, 0.85);
    const sharedSubBeamGeo = new THREE.BoxGeometry(11.8, 0.38, 0.4);

    const createSharedToriiGate = (zPos: number, scale = 1.0) => {
      const torii = new THREE.Group();
      torii.position.set(0, 0, zPos);
      torii.scale.set(scale, scale, scale);

      const pLeft = new THREE.Mesh(sharedToriiPillarGeo, sharedToriiPillarMat);
      pLeft.position.set(-5.6, 3.2, 0);
      torii.add(pLeft);

      const pRight = new THREE.Mesh(sharedToriiPillarGeo, sharedToriiPillarMat);
      pRight.position.set(5.6, 3.2, 0);
      torii.add(pRight);

      const topBeam = new THREE.Mesh(sharedTopBeamGeo, sharedToriiPillarMat);
      topBeam.position.set(0, 6.2, 0);
      torii.add(topBeam);

      const roofCap = new THREE.Mesh(sharedRoofCapGeo, sharedToriiTopMat);
      roofCap.position.set(0, 6.5, 0);
      torii.add(roofCap);

      const subBeam = new THREE.Mesh(sharedSubBeamGeo, sharedToriiPillarMat);
      subBeam.position.set(0, 5.2, 0);
      torii.add(subBeam);

      return torii;
    };

    // ==========================================
    // LANDING & SLIDING DUST PARTICLE POOL
    // ==========================================
    const dustCount = 24;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustVel: { x: number; y: number; z: number; life: number }[] = [];

    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3 + 0] = 0;
      dustPos[i * 3 + 1] = -10; // hidden below ground initially
      dustPos[i * 3 + 2] = 0;
      dustVel.push({ x: 0, y: 0, z: 0, life: 0 });
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffe0b2,
      size: 0.28,
      transparent: true,
      opacity: 0.75,
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);

    const emitDustBurst = (originX: number, count = 12) => {
      let spawned = 0;
      for (let i = 0; i < dustCount && spawned < count; i++) {
        if (dustVel[i].life <= 0) {
          dustPos[i * 3 + 0] = originX + (Math.random() - 0.5) * 0.8;
          dustPos[i * 3 + 1] = 0.12 + Math.random() * 0.18;
          dustPos[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
          dustVel[i].x = (Math.random() - 0.5) * 3.2;
          dustVel[i].y = Math.random() * 1.8 + 0.5;
          dustVel[i].z = Math.random() * 3.5 + 1.5;
          dustVel[i].life = 0.42;
          spawned++;
        }
      }
      dustGeo.attributes.position.needsUpdate = true;
    };

    // ==========================================
    // SHARED OBSTACLE & COLLECTIBLE GEOMETRIES
    // ==========================================
    // 1. JUMP Obstacles: Lantern, Bamboo Hurdle, Void Pit
    const sharedLanternGeo = new THREE.SphereGeometry(0.55, 10, 10);
    sharedLanternGeo.scale(1, 1.3, 1);
    const sharedLanternMat = new THREE.MeshStandardMaterial({
      color: 0xff1744,
      emissive: 0xff5252,
      emissiveIntensity: 0.75,
    });
    const sharedLanternCapGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 6);
    const sharedLanternCapMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    const sharedBambooBarGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6);
    sharedBambooBarGeo.rotateZ(Math.PI / 2);
    const sharedBambooPostGeo = new THREE.CylinderGeometry(0.09, 0.1, 1.05, 6);
    const sharedBambooMat = new THREE.MeshStandardMaterial({
      color: 0x4caf50,
      emissive: 0x1b5e20,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    });

    const sharedPitVoidGeo = new THREE.CylinderGeometry(1.05, 0.85, 0.14, 12);
    const sharedPitVoidMat = new THREE.MeshBasicMaterial({ color: 0x050014 });
    const sharedPitRimGeo = new THREE.TorusGeometry(1.02, 0.1, 6, 16);
    sharedPitRimGeo.rotateX(Math.PI / 2);
    const sharedPitRimMat = new THREE.MeshStandardMaterial({
      color: 0xd500f9,
      emissive: 0xaa00ff,
      emissiveIntensity: 0.85,
    });

    // 2. SLIDE Obstacles: Shimenawa, Wooden Beam, Low Gate
    const sharedRopeGeo = new THREE.CylinderGeometry(0.14, 0.14, 2.4, 6);
    sharedRopeGeo.rotateZ(Math.PI / 2);
    const sharedRopeMat = new THREE.MeshStandardMaterial({ color: 0xffe082, roughness: 0.6 });
    const sharedShideGeo = new THREE.BoxGeometry(0.16, 0.55, 0.05);
    const sharedShideMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    const sharedBeamGeo = new THREE.BoxGeometry(2.35, 0.48, 0.45);
    const sharedBeamSidePostGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.6, 6);
    const sharedWoodMat = new THREE.MeshStandardMaterial({
      color: 0x8d2323,
      roughness: 0.6,
    });
    const sharedCyanPlaqueGeo = new THREE.BoxGeometry(1.1, 0.45, 0.08);
    const sharedCyanPlaqueMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00b8d4,
      emissiveIntensity: 0.7,
    });

    // 3. SWITCH LANE Obstacles: Seal Rock, Fallen Tree, Collapsed Road
    const sharedRockGeo = new THREE.DodecahedronGeometry(0.88);
    const sharedRockMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 });
    const sharedSealGeo = new THREE.BoxGeometry(0.26, 0.48, 0.05);
    const sharedSealMat = new THREE.MeshStandardMaterial({ color: 0xffeb3b, emissive: 0xffc107 });

    const sharedTreeTrunkGeo = new THREE.CylinderGeometry(0.38, 0.48, 2.35, 8);
    sharedTreeTrunkGeo.rotateZ(Math.PI / 2.2);
    const sharedTreeBarkMat = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
    const sharedFoliageGeo = new THREE.DodecahedronGeometry(0.65);
    const sharedFoliageMat = new THREE.MeshStandardMaterial({
      color: 0xf48fb1,
      emissive: 0xec407a,
      emissiveIntensity: 0.3,
    });

    // 4. Collectibles: Magatama Jewel & Spirit Orb
    const sharedMagatamaGeo = new THREE.TorusGeometry(0.28, 0.1, 8, 16, Math.PI * 1.45);
    const sharedMagatamaMat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00c853,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const sharedOrbGeo = new THREE.OctahedronGeometry(0.32, 1);
    const sharedOrbMat = new THREE.MeshStandardMaterial({
      color: 0xffd740,
      emissive: 0xffab00,
      emissiveIntensity: 0.9,
      roughness: 0.15,
    });

    // 5. Celestial Aerial Geometries & Materials (Yatagarasu in the Sky)
    // Low: Storm Thundercloud + Sun Lightning Core (JUMP - Bay cao)
    const sharedAirCloudPuffGeo = new THREE.SphereGeometry(0.72, 8, 8);
    sharedAirCloudPuffGeo.scale(1.5, 0.75, 1.2);
    const sharedAirCloudPuffCenterGeo = new THREE.SphereGeometry(0.92, 8, 8);
    sharedAirCloudPuffCenterGeo.scale(1.4, 0.85, 1.3);
    const sharedAirStormCloudMat = new THREE.MeshStandardMaterial({
      color: 0x1a237e,
      emissive: 0x303f9f,
      emissiveIntensity: 0.65,
      roughness: 0.8,
    });
    const sharedAirSunOrbGeo = new THREE.OctahedronGeometry(0.42, 1);
    const sharedAirSunOrbMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffab00,
      emissiveIntensity: 1.6,
      roughness: 0.15,
    });
    const sharedAirShideGeo = new THREE.BoxGeometry(0.2, 0.65, 0.05);
    const sharedAirShideMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff59d,
      emissiveIntensity: 0.8,
    });

    // High: Celestial Shimenawa Arch & Dangling Shide Charms (SLIDE - Bổ nhào)
    const sharedAirRopeGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.8, 8);
    sharedAirRopeGeo.rotateZ(Math.PI / 2);
    const sharedAirRopeMat = new THREE.MeshStandardMaterial({
      color: 0xffe082,
      emissive: 0xffb300,
      emissiveIntensity: 0.85,
      roughness: 0.5,
    });
    const sharedAirShideLongGeo = new THREE.BoxGeometry(0.24, 0.95, 0.04);
    const sharedAirSunCrestGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 12);
    sharedAirSunCrestGeo.rotateX(Math.PI / 2);
    const sharedAirSunCrestMat = new THREE.MeshStandardMaterial({
      color: 0xd50000,
      emissive: 0xff1744,
      emissiveIntensity: 1.4,
    });

    // Full: Celestial Lightning Crystal Monolith & Sealing Rings (SWITCH_LANE - Đổi làn)
    const sharedAirObeliskGeo = new THREE.CylinderGeometry(0.55, 0.78, 5.2, 6);
    const sharedAirObeliskMat = new THREE.MeshStandardMaterial({
      color: 0x1b1b1b,
      emissive: 0xd50000,
      emissiveIntensity: 1.25,
      roughness: 0.25,
    });
    const sharedAirRingGeo = new THREE.TorusGeometry(1.15, 0.07, 8, 24);
    const sharedAirRingMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffab00,
      emissiveIntensity: 1.4,
    });
    const sharedAirSealGeo = new THREE.BoxGeometry(0.42, 0.85, 0.08);
    const sharedAirSealMat = new THREE.MeshStandardMaterial({
      color: 0xffeb3b,
      emissive: 0xffc107,
      emissiveIntensity: 1.2,
    });

    const activeObstacles: ActiveObstacle[] = [];
    const activeCollectibles: ActiveCollectible[] = [];

    const spawnObstacleMesh = (type: ObstacleType, lane: 0 | 1 | 2, z: number): ActiveObstacle => {
      const group = new THREE.Group();
      group.position.set(LANE_X[lane], isFlyingBeast ? FLIGHT_BASE_Y : 0, z);

      if (isFlyingBeast) {
        const action = getObstacleAction(type);
        if (action === "JUMP") {
          // Lôi Vân Bão Tố — Mây sấm ánh dương rực sáng ở tầng thấp (cần Bay cao để vượt qua)
          const cloudPuff1 = new THREE.Mesh(sharedAirCloudPuffGeo, sharedAirStormCloudMat);
          cloudPuff1.position.set(-0.55, -0.75, 0);
          group.add(cloudPuff1);

          const cloudPuff2 = new THREE.Mesh(sharedAirCloudPuffGeo, sharedAirStormCloudMat);
          cloudPuff2.position.set(0.55, -0.75, 0.1);
          group.add(cloudPuff2);

          const cloudPuffCenter = new THREE.Mesh(sharedAirCloudPuffCenterGeo, sharedAirStormCloudMat);
          cloudPuffCenter.position.set(0, -0.62, -0.05);
          group.add(cloudPuffCenter);

          // Lôi Cầu Ánh Dương trung tâm phát sáng chói lọi
          const sunOrb = new THREE.Mesh(sharedAirSunOrbGeo, sharedAirSunOrbMat);
          sunOrb.position.set(0, -0.42, 0);
          group.add(sunOrb);

          // Bùa chú Shide phát quang 2 bên
          [-0.75, 0.75].forEach((sx) => {
            const shide = new THREE.Mesh(sharedAirShideGeo, sharedAirShideMat);
            shide.position.set(sx, -0.65, 0.15);
            group.add(shide);
          });
        } else if (action === "SLIDE") {
          // Xà Phong Ấn Thiên Giới — Dây thừng Shimenawa vàng kim và bùa chú treo lơ lửng trên cao (cần Bổ nhào để luồn qua)
          const rope = new THREE.Mesh(sharedAirRopeGeo, sharedAirRopeMat);
          rope.position.set(0, 1.25, 0);
          group.add(rope);

          const sunCrest = new THREE.Mesh(sharedAirSunCrestGeo, sharedAirSunCrestMat);
          sunCrest.position.set(0, 1.25, -0.1);
          group.add(sunCrest);

          [-0.75, 0, 0.75].forEach((sx) => {
            const shide = new THREE.Mesh(sharedAirShideLongGeo, sharedAirShideMat);
            shide.position.set(sx, 0.62, 0);
            group.add(shide);
          });
        } else {
          // SWITCH_LANE: Trụ Phong Ấn Lôi Giới — Cột pha lê lôi đình chặn toàn bộ làn bay (cần Đổi làn)
          const obelisk = new THREE.Mesh(sharedAirObeliskGeo, sharedAirObeliskMat);
          obelisk.position.set(0, 0, 0);
          group.add(obelisk);

          const ringTop = new THREE.Mesh(sharedAirRingGeo, sharedAirRingMat);
          ringTop.position.set(0, 0.9, 0);
          ringTop.rotation.x = Math.PI / 4;
          group.add(ringTop);

          const ringBottom = new THREE.Mesh(sharedAirRingGeo, sharedAirRingMat);
          ringBottom.position.set(0, -0.9, 0);
          ringBottom.rotation.x = -Math.PI / 4;
          group.add(ringBottom);

          const seal = new THREE.Mesh(sharedAirSealGeo, sharedAirSealMat);
          seal.position.set(0, 0, -0.75);
          group.add(seal);
        }

        scene.add(group);
        return { mesh: group, type, lane, z, cleared: false };
      }

      // Terrestrial Spirit Beasts (chạy trên mặt đất)
      if (type === "LANTERN_LOW") {
        const mesh = new THREE.Mesh(sharedLanternGeo, sharedLanternMat);
        mesh.position.set(0, 0.68, 0);
        mesh.castShadow = true;
        group.add(mesh);

        const cap = new THREE.Mesh(sharedLanternCapGeo, sharedLanternCapMat);
        cap.position.set(0, 1.42, 0);
        group.add(cap);
      } else if (type === "BAMBOO_HURDLE") {
        [-0.95, 0.95].forEach((px) => {
          const post = new THREE.Mesh(sharedBambooPostGeo, sharedBambooMat);
          post.position.set(px, 0.52, 0);
          group.add(post);
        });
        [0.42, 0.85].forEach((py) => {
          const bar = new THREE.Mesh(sharedBambooBarGeo, sharedBambooMat);
          bar.position.set(0, py, 0);
          group.add(bar);
        });
        const seal = new THREE.Mesh(sharedSealGeo, sharedSealMat);
        seal.position.set(0, 0.65, -0.1);
        group.add(seal);
      } else if (type === "VOID_PIT") {
        const pit = new THREE.Mesh(sharedPitVoidGeo, sharedPitVoidMat);
        pit.position.set(0, 0.04, 0);
        group.add(pit);

        const rim = new THREE.Mesh(sharedPitRimGeo, sharedPitRimMat);
        rim.position.set(0, 0.12, 0);
        group.add(rim);
      } else if (type === "SHIMENAWA_HIGH") {
        const ropeMesh = new THREE.Mesh(sharedRopeGeo, sharedRopeMat);
        ropeMesh.position.set(0, 2.05, 0);
        group.add(ropeMesh);

        [-0.6, 0, 0.6].forEach((sx) => {
          const shide = new THREE.Mesh(sharedShideGeo, sharedShideMat);
          shide.position.set(sx, 1.65, 0);
          group.add(shide);
        });
      } else if (type === "WOODEN_BEAM") {
        [-1.08, 1.08].forEach((px) => {
          const post = new THREE.Mesh(sharedBeamSidePostGeo, sharedWoodMat);
          post.position.set(px, 1.3, 0);
          group.add(post);
        });
        const beam = new THREE.Mesh(sharedBeamGeo, sharedWoodMat);
        beam.position.set(0, 1.88, 0);
        beam.castShadow = true;
        group.add(beam);

        const seal = new THREE.Mesh(sharedSealGeo, sharedSealMat);
        seal.position.set(0, 1.52, -0.24);
        group.add(seal);
      } else if (type === "LOW_GATE") {
        [-1.08, 1.08].forEach((px) => {
          const post = new THREE.Mesh(sharedBeamSidePostGeo, sharedToriiPillarMat);
          post.position.set(px, 1.3, 0);
          group.add(post);
        });
        const topBar = new THREE.Mesh(sharedBeamGeo, sharedToriiPillarMat);
        topBar.position.set(0, 2.05, 0);
        group.add(topBar);

        const plaque = new THREE.Mesh(sharedCyanPlaqueGeo, sharedCyanPlaqueMat);
        plaque.position.set(0, 1.56, 0);
        group.add(plaque);
      } else if (type === "FALLEN_TREE") {
        const trunk = new THREE.Mesh(sharedTreeTrunkGeo, sharedTreeBarkMat);
        trunk.position.set(0, 1.05, 0);
        trunk.castShadow = true;
        group.add(trunk);

        const crown = new THREE.Mesh(sharedFoliageGeo, sharedFoliageMat);
        crown.position.set(0.55, 1.65, 0);
        group.add(crown);
      } else if (type === "COLLAPSED_ROAD") {
        const rockL = new THREE.Mesh(sharedRockGeo, sharedRockMat);
        rockL.position.set(-0.4, 0.85, 0);
        rockL.scale.set(0.85, 1.35, 0.85);
        group.add(rockL);

        const rockR = new THREE.Mesh(sharedRockGeo, sharedRockMat);
        rockR.position.set(0.42, 1.1, 0.15);
        rockR.scale.set(0.9, 1.55, 0.85);
        group.add(rockR);

        const rim = new THREE.Mesh(sharedPitRimGeo, sharedPitRimMat);
        rim.position.set(0, 0.15, 0);
        group.add(rim);
      } else {
        // SEAL_ROCK (Full-lane tall sealing monolith)
        const rock = new THREE.Mesh(sharedRockGeo, sharedRockMat);
        rock.position.set(0, 1.05, 0);
        rock.scale.set(1.05, 1.45, 1.0);
        rock.castShadow = true;
        group.add(rock);

        const seal = new THREE.Mesh(sharedSealGeo, sharedSealMat);
        seal.position.set(0, 1.15, -0.78);
        group.add(seal);
      }

      obstacleSkin.decorate(group, type);
      scene.add(group);
      return { mesh: group, type, lane, z, cleared: false };
    };

    const spawnCollectibleMesh = (
      type: CollectibleType,
      lane: 0 | 1 | 2,
      y: number,
      z: number,
      points: number
    ): ActiveCollectible => {
      const group = new THREE.Group();
      const finalY = isFlyingBeast ? y + FLIGHT_BASE_Y : y;
      group.position.set(LANE_X[lane], finalY, z);

      if (type === "MAGATAMA_JEWEL") {
        const jewel = new THREE.Mesh(sharedMagatamaGeo, sharedMagatamaMat);
        group.add(jewel);
      } else {
        const orb = new THREE.Mesh(sharedOrbGeo, sharedOrbMat);
        group.add(orb);
      }

      scene.add(group);
      return { mesh: group, type, lane, y: finalY, z, points, collected: false };
    };

    const populateTrackSegment = (startZ: number, gateZ: number, currentSpeed: number) => {
      const segment = generateTrackSegment(startZ, gateZ, currentSpeed);
      segment.obstacles.forEach((spec) => {
        activeObstacles.push(spawnObstacleMesh(spec.type, spec.lane, spec.z));
      });
      segment.collectibles.forEach((col) => {
        activeCollectibles.push(
          spawnCollectibleMesh(col.type, col.lane, col.y, col.z, col.points)
        );
      });
    };

    // Helper: Explicitly dispose a Question Gate and its textures
    const disposeSingleGate = (gate: ActiveGate) => {
      scene.remove(gate.group);
      gate.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => disposeSingleMaterial(m));
            } else {
              disposeSingleMaterial(mesh.material);
            }
          }
        }
      });
      while (gate.group.children.length > 0) {
        gate.group.remove(gate.group.children[0]);
      }
    };

    // Helper: Create 3D Question Gate (512x256 high-contrast crisp Japanese lacquer signs)
    const createQuestionGate = (qIndex: number, z: number): ActiveGate => {
      const gateGroup = new THREE.Group();
      const gateY = isFlyingBeast ? FLIGHT_BASE_Y : 0;
      gateGroup.position.set(0, gateY, z);

      const q = state.questions[qIndex];
      const signMeshes: THREE.Mesh[] = [];

      // Grand Torii Frame (Celestial Sky Torii vs Terrestrial Torii)
      if (isFlyingBeast) {
        // CỔNG TRỜI THIÊN GIỚI (Celestial Sky Torii Gate)
        // 1. Cột Thiên Đình vươn từ tầng mây sâu bên dưới lên tận trời cao
        const skyPillarGeo = new THREE.CylinderGeometry(0.32, 0.38, 12.0, 8);
        const skyPillarMat = new THREE.MeshStandardMaterial({
          color: 0xc4202e,
          roughness: 0.35,
          emissive: 0x5c0911,
          emissiveIntensity: 0.4,
        });
        [-6.5, 6.5].forEach((px) => {
          const pillar = new THREE.Mesh(skyPillarGeo, skyPillarMat);
          pillar.position.set(px, 1.0, 0); // spans Y = -5.0m to +7.0m in gate space
          gateGroup.add(pillar);

          // Bệ mây thần linh bồng bềnh nâng đỡ chân cột
          const baseCloudGeo = new THREE.SphereGeometry(1.4, 8, 8);
          baseCloudGeo.scale(1.5, 0.6, 1.5);
          const baseCloud = new THREE.Mesh(
            baseCloudGeo,
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              roughness: 0.9,
              transparent: true,
              opacity: 0.85,
            })
          );
          baseCloud.position.set(px, -4.5, 0);
          gateGroup.add(baseCloud);
        });

        // 2. Xà Cổng Trời đặt trên cao tít (Y = +4.3m & +5.2m), hoàn toàn không che khuất bảng chữ hay lối bay
        const skyTopBeamGeo = new THREE.BoxGeometry(15.2, 0.65, 0.85);
        const skyTopBeam = new THREE.Mesh(skyTopBeamGeo, skyPillarMat);
        skyTopBeam.position.set(0, 5.2, 0);
        gateGroup.add(skyTopBeam);

        const skyRoofCapGeo = new THREE.BoxGeometry(16.0, 0.22, 1.05);
        const skyRoofCap = new THREE.Mesh(
          skyRoofCapGeo,
          new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 })
        );
        skyRoofCap.position.set(0, 5.6, 0);
        gateGroup.add(skyRoofCap);

        const skySubBeamGeo = new THREE.BoxGeometry(13.6, 0.42, 0.5);
        const skySubBeam = new THREE.Mesh(skySubBeamGeo, skyPillarMat);
        skySubBeam.position.set(0, 4.3, 0);
        gateGroup.add(skySubBeam);

        // Đèn lồng mặt trời treo 2 bên cổng
        [-6.5, 6.5].forEach((lx) => {
          const lantern = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 10, 10),
            new THREE.MeshStandardMaterial({
              color: 0xffd700,
              emissive: 0xffab00,
              emissiveIntensity: 1.4,
            })
          );
          lantern.position.set(lx, 3.2, 0);
          gateGroup.add(lantern);
        });
      } else {
        const torii = createSharedToriiGate(0, 1.15);
        gateGroup.add(torii);
      }

      // Create 3 glowing arches & answer tablets above each lane
      const arches: { mesh: THREE.Mesh; laneIdx: number; correctLane: number }[] = [];
      LANE_X.forEach((laneX, laneIdx) => {
        const isHint = showGateHintRef.current && laneIdx === q.correctLane;
        const frameGeo = isFlyingBeast
          ? new THREE.TorusGeometry(1.65, 0.1, 8, 32, Math.PI * 2)
          : new THREE.TorusGeometry(1.35, 0.08, 6, 16, Math.PI);
        const frameMat = new THREE.MeshBasicMaterial({
          color: isHint ? 0xffea00 : 0x00e5ff,
          transparent: true,
          opacity: 0.9,
        });
        const frame = new THREE.Mesh(frameGeo, frameMat);
        frame.position.set(laneX, 0, 0);
        gateGroup.add(frame);
        arches.push({ mesh: frame, laneIdx, correctLane: q.correctLane });

        // Canvas Texture (512 x 256) for crisp text at 1/4 the memory of 1024x512
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 0, 256);
          grad.addColorStop(0, "rgba(10, 12, 24, 0.98)");
          grad.addColorStop(1, "rgba(22, 16, 36, 0.98)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(8, 8, 496, 240, 24);
          ctx.fill();

          ctx.strokeStyle = isHint ? "#ffd700" : showGateHintRef.current ? "#ff5252" : "#38bdf8";
          ctx.lineWidth = 8;
          ctx.stroke();

          const laneLetter = laneIdx === 0 ? "A" : laneIdx === 1 ? "B" : "C";
          const kanjiPos = laneIdx === 0 ? "左" : laneIdx === 1 ? "中" : "右";

          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 26px 'Be Vietnam Pro', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const gateWord = isEn ? "GATE" : isZh ? "鸟居" : isKo ? "관문" : "CỔNG";
          ctx.fillText(`⛩️ ${gateWord} ${laneLetter} [${kanjiPos}]`, 256, 50);

          ctx.strokeStyle = "rgba(255, 215, 0, 0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(120, 75);
          ctx.lineTo(392, 75);
          ctx.stroke();

          const text = q.options[laneIdx] || `Đáp án ${laneIdx + 1}`;
          ctx.fillStyle = "#ffffff";
          ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
          ctx.shadowBlur = 8;

          if (text.length > 24) {
            ctx.font = "bold 20px 'Be Vietnam Pro', sans-serif";
            const words = text.split(" ");
            const mid = Math.ceil(words.length / 2);
            const line1 = words.slice(0, mid).join(" ");
            const line2 = words.slice(mid).join(" ");
            ctx.fillText(line1, 256, 134);
            ctx.fillText(line2, 256, 164);
          } else if (text.length > 18) {
            ctx.font = "bold 25px 'Be Vietnam Pro', sans-serif";
            ctx.fillText(text, 256, 150);
          } else if (text.length > 12) {
            ctx.font = "bold 32px 'Be Vietnam Pro', sans-serif";
            ctx.fillText(text, 256, 150);
          } else {
            ctx.font = "bold 42px 'Be Vietnam Pro', sans-serif";
            ctx.fillText(text, 256, 150);
          }

          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffb74d";
          ctx.font = "bold 18px sans-serif";
          const choiceSub = isEn ? "KNOWLEDGE GATE" : isZh ? "智慧之门" : isKo ? "지혜의 문" : "LỰA CHỌN TRI THỨC";
          ctx.fillText(choiceSub, 256, 215);
        }

        const texture = new THREE.CanvasTexture(canvas);
        const signGeo = new THREE.PlaneGeometry(2.4, 1.2);
        const signMat = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
        });
        const signMesh = new THREE.Mesh(signGeo, signMat);
        const signY = isFlyingBeast ? 2.45 : 3.6;
        signMesh.position.set(laneX, signY, 0);
        signMesh.rotation.x = isFlyingBeast ? -0.1 : -0.06;
        gateGroup.add(signMesh);
        signMeshes.push(signMesh);
      });

      scene.add(gateGroup);
      return { group: gateGroup, questionIndex: qIndex, z, cleared: false, signMeshes, arches };
    };

    // Initial Gate & Structured Cluster Obstacles
    const initialGateZ = beast.bonusType === "EXTRA_TIME" ? -112 : -100;
    let activeGate: ActiveGate | null = createQuestionGate(0, initialGateZ);
    activeGateRef.current = activeGate;
    populateTrackSegment(-34, initialGateZ, initialBaseSpeed);

    // ==========================================
    // 60FPS ANIMATION LOOP
    // ==========================================
    let lastTime = performance.now();
    let animFrameId: number;

    const gameLoop = (time: number) => {
      if (state.isOver) {
        renderer.render(scene, camera);
        return;
      }

      animFrameId = requestAnimationFrame(gameLoop);

      if (state.isPaused) {
        renderer.render(scene, camera);
        return;
      }

      const dt = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;

      state.timeSinceLaneSwitch += dt;

      // Invulnerability blink
      if (state.invulnerableTimer > 0) {
        state.invulnerableTimer -= dt;
        playerGroup.visible = Math.floor(state.invulnerableTimer * 10) % 2 === 0;
      } else {
        playerGroup.visible = true;
      }

      // Smooth speed scaling based on difficulty mode
      let targetSpeed = 14.0;
      if (speedDifficulty === "EASY") {
        targetSpeed = Math.min(
          15.5,
          10.5 + state.currentQuestionIndex * 0.65 + Math.min(state.combo * 0.18, 1.8)
        );
      } else if (speedDifficulty === "CUSTOM") {
        targetSpeed = Math.max(8.0, Math.min(25.0, customSpeed || 14.0));
      } else {
        // MEDIUM (default): Tốc độ ngày càng nhanh
        targetSpeed = Math.min(
          21.0,
          14.0 + state.currentQuestionIndex * 0.9 + Math.min(state.combo * 0.25, 2.4)
        );
      }

      // Smooth deceleration when approaching the 3 question rings
      const isApproachingGate = Boolean(activeGate && !activeGate.cleared && activeGate.z >= -42 && activeGate.z <= 0.5);
      if (isApproachingGate) {
        // Slow down to ~45% of running speed (min 5.5 m/s, max 7.5 m/s) to let player read & select lane comfortably
        const readingSpeed = Math.max(5.5, Math.min(7.5, targetSpeed * 0.45));
        state.currentSpeed += (readingSpeed - state.currentSpeed) * Math.min(dt * 5.0, 1.0);
      } else {
        // Normal running & dodging speed: smoothly return to normal speed
        state.currentSpeed += (targetSpeed - state.currentSpeed) * Math.min(dt * 6.0, 1.0);
      }

      // Distance kept in ref without triggering React re-renders!
      state.distance += state.currentSpeed * dt;

      // Player Lane Interpolation
      state.currentX += (state.targetX - state.currentX) * Math.min(dt * 16, 1.0);
      playerGroup.position.x = state.currentX;
      lanternGlow.position.x = state.currentX;

      // Decay stumble, cheer, and camera shake timers
      if (state.stumbleTimer > 0) {
        state.stumbleTimer = Math.max(0, state.stumbleTimer - dt * 2.2);
      }
      if (state.cheerTimer > 0) {
        state.cheerTimer = Math.max(0, state.cheerTimer - dt * 2.4);
      }
      if (state.shakeTimer > 0) {
        state.shakeTimer = Math.max(0, state.shakeTimer - dt * 3.5);
      }

      // Dynamic camera follow + clear sightline forward
      if (!reducedMotionRef.current) {
        const shakeOffset = state.shakeTimer > 0 ? Math.sin(time * 0.065) * 0.16 * state.shakeTimer : 0;
        camera.position.x += (state.currentX * 0.35 + shakeOffset - camera.position.x) * Math.min(dt * 8, 1.0);
        camera.position.y = cameraBase.y + (state.shakeTimer > 0 ? Math.cos(time * 0.08) * 0.08 * state.shakeTimer : 0);
        camera.position.z = cameraBase.z;
        camera.lookAt(camera.position.x * 0.45, cameraBase.lookAtY, cameraBase.lookAtZ);
      } else {
        camera.position.x = 0;
        camera.position.y = cameraBase.y;
        camera.position.z = cameraBase.z;
        camera.lookAt(0, cameraBase.lookAtY, cameraBase.lookAtZ);
      }

      // Jumping & Sliding Physics (Airborne Flight vs Terrestrial Gallop)
      if (isFlyingBeast) {
        if (state.isJumping) {
          state.jumpTimer += dt;
          const jumpProgress = state.jumpTimer / JUMP_DURATION;
          if (jumpProgress >= 1.0) {
            state.isJumping = false;
            state.playerY = FLIGHT_BASE_Y;
            state.landingSquash = 0.5;
            yokaiSound.playLandDust();
          } else {
            // Bay vút lên chín tầng mây (lên đến 8.5 + 2.8 = 11.3m) né Lôi Vân
            state.playerY = FLIGHT_BASE_Y + Math.sin(jumpProgress * Math.PI) * 2.8;
          }
        } else if (state.isSliding) {
          state.slideTimer += dt;
          const slideProgress = state.slideTimer / SLIDE_DURATION;
          if (slideProgress >= 1.0) {
            state.isSliding = false;
            state.playerY = FLIGHT_BASE_Y;
          } else {
            // Bổ nhào luồn xuống dưới xà mây & dây Shimenawa (hạ xuống 8.5 - 2.5 = 6.0m)
            state.playerY = FLIGHT_BASE_Y - Math.sin(slideProgress * Math.PI) * 2.5;
          }
        } else {
          // Bay lượn bồng bềnh êm ái trên không
          state.playerY = FLIGHT_BASE_Y + Math.sin(time * 0.0038) * 0.15;
        }
      } else {
        if (state.isJumping) {
          state.jumpTimer += dt;
          const jumpProgress = state.jumpTimer / JUMP_DURATION;
          if (jumpProgress >= 1.0) {
            state.isJumping = false;
            state.playerY = 0;
            state.landingSquash = 1.0;
            yokaiSound.playLandDust();
            if (!reducedMotionRef.current) {
              emitDustBurst(state.currentX, 10);
            }
          } else {
            state.playerY = Math.sin(jumpProgress * Math.PI) * JUMP_HEIGHT;
          }
        } else {
          state.playerY = 0;
        }

        if (state.isSliding) {
          state.slideTimer += dt;
          const slideProgress = state.slideTimer / SLIDE_DURATION;
          if (Math.random() < 0.35 && !reducedMotionRef.current) {
            emitDustBurst(state.currentX, 1);
          }
          if (slideProgress >= 1.0) {
            state.isSliding = false;
          }
        }
      }

      // Decay landing squash
      if (state.landingSquash > 0) {
        state.landingSquash = Math.max(0, state.landingSquash - dt * 4.5);
      }

      playerGroup.position.y = state.playerY;

      // Articulated 3D Spirit Beast Motion (including run limbs, jump, slide, stumble, cheer, victory)
      animateBeastMotion(beastBundle, time, {
        speed: state.currentSpeed,
        currentX: state.currentX,
        targetX: state.targetX,
        playerY: state.playerY,
        isJumping: state.isJumping,
        isSliding: state.isSliding,
        landingSquash: state.landingSquash,
        stumble: state.stumbleTimer,
        cheer: state.cheerTimer,
        isVictory: state.isVictoryAnim,
      });

      // Animate Chaser Yōkai Pursuer behind player
      animateChaserYokai(chaserBundle, time, state.currentX, state.hearts, state.combo);

      // Cập nhật môi trường theo map (torii, đèn, cây, đảo nổi, cánh hoa, hiệu ứng riêng)
      scenery.update(dt, state.currentSpeed, time * 0.001, reducedMotionRef.current);

      // Update Dust Particles
      let dustDirty = false;
      for (let i = 0; i < dustCount; i++) {
        if (dustVel[i].life > 0) {
          dustVel[i].life -= dt;
          if (dustVel[i].life <= 0) {
            dustPos[i * 3 + 1] = -10;
          } else {
            dustPos[i * 3 + 0] += dustVel[i].x * dt;
            dustPos[i * 3 + 1] += dustVel[i].y * dt;
            dustPos[i * 3 + 2] += dustVel[i].z * dt;
          }
          dustDirty = true;
        }
      }
      if (dustDirty) {
        dustGeo.attributes.position.needsUpdate = true;
      }

      // Update & Check Collectibles (Magatama Jewels & Spirit Orbs)
      const hasMagnet = beast.bonusType === "MAGNET";
      for (let i = activeCollectibles.length - 1; i >= 0; i--) {
        const col = activeCollectibles[i];
        col.z += state.currentSpeed * dt;
        col.mesh.position.z = col.z;
        col.mesh.rotation.y += dt * 3.2;

        // Magnet pull effect when close
        if (!col.collected && hasMagnet && col.z > -11 && col.z < 1.5) {
          col.mesh.position.x += (state.currentX - col.mesh.position.x) * Math.min(dt * 9, 1.0);
          col.mesh.position.y += (state.playerY + 0.4 - col.mesh.position.y) * Math.min(dt * 9, 1.0);
        }

        if (!col.collected && Math.abs(col.z) < 1.25) {
          const dx = Math.abs(col.mesh.position.x - state.currentX);
          const dy = Math.abs(col.mesh.position.y - (state.playerY + 0.4));
          if (dx < (hasMagnet ? 1.85 : 1.05) && dy < (hasMagnet ? 1.9 : 1.35)) {
            col.collected = true;
            scene.remove(col.mesh);

            const bonusMult =
              beast.bonusType === "MAGNET" && state.hearts === 3
                ? 2
                : beast.bonusType === "COMBO_BONUS"
                ? 1.15
                : 1;
            const gained = Math.round(col.points * bonusMult);
            state.score += gained;
            setScore(state.score);
            yokaiSound.playCollectOrb();
            showQuickActionPopup(
              col.type === "MAGATAMA_JEWEL" ? `🟢 Magatama +${gained}` : `✨ Linh Ngọc +${gained}`,
              "orb"
            );
          }
        }

        if (col.z > 10 || col.collected) {
          scene.remove(col.mesh);
          activeCollectibles.splice(i, 1);
        }
      }

      // Update & Check Obstacles (JUMP, SLIDE, SWITCH_LANE)
      for (let i = activeObstacles.length - 1; i >= 0; i--) {
        const obs = activeObstacles[i];
        obs.z += state.currentSpeed * dt;
        obs.mesh.position.z = obs.z;

        if (!obs.cleared && obs.z >= -0.9 && obs.z <= 0.9) {
          const jumpProg = state.isJumping ? state.jumpTimer / JUMP_DURATION : 0;
          const slideProg = state.isSliding ? state.slideTimer / SLIDE_DURATION : 0;

          const evalRes = evaluateObstacleEncounter(obs.type, obs.lane, {
            lane: state.currentLane,
            playerY: state.playerY,
            flightBaseY: FLIGHT_BASE_Y,
            isJumping: state.isJumping,
            isSliding: state.isSliding,
            jumpProgress: jumpProg,
            slideProgress: slideProg,
            timeSinceLaneSwitch:
              state.lastLane === obs.lane ? state.timeSinceLaneSwitch : undefined,
            isFlying: isFlyingBeast,
          });

          if (evalRes.collided && state.invulnerableTimer <= 0) {
            obs.cleared = true;
            state.invulnerableTimer = INVULNERABLE_TIME;

            const meta = getObstacleMetaLocalized(obs.type, nativeLanguage);

            if (state.hasShield) {
              state.hasShield = false;
              setHasFirstHitShield(false);
              yokaiSound.playHyoshigiClap();
              triggerFlash("gold");
              setFeedbackBanner({
                type: "shield",
                title: isEn
                  ? `🛡️ Shield blocked ${meta.name}!`
                  : isZh
                  ? `🛡️ 神盾挡下 ${meta.name}！`
                  : isKo
                  ? `🛡️ 방패가 ${meta.name}을(를) 방어!`
                  : `🛡️ Khiên Thần chặn ${meta.name}!`,
              });
              safeSetTimeout(() => setFeedbackBanner(null), 1300);
            } else {
              state.hearts -= 1;
              state.combo = 0;
              state.stumbleTimer = 1.0;
              state.shakeTimer = 1.0;
              setHearts(state.hearts);
              setCombo(0);
              yokaiSound.playTaikoHit();
              yokaiSound.playChaserGrowl();
              triggerFlash("red");

              setFeedbackBanner({
                type: "obstacle",
                title: isEn
                  ? `⚠️ Hit ${meta.name} (-1 Heart) • Tip: ${meta.dodgeTip}`
                  : isZh
                  ? `⚠️ 撞上 ${meta.name} (-1 心) • 提示: ${meta.dodgeTip}`
                  : isKo
                  ? `⚠️ ${meta.name} 충돌 (-1 하트) • 팁: ${meta.dodgeTip}`
                  : `⚠️ Va ${meta.name} (-1 Tim) • Hãy ${meta.dodgeTip}`,
              });
              safeSetTimeout(() => setFeedbackBanner(null), 1400);

              if (state.hearts <= 0) {
                state.isOver = true;
                setIsGameOver(true);
                cancelAnimationFrame(animFrameId);
                if (!hasReportedFinishRef.current) {
                  hasReportedFinishRef.current = true;
                  yokaiSound.playDefeat();
                  onFinishGameRef.current({
                    zoneId: zone.id,
                    level: zone.level,
                    beastId: beast.id,
                    score: state.score,
                    distance: Math.floor(state.distance),
                    maxCombo: state.maxCombo,
                    correctCount: state.answeredQuestions.filter((q) => q.isCorrect).length,
                    wrongCount: state.answeredQuestions.filter((q) => !q.isCorrect).length,
                    heartsRemaining: 0,
                    isVictory: false,
                    isPractice,
                    answeredQuestions: state.answeredQuestions,
                  });
                }
                return;
              }
            }
          } else if (evalRes.avoided && (obs.lane === state.currentLane || evalRes.perfectDodge)) {
            obs.cleared = true;
            if (evalRes.perfectDodge) {
              const dodgePoints = beast.bonusType === "COMBO_BONUS" ? 115 : 100;
              state.score += dodgePoints;
              state.combo += 1;
              state.maxCombo = Math.max(state.maxCombo, state.combo);
              setScore(state.score);
              setCombo(state.combo);
              setMaxCombo(state.maxCombo);
              yokaiSound.playPerfectDodge();
              const dodgeMsg = isEn ? `⚡ PERFECT DODGE! +${dodgePoints}` : isZh ? `⚡ 极限闪避! +${dodgePoints}` : isKo ? `⚡ 완벽 회피! +${dodgePoints}` : `⚡ NÉ CHUẨN! +${dodgePoints}`; showQuickActionPopup(dodgeMsg, "perfect");
            }
          }
        }

        // Clean up obstacle when behind camera
        if (obs.z > 12) {
          scene.remove(obs.mesh);
          activeObstacles.splice(i, 1);
        }
      }

      // Update & Check Question Gate
      if (activeGate) {
        activeGate.z += state.currentSpeed * dt;
        activeGate.group.position.z = activeGate.z;

        if (activeGate.z > -50 && activeGate.z < -47) {
          yokaiSound.playHyoshigiClap();
        }

        // Gate Crossing
        if (!activeGate.cleared && activeGate.z >= -0.5) {
          activeGate.cleared = true;
          const currentQ = state.questions[activeGate.questionIndex];
          const isCorrect = state.currentLane === currentQ.correctLane;

          state.answeredQuestions.push({
            question: currentQ,
            chosenLane: state.currentLane,
            isCorrect,
            timeMs: 3000,
          });

          const chosenGateLetter = state.currentLane === 0 ? "A" : state.currentLane === 1 ? "B" : "C";
          const correctGateLetter =
            currentQ.correctLane === 0 ? "A" : currentQ.correctLane === 1 ? "B" : "C";

          if (isCorrect) {
            state.combo += 1;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
            state.cheerTimer = 1.0;
            const multiplier = state.combo >= 5 ? 3 : state.combo >= 3 ? 2 : 1;
            const beastComboMult = beast.bonusType === "COMBO_BONUS" ? 1.15 : 1;
            const points = Math.round(150 * multiplier * beastComboMult);
            state.score += points;

            setScore(state.score);
            setCombo(state.combo);
            setMaxCombo(state.maxCombo);
            yokaiSound.playCorrectGate();
            triggerFlash("gold");

            setFeedbackBanner({
              type: "correct_gate",
              title: isEn
                ? `✨ Correct Gate ${chosenGateLetter} (+${points} PTS) • ${currentQ.options[currentQ.correctLane]}`
                : isZh
                ? `✨ 答对鸟居 ${chosenGateLetter} (+${points} PTS) • ${currentQ.options[currentQ.correctLane]}`
                : isKo
                ? `✨ 정답 관문 ${chosenGateLetter} (+${points} PTS) • ${currentQ.options[currentQ.correctLane]}`
                : `✨ Đúng Cổng ${chosenGateLetter} (+${points} PTS) • ${currentQ.options[currentQ.correctLane]}`,
            });
            safeSetTimeout(() => setFeedbackBanner(null), 1350);
          } else {
            state.combo = 0;
            state.hearts -= 1;
            state.stumbleTimer = 1.0;
            state.shakeTimer = 1.0;
            setCombo(0);
            setHearts(state.hearts);
            yokaiSound.playTaikoHit();
            yokaiSound.playChaserGrowl();
            triggerFlash("red");

            setFeedbackBanner({
              type: "wrong_gate",
              title: isEn
                ? `❌ Wrong Gate ${chosenGateLetter} (-1 Heart) • Correct: ${correctGateLetter} (${currentQ.options[currentQ.correctLane]})`
                : isZh
                ? `❌ 选错鸟居 ${chosenGateLetter} (-1 心) • 正确: ${correctGateLetter} (${currentQ.options[currentQ.correctLane]})`
                : isKo
                ? `❌ 오답 관문 ${chosenGateLetter} (-1 하트) • 정답: ${correctGateLetter} (${currentQ.options[currentQ.correctLane]})`
                : `❌ Sai Cổng ${chosenGateLetter} (-1 Tim) • Đúng: ${correctGateLetter} (${currentQ.options[currentQ.correctLane]})`,
            });
            safeSetTimeout(() => setFeedbackBanner(null), 1550);

            if (state.hearts <= 0) {
              state.isOver = true;
              setIsGameOver(true);
              cancelAnimationFrame(animFrameId);
              if (!hasReportedFinishRef.current) {
                hasReportedFinishRef.current = true;
                yokaiSound.playDefeat();
                onFinishGameRef.current({
                  zoneId: zone.id,
                  level: zone.level,
                  beastId: beast.id,
                  score: state.score,
                  distance: Math.floor(state.distance),
                  maxCombo: state.maxCombo,
                  correctCount: state.answeredQuestions.filter((q) => q.isCorrect).length,
                  wrongCount: state.answeredQuestions.filter((q) => !q.isCorrect).length,
                  heartsRemaining: 0,
                  isVictory: false,
                  isPractice,
                  answeredQuestions: state.answeredQuestions,
                });
              }
              return;
            }
          }

          // Advance to next question or Victory
          const nextQIdx = activeGate.questionIndex + 1;
          if (nextQIdx >= state.questions.length) {
            state.isVictoryAnim = true;
            animateBeastMotion(beastBundle, time, {
              speed: state.currentSpeed,
              currentX: state.currentX,
              targetX: state.targetX,
              playerY: state.playerY,
              isJumping: false,
              isSliding: false,
              landingSquash: 0,
              isVictory: true,
            });
            state.isOver = true;
            setIsVictory(true);
            cancelAnimationFrame(animFrameId);
            if (!hasReportedFinishRef.current) {
              hasReportedFinishRef.current = true;
              yokaiSound.playVictory();
              onFinishGameRef.current({
                zoneId: zone.id,
                level: zone.level,
                beastId: beast.id,
                score: state.score + 600,
                distance: Math.floor(state.distance),
                maxCombo: state.maxCombo,
                correctCount: state.answeredQuestions.filter((q) => q.isCorrect).length,
                wrongCount: state.answeredQuestions.filter((q) => !q.isCorrect).length,
                heartsRemaining: state.hearts,
                isVictory: true,
                isPractice,
                answeredQuestions: state.answeredQuestions,
              });
            }
            return;
          } else {
            state.currentQuestionIndex = nextQIdx;
            setCurrentQuestionIndex(nextQIdx);
            setActivePrompt(state.questions[nextQIdx]);

            const oldGateToDispose = activeGate;
            safeSetTimeout(() => {
              if (oldGateToDispose) {
                disposeSingleGate(oldGateToDispose);
              }
              const nextGateZ = beast.bonusType === "EXTRA_TIME" ? -115 : -104;
              activeGate = createQuestionGate(nextQIdx, nextGateZ);
              activeGateRef.current = activeGate;
              populateTrackSegment(-30, nextGateZ, state.currentSpeed);
            }, 300);
          }
        }

        // Clean up gate if behind
        if (activeGate && activeGate.z > 18) {
          disposeSingleGate(activeGate);
          activeGate = null;
          activeGateRef.current = null;
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(gameLoop);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      currentAspect = w / h;
      cameraBase = getCameraBase(currentAspect);
      camera.aspect = currentAspect;
      camera.fov = cameraBase.fov;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // ==========================================
    // COMPLETE & THOROUGH THREE.JS DISPOSAL
    // ==========================================
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", handleResize);

      // Cancel all pending timeouts
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];

      // Dispose active gate if still present
      if (activeGate) {
        disposeSingleGate(activeGate);
        activeGate = null;
      }

      // Dispose all shared geometries and materials
      sharedToriiPillarGeo.dispose();
      sharedToriiPillarMat.dispose();
      sharedToriiTopMat.dispose();
      sharedTopBeamGeo.dispose();
      sharedRoofCapGeo.dispose();
      sharedSubBeamGeo.dispose();

      sharedLanternGeo.dispose();
      sharedLanternMat.dispose();
      sharedLanternCapGeo.dispose();
      sharedLanternCapMat.dispose();

      sharedBambooBarGeo.dispose();
      sharedBambooPostGeo.dispose();
      sharedBambooMat.dispose();

      sharedPitVoidGeo.dispose();
      sharedPitVoidMat.dispose();
      sharedPitRimGeo.dispose();
      sharedPitRimMat.dispose();

      sharedRopeGeo.dispose();
      sharedRopeMat.dispose();
      sharedShideGeo.dispose();
      sharedShideMat.dispose();

      sharedBeamGeo.dispose();
      sharedBeamSidePostGeo.dispose();
      sharedWoodMat.dispose();
      sharedCyanPlaqueGeo.dispose();
      sharedCyanPlaqueMat.dispose();

      sharedRockGeo.dispose();
      sharedRockMat.dispose();
      sharedSealGeo.dispose();
      sharedSealMat.dispose();

      sharedTreeTrunkGeo.dispose();
      sharedTreeBarkMat.dispose();
      sharedFoliageGeo.dispose();
      sharedFoliageMat.dispose();

      sharedMagatamaGeo.dispose();
      sharedMagatamaMat.dispose();
      sharedOrbGeo.dispose();
      sharedOrbMat.dispose();

      lineMat.dispose();
      laneLineGeos.forEach((g) => g.dispose());
      dustGeo.dispose();
      dustMat.dispose();

      scenery.dispose();
      obstacleSkin.dispose();

      // Dispose entire scene graph (including beast model parts, chaser, lights, etc.)
      disposeThreeHierarchy(scene);
      activeGateRef.current = null;

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [zone, beast, questions, isPractice, safeSetTimeout, triggerFlash, showQuickActionPopup, customSpeed, isFlyingBeast, speedDifficulty]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full h-full min-h-0 select-none overflow-hidden touch-none bg-[#0d0722] isolate ${
        reducedMotion ? "yk-reduced-fx" : ""
      }`}
    >
      {/* Screen flash impact (subtle edge flash, skipped if reducedMotion) */}
      {!reducedMotion && impactFlash === "red" && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(225,29,72,0.45)_100%)] animate-pulse duration-150" />
      )}
      {!reducedMotion && impactFlash === "gold" && (
        <div className="pointer-events-none absolute inset-0 z-30 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(245,158,11,0.38)_100%)] animate-pulse duration-150" />
      )}

      {/* Speed lines edge effect during high combo */}
      {!reducedMotion && combo >= 3 && (
        <div className="pointer-events-none absolute inset-0 z-10 opacity-30 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(251,191,36,0.35)_100%)]" />
      )}

      {/* TOP IN-GAME HUD — Docked to top edge, compact height so 3D horizon & track are never blocked */}
      <div
        className="yk-ui absolute inset-x-2 sm:inset-x-5 z-20 flex flex-col gap-1 sm:gap-1.5 pointer-events-none"
        style={{ top: "max(0.35rem, env(safe-area-inset-top))" }}
      >
        {/* ROW 1: Compact Status Bar */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Sinh mệnh + trạng thái */}
          <HudChip className="px-2 py-1 sm:px-3 sm:py-1.5">
            <div className="flex items-center gap-0.5" aria-label={`Còn ${hearts} tim`}>
              {[1, 2, 3].map((h) => (
                <HeartIcon key={h} alive={h <= hearts} size={18} />
              ))}
            </div>
            {hasFirstHitShield && (
              <span className="ml-1 text-[9px] sm:text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded-full font-bold border border-teal-300/50">
                🛡️ <span className="hidden sm:inline">Khiên</span>
              </span>
            )}
            {isPractice && (
              <span className="ml-1 text-[9px] sm:text-[10px] bg-teal-400/20 text-teal-200 px-1.5 py-0.5 rounded-full font-bold border border-teal-300/40">
                Tập
              </span>
            )}
            {!showGateHint ? (
              <span
                className="ml-1 text-[9px] sm:text-[10px] bg-rose-500/20 text-rose-200 px-1.5 py-0.5 rounded-full font-bold border border-rose-300/40"
                title="Chế độ Tự suy luận: Cả 3 cổng giống nhau, không có gợi ý vòng vàng"
              >
                🎯 Tự giải
              </span>
            ) : (
              <span
                className="hidden sm:inline-flex ml-1 text-[9px] sm:text-[10px] bg-yellow-400/15 text-yellow-200 px-1.5 py-0.5 rounded-full font-semibold border border-yellow-300/30"
                title="Vòng vàng gợi ý đáp án đúng"
              >
                🌟 Gợi ý
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-300/90 ml-1 px-2 py-0.5 rounded-md bg-black/40 border border-amber-300/25">
              ⚡ {speedDifficulty === "EASY" ? "Dễ" : speedDifficulty === "CUSTOM" ? `${customSpeed}m/s` : "Vừa sức"}
            </span>
          </HudChip>

          {/* Điểm, combo, điều khiển */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {combo >= 2 && (
              <div
                key={combo}
                className="yk-pop rounded-full px-2 py-0.5 sm:px-2.5 text-[10px] sm:text-xs font-extrabold text-white border border-amber-200/70 bg-[linear-gradient(180deg,#fb923c,#e11d48)] shadow-[0_0_16px_-2px_rgba(251,146,60,.85)]"
              >
                🔥 x{combo}
              </div>
            )}
            <HudChip className="px-2 py-1 sm:px-3 sm:py-1.5">
              <span className="yk-display text-sm sm:text-lg font-extrabold text-white tabular-nums leading-none">
                {score.toLocaleString("en-US")}
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-amber-300">PTS</span>
            </HudChip>

            <HudIconButton
              onClick={toggleGateHint}
              active={showGateHint}
              tone={showGateHint ? "amber" : "default"}
              title={showGateHint ? "Vòng vàng gợi ý: Đang BẬT (Bấm để Tắt)" : "Vòng vàng gợi ý: Đang TẮT (Tự suy luận)"}
              className="hidden sm:flex h-9 px-2.5"
            >
              <span aria-hidden>{showGateHint ? "🌟" : "🎯"}</span>
              <span className="hidden md:inline text-[11px]">{showGateHint ? "Gợi ý" : "Tự giải"}</span>
            </HudIconButton>

            <HudIconButton
              onClick={toggleReducedMotion}
              active={reducedMotion}
              tone={reducedMotion ? "jade" : "default"}
              title={reducedMotion ? "Đang bật Giảm hiệu ứng (Tối ưu FPS)" : "Giảm hiệu ứng chuyển động"}
              className="hidden sm:flex h-9 px-2.5"
            >
              <span aria-hidden>{reducedMotion ? "🌙" : "✨"}</span>
              <span className="hidden md:inline text-[11px]">FX</span>
            </HudIconButton>
            <HudIconButton
              onClick={() => {
                const next = yokaiSound.toggleMuted();
                setIsMuted(next);
              }}
              title={isMuted ? "Bật âm thanh hiệu ứng" : "Tắt âm thanh hiệu ứng"}
              className="hidden sm:flex h-9 px-2.5"
            >
              <span aria-hidden>{isMuted ? "🔇" : "🔊"}</span>
            </HudIconButton>
            <HudIconButton onClick={togglePause} title="Tạm dừng (P / Esc)" className="h-8 sm:h-9 px-2 sm:px-2.5">
              <span aria-hidden>⏸</span>
              <span className="hidden sm:inline text-[11px]">Dừng</span>
            </HudIconButton>
            <HudIconButton onClick={onExitGame} title="Thoát về Sảnh" tone="danger" className="h-8 sm:h-9 px-2 sm:px-2.5">
              <span aria-hidden>✕</span>
            </HudIconButton>
          </div>
        </div>

        {/* ROW 2: DOCKED QUESTION RIBBON — Full question & answers, wraps cleanly, never truncates text */}
        {activePrompt && (
          <div className="max-w-2xl mx-auto w-full rounded-2xl border border-amber-300/50 bg-[linear-gradient(160deg,rgba(13,7,34,.92),rgba(36,12,38,.88))] backdrop-blur-xl shadow-[0_14px_38px_-18px_rgba(0,0,0,.9)] px-2.5 py-1.5 sm:px-4 sm:py-2">
            <div className="flex items-start sm:items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="shrink-0 text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-300/45">
                    {currentQuestionIndex + 1}/{questions.length} • {zone.level}
                  </span>
                  {activePrompt.subPrompt && (
                    <span className="text-[10px] sm:text-xs text-amber-100/80 font-medium">
                      ({activePrompt.subPrompt})
                    </span>
                  )}
                </div>
                <div className="yk-display text-xs sm:text-base font-extrabold text-white leading-relaxed break-words">
                  {activePrompt.prompt}
                </div>
              </div>

              {activePrompt.audioText && (
                <button
                  type="button"
                  onClick={speakCurrentQuestion}
                  className="pointer-events-auto shrink-0 h-6 sm:h-7 px-2 sm:px-2.5 rounded-lg text-[10px] sm:text-[11px] font-bold text-white border border-rose-300/60 bg-[linear-gradient(180deg,#fb4a6b,#be123c)] shadow-sm active:scale-95 transition"
                  title="Nghe phát âm chuẩn"
                >
                  🔊 <span className="hidden sm:inline">Nghe</span>
                </button>
              )}
            </div>

            {/* 3 Inline Answer Pills (Clickable to switch directly to Lane A / B / C) */}
            <div className="mt-1 sm:mt-1.5 grid grid-cols-3 gap-1 sm:gap-1.5 pointer-events-auto">
              {(["A", "B", "C"] as const).map((letter, idx) => {
                const laneIdx = idx as 0 | 1 | 2;
                const optText = activePrompt.options[idx] || `Đáp án ${idx + 1}`;
                const isCurrentLane = currentLaneUI === idx;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={handleButtonClick(() => selectLane(laneIdx))}
                    onTouchStart={handleButtonTouch(() => selectLane(laneIdx))}
                    className={`yk-control-btn flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl px-1.5 py-1 sm:px-2 sm:py-1.5 text-left border min-h-[2.4rem] sm:min-h-[2.6rem] transition-all duration-150 touch-manipulation ${
                      isCurrentLane
                        ? "border-amber-300 bg-[linear-gradient(90deg,rgba(245,158,11,.45),rgba(225,29,72,.35))] shadow-[0_0_16px_-4px_rgba(251,191,36,.85)] ring-1 ring-amber-300/60"
                        : "border-white/10 bg-white/[0.05] opacity-85 hover:opacity-100 hover:border-white/25 active:scale-95"
                    }`}
                  >
                    <span
                      className={`shrink-0 text-[9px] sm:text-[10px] font-black px-1 sm:px-1.5 py-0.5 rounded ${
                        isCurrentLane ? "bg-amber-300 text-slate-950 font-black shadow-sm" : "bg-white/15 text-slate-300"
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-white text-center flex-1 break-words leading-tight">
                      {optText}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Slim Progress Bar */}
            <div className="mt-1 sm:mt-1.5 h-0.5 rounded-full bg-white/10 overflow-hidden" aria-hidden>
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-rose-400 to-teal-300 transition-[width] duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* COMPACT SINGLE-LINE FEEDBACK PILL — Never blocks the character or oncoming obstacles */}
        {(feedbackBanner || actionPopup) && (
          <div className="pointer-events-none mx-auto flex justify-center">
            {feedbackBanner ? (
              <div
                className={`yk-pop px-3.5 py-1 rounded-full border text-xs sm:text-sm font-extrabold shadow-lg backdrop-blur-md truncate max-w-[92vw] sm:max-w-lg ${
                  feedbackBanner.type === "correct_gate"
                    ? "bg-amber-950/85 border-amber-300/80 text-amber-100"
                    : feedbackBanner.type === "shield"
                    ? "bg-teal-950/85 border-teal-300/80 text-teal-100"
                    : "bg-rose-950/90 border-rose-400/80 text-rose-100"
                }`}
              >
                {feedbackBanner.title}
              </div>
            ) : actionPopup ? (
              <div
                key={actionPopup.id}
                className={`yk-pop yk-display px-3 py-0.5 rounded-full text-xs sm:text-sm font-extrabold border shadow-md ${
                  actionPopup.tone === "perfect"
                    ? "bg-[linear-gradient(180deg,#fde68a,#f59e0b)] border-yellow-100 text-slate-900"
                    : "bg-teal-950/85 border-teal-300/70 text-teal-100"
                }`}
              >
                {actionPopup.text}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Vignette viền màn hình cho cảm giác điện ảnh */}
      <div
        className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(4,2,16,.5)_100%)]"
        aria-hidden
      />

      {/* MODAL TẠM DỪNG */}
      {isPaused && (
        <div className="yk-ui fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#050310]/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="yk-frame w-full max-w-sm rounded-[1.75rem] border border-amber-300/40 bg-[linear-gradient(150deg,#12102a,#0a0818_58%,#2a0f24)] p-6 text-white text-center shadow-[0_30px_100px_-25px_rgba(0,0,0,.95)] space-y-4">
            <span className="yk-corner-bl" />
            <span className="yk-corner-br" />
            <div className="yk-display text-3xl font-extrabold">{isEn ? "Paused" : isZh ? "游戏暂停" : isKo ? "일시 정지" : "Tạm dừng"}</div>
            <p className="text-xs text-slate-300">
              {isEn ? "The game automatically paused. Review question and resume when ready!" : isZh ? "游戏已自动暂停。稍作休息，准备就绪后即可继续奔跑！" : isKo ? "게임이 일시 정지되었습니다. 문제를 확인하고 준비되면 계속하세요!" : "Trò chơi tự động tạm dừng khi rời tab. Kiểm tra lại câu hỏi rồi tiếp tục khi bạn sẵn sàng!"}
            </p>

            {activePrompt && (
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-left text-xs space-y-1">
                <div className="text-amber-300 font-bold">Câu hỏi: {activePrompt.prompt}</div>
                {activePrompt.subPrompt && <div className="text-slate-400">{activePrompt.subPrompt}</div>}
                <div className="pt-1 flex flex-wrap gap-1.5">
                  {(["A", "B", "C"] as const).map((letter, idx) => (
                    <span
                      key={letter}
                      className="px-2 py-0.5 rounded-md bg-white/10 text-[11px] text-slate-200 font-semibold"
                    >
                      {letter}: {activePrompt.options[idx]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick settings inside Pause Modal */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  const next = yokaiSound.toggleMuted();
                  setIsMuted(next);
                }}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 font-bold text-slate-200 flex items-center justify-center gap-1.5"
              >
                <span>{isMuted ? "🔇" : "🔊"}</span>
                <span>{isMuted ? (isEn ? "Muted" : isZh ? "已静音" : isKo ? "음소거" : "Đã tắt tiếng") : (isEn ? "Sound: ON" : isZh ? "声音: 开启" : isKo ? "소리: 켜짐" : "Âm thanh: Bật")}</span>
              </button>
              <button
                type="button"
                onClick={toggleReducedMotion}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 ${
                  reducedMotion
                    ? "bg-teal-500/20 border-teal-300/60 text-teal-200"
                    : "bg-white/10 hover:bg-white/15 border-white/15 text-slate-200"
                }`}
              >
                <span>{reducedMotion ? "🌙" : "✨"}</span>
                <span>{reducedMotion ? (isEn ? "Reduced FX: ON" : isZh ? "降效: 开启" : isKo ? "효과 감소: 켜짐" : "Giảm FX: Bật") : (isEn ? "FX: Full" : isZh ? "特效: 完整" : isKo ? "효과: 전체" : "Hiệu ứng: Đầy đủ")}</span>
              </button>
            </div>

            {/* Cài đặt bật / tắt Vòng vàng gợi ý đáp án đúng */}
            <button
              type="button"
              onClick={toggleGateHint}
              className={`w-full py-2.5 px-3.5 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
                showGateHint
                  ? "bg-amber-500/20 border-amber-300/60 text-amber-200"
                  : "bg-white/10 hover:bg-white/15 border-white/20 text-slate-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{showGateHint ? "🌟" : "🎯"}</span>
                <span>{isEn ? "Answer Hint Rings:" : isZh ? "答案提示环:" : isKo ? "정답 힌트 링:" : "Vòng vàng gợi ý đáp án:"}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-black ${
                  showGateHint ? "bg-amber-400 text-slate-950" : "bg-white/15 text-slate-200"
                }`}
              >
                {showGateHint ? (isEn ? "ON" : isZh ? "开启" : isKo ? "켜짐" : "BẬT") : (isEn ? "OFF" : isZh ? "关闭" : isKo ? "꺼짐" : "TẮT")}
              </span>
            </button>

            <div className="pt-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={togglePause}
                className="yk-launch yk-display w-full py-3.5 rounded-2xl text-base font-extrabold text-white border-2 border-amber-300/80 bg-[linear-gradient(180deg,#fb4a6b,#e11d48_45%,#9f1239)] shadow-[0_14px_36px_-10px_rgba(225,29,72,.85)] active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {isEn ? "▶ Resume Run" : isZh ? "▶ 继续奔跑" : isKo ? "▶ 계속 달리기" : "▶ Tiếp tục chạy"}
              </button>
              <button
                type="button"
                onClick={onExitGame}
                className="w-full py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs border border-white/15 active:scale-95 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {isEn ? "Exit to Hub" : isZh ? "返回大厅" : isKo ? "로비로 나가기" : "Thoát về Sảnh"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ĐIỀU KHIỂN CẢM ỨNG (di động & máy tính bảng - nút to 64-80px, nhạy, êm tay, không bấm nhầm) */}
      <div
        className="absolute inset-x-3 sm:inset-x-6 md:hidden z-20 flex items-end justify-between pointer-events-none select-none landscape:inset-x-4"
        style={{ bottom: "max(0.75rem, calc(0.35rem + env(safe-area-inset-bottom)))" }}
      >
        {/* Cụm trái: Sang Làn Trái / Phải */}
        <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
          {[
            { label: isEn ? "Move Left" : "Di chuyển sang trái", icon: "◀", text: isEn ? "Left" : isZh ? "左移" : isKo ? "좌" : "Trái", fn: moveLeft },
            { label: isEn ? "Move Right" : "Di chuyển sang phải", icon: "▶", text: isEn ? "Right" : isZh ? "右移" : isKo ? "우" : "Phải", fn: moveRight },
          ].map((b) => (
            <button
              key={b.text}
              type="button"
              onTouchStart={handleButtonTouch(b.fn)}
              onClick={handleButtonClick(b.fn)}
              aria-label={b.label}
              className="yk-control-btn w-16 h-16 sm:w-20 sm:h-20 landscape:w-14 landscape:h-14 rounded-2xl text-white font-extrabold border-2 border-amber-300/60 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.24),rgba(13,7,34,.88)_70%)] backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(0,0,0,.85)] flex flex-col items-center justify-center active:scale-90 active:border-amber-300 transition-transform touch-manipulation"
            >
              <span className="text-2xl sm:text-3xl leading-none font-black text-amber-200">{b.icon}</span>
              <span className="text-[10px] sm:text-xs font-bold text-amber-100/90 mt-0.5">{b.text}</span>
            </button>
          ))}
        </div>

        {/* Cụm phải: Trượt (Teal) / Nhảy (Rose) */}
        <div className="flex items-end gap-2.5 sm:gap-3 pointer-events-auto">
          <button
            type="button"
            onTouchStart={handleButtonTouch(slide)}
            onClick={handleButtonClick(slide)}
            aria-label={isFlyingBeast ? "Bổ nhào xuống dưới chướng ngại vật" : "Trượt xuống dưới chướng ngại vật"}
            className="yk-control-btn w-16 h-16 sm:w-20 sm:h-20 landscape:w-14 landscape:h-14 rounded-2xl text-white font-extrabold border-2 border-teal-300/60 bg-[radial-gradient(circle_at_35%_30%,rgba(45,212,191,.35),rgba(13,7,34,.88)_70%)] backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(20,184,166,.45)] flex flex-col items-center justify-center active:scale-90 active:border-teal-200 transition-transform touch-manipulation"
          >
            <span className="text-xl sm:text-2xl leading-none text-teal-200">▼</span>
            <span className="text-[10px] sm:text-xs mt-0.5 text-teal-100 font-black">
              {isFlyingBeast ? (isEn ? "Dive" : isZh ? "俯冲" : isKo ? "급강하" : "Bổ nhào") : (isEn ? "Slide" : isZh ? "铲滑" : isKo ? "슬라이딩" : "Trượt")}
            </span>
          </button>
          <button
            type="button"
            onTouchStart={handleButtonTouch(jump)}
            onClick={handleButtonClick(jump)}
            aria-label={isFlyingBeast ? "Bay vút lên qua chướng ngại vật" : "Nhảy lên qua chướng ngại vật"}
            className="yk-control-btn w-[4.25rem] h-[4.25rem] sm:w-[5.25rem] sm:h-[5.25rem] landscape:w-15 landscape:h-15 rounded-2xl text-white font-extrabold border-2 border-rose-300/80 bg-[radial-gradient(circle_at_35%_28%,#fb7185,#e11d48_55%,#9f1239)] shadow-[0_12px_28px_-6px_rgba(225,29,72,.85)] flex flex-col items-center justify-center active:scale-90 active:border-rose-200 transition-transform touch-manipulation"
          >
            <span className="text-2xl sm:text-3xl leading-none text-white font-black">▲</span>
            <span className="text-[11px] sm:text-sm mt-0.5 font-black text-rose-100 uppercase tracking-wide">
              {isFlyingBeast ? (isEn ? "Soar" : isZh ? "升腾" : isKo ? "상승" : "Bay cao") : (isEn ? "Jump" : isZh ? "跳跃" : isKo ? "점프" : "Nhảy")}
            </span>
          </button>
        </div>
      </div>

      {/* PHÍM TẮT (máy tính) */}
      <div className="yk-ui absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none hidden md:flex items-center gap-3.5 rounded-full border border-amber-200/20 bg-[#0d0722]/75 backdrop-blur-xl px-4 py-1.5 text-[11px] text-slate-200 shadow-[0_10px_35px_-15px_rgba(0,0,0,.9)]">
        {[
          ["A D / ◀ ▶ / 1-3", isEn ? "Lane Switch" : isZh ? "切换赛道" : isKo ? "차선 선택" : "Chọn làn"],
          ["W / Space", isFlyingBeast ? "Bay cao" : "Nhảy"],
          ["S / ▼", isFlyingBeast ? "Bổ nhào" : "Trượt"],
          ["P / Esc", isEn ? "Pause" : isZh ? "暂停" : isKo ? "일시정지" : "Tạm dừng"],
        ].map(([k, label]) => (
          <span key={k} className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 font-bold text-amber-200">{k}</kbd>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}