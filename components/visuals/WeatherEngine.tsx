"use client";

import { useEffect, useRef } from "react";
import { isRainWeather } from "@/lib/weather";
import { useWeatherStore, type WeatherState, type WeatherType } from "@/store/useWeatherStore";

const LERP_FACTOR = 0.02;
const COLOR_LERP_FACTOR = 0.01;

const LAKE_TOP_RATIO = 0.7;
const LAKE_BOTTOM_RATIO = 0.95;

/** 全局云团透明度缩放，数值越大云越实、越凸显。 */
const CLOUD_OPACITY_SCALE = 1.72;

/** 暴雨场景需要更高雨滴上限。 */
const MAX_RAINDROPS = 220;

const EMBRYO_CLOUD_COLOR = "255, 255, 255";
const EMBRYO_CLOUD_PRESENCE = 0.12;
const PENDING_DISSOLVE_LERP = 0.035;
const PENDING_WIND_BOOST = 0.2;
const CLOUD_X_MIN_RATIO = 0.2;
const CLOUD_X_MAX_RATIO = 0.8;

const CLOUD_FLOAT_AMPLITUDE = 0;
const CLOUD_FLOAT_FREQUENCY = 0.00065;
const CLOUD_LEAVE_SPEED = 0.18;
const CLOUD_DISSIPATE_RATE = 0.0012;
/** 与早期「云从右向左飘」的基底速度对齐，整体再略缓半拍。 */
const CLOUD_DRIFT_SPEED = 0.14;
const CLOUD_BOUNCE_MIN_RATIO = 0.14;
const CLOUD_BOUNCE_MAX_RATIO = 0.86;
const RIPPLE_BASE_SPREAD = 0.018;
const RIPPLE_BOOST_SPREAD = 0.065;
const RIPPLE_BOOST_MAX_RADIUS = 110;
const PENDING_GATHER_DELAY_MS = 1000;

function randomCloudX(canvasWidth: number): number {
  return canvasWidth * CLOUD_X_MIN_RATIO + Math.random() * canvasWidth * (CLOUD_X_MAX_RATIO - CLOUD_X_MIN_RATIO);
}

interface RainDrop {
  x: number;
  y: number;
  targetY: number;
  length: number;
  fallSpeed: number;
  opacity: number;
}

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  /** 扩散速率，读尽叙事后点击可叠加加速。 */
  spreadRate: number;
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t;
}

function lerpColor(currentStr: string, targetStr: string, amount: number): string {
  const current = currentStr.split(",").map((v) => Number(v.trim()));
  const target = targetStr.split(",").map((v) => Number(v.trim()));
  if (current.length !== 3 || target.length !== 3) return targetStr;
  const r = Math.round(current[0] + (target[0] - current[0]) * amount);
  const g = Math.round(current[1] + (target[1] - current[1]) * amount);
  const b = Math.round(current[2] + (target[2] - current[2]) * amount);
  return `${r}, ${g}, ${b}`;
}

function cloneWeather(state: WeatherState): WeatherState {
  return {
    weather: state.weather,
    cloud: { ...state.cloud },
    rain: { ...state.rain },
    environment: { ...state.environment },
    messages: {
      cloudMsg: state.messages.cloudMsg,
      rippleMsgs: [...state.messages.rippleMsgs],
    },
  };
}

/** 无雨云团尺寸加成——晴天、薄雾等低密度云也要有足够体量。 */
const DRY_CLOUD_SIZE_BOOST = 1.45;
const DRY_CLOUD_BASE_EXTRA = 32;

function isDryCloud(weather: WeatherType, rainIntensity: number): boolean {
  return !isRainWeather(weather) || rainIntensity < 0.08;
}

function getCloudBaseRadius(canvasWidth: number, density: number, dry: boolean): number {
  const base = Math.min(canvasWidth * 0.3, 120) + density * 80;
  return dry ? base * DRY_CLOUD_SIZE_BOOST + DRY_CLOUD_BASE_EXTRA : base;
}

function getCloudHalfWidth(baseRadius: number, wind: number): number {
  const windStretch = 1 + Math.abs(wind) * 0.8;
  return baseRadius * 1.85 * windStretch + baseRadius * 0.4;
}

function getCloudAlpha(weather: WeatherType): number {
  if (weather === "clear") return 0.38;
  if (weather === "breeze") return 0.6;
  if (weather === "mist") return 0.72;
  return 1;
}

export default function WeatherEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetCloudXRef = useRef(
    typeof window !== "undefined" ? randomCloudX(window.innerWidth) : 400,
  );
  const currentCloudXRef = useRef(targetCloudXRef.current);
  const currentCloudOpacityRef = useRef(0);
  const cloudDriftVelocityRef = useRef(CLOUD_DRIFT_SPEED);

  const hasStarted = useWeatherStore((s) => s.hasStarted);
  const isWeatherPending = useWeatherStore((s) => s.isWeatherPending);
  const isLeaving = useWeatherStore((s) => s.isLeaving);
  const isDissipating = useWeatherStore((s) => s.isDissipating);
  const extendCount = useWeatherStore((s) => s.extendCount);
  const isWeatherExtended = useWeatherStore((s) => s.isWeatherExtended);
  const targetWeather = useWeatherStore((s) => s.targetWeather);
  const rippleReadIndex = useWeatherStore((s) => s.rippleReadIndex);
  const cloudSpawnKey = useWeatherStore((s) => s.cloudSpawnKey);

  useEffect(() => {
    const unsub = useWeatherStore.subscribe((state, prevState) => {
      if (state.cloudSpawnKey > 0 && state.cloudSpawnKey !== prevState.cloudSpawnKey) {
        targetCloudXRef.current = randomCloudX(window.innerWidth);
        currentCloudXRef.current = targetCloudXRef.current;
        currentCloudOpacityRef.current = 0;
        cloudDriftVelocityRef.current = Math.random() < 0.5 ? CLOUD_DRIFT_SPEED : -CLOUD_DRIFT_SPEED;
      }
    });
    return unsub;
  }, []);

  /** 云朵离场生命周期：加时 3 分钟消散；否则无雨 20s 飘走 / 有雨读完后 10s 消散 / 未读完 120s 飘走。 */
  useEffect(() => {
    if (!hasStarted || isWeatherPending || isLeaving || isDissipating) return;

    const isRaining = targetWeather.rain.intensity > 0;
    const totalSpeeches = targetWeather.messages.rippleMsgs.length;

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isWeatherExtended) {
      timer = setTimeout(() => {
        useWeatherStore.getState().triggerDissipate();
      }, 180000);
    } else if (!isRaining) {
      timer = setTimeout(() => {
        useWeatherStore.getState().triggerLeave();
      }, 20000);
    } else if (rippleReadIndex >= totalSpeeches && totalSpeeches > 0) {
      timer = setTimeout(() => {
        useWeatherStore.getState().triggerDissipate();
      }, 10000);
    } else {
      timer = setTimeout(() => {
        useWeatherStore.getState().triggerLeave();
      }, 120000);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [
    hasStarted,
    isWeatherPending,
    isLeaving,
    isDissipating,
    targetWeather,
    rippleReadIndex,
    cloudSpawnKey,
    isWeatherExtended,
    extendCount,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener("resize", handleResize);

    const current = cloneWeather(useWeatherStore.getState().targetWeather);
    const raindrops: RainDrop[] = [];
    const ripples: Ripple[] = [];
    let mistPhase = 0;

    let currentMistOpacity = 0;
    let currentLightningChance = 0;
    let currentCloudPresence = getCloudAlpha(current.weather);

    const EFFECT_LERP = 0.01;

    const getLakeBounds = () => ({
      top: height * LAKE_TOP_RATIO,
      bottom: height * LAKE_BOTTOM_RATIO,
    });

    const spawnRaindrop = (
      baseX: number,
      baseY: number,
      baseRadius: number,
      stormBoost = false,
    ) => {
      const { top: lakeTop, bottom: lakeBottom } = getLakeBounds();
      const spread = stormBoost ? baseRadius * 3.2 : baseRadius * 2;
      const dropX = baseX + (Math.random() * 2 - 1) * spread;

      raindrops.push({
        x: dropX,
        y: baseY + baseRadius * 0.35 + Math.random() * baseRadius * 0.2,
        targetY: lakeTop + Math.random() * (lakeBottom - lakeTop),
        length: 8 + current.rain.dropSize * (stormBoost ? 24 : 18),
        fallSpeed: stormBoost ? 1.8 + Math.random() * 1.6 : 1.1 + Math.random() * 1.1,
        opacity: stormBoost ? 0.18 + Math.random() * 0.28 : 0.12 + Math.random() * 0.22,
      });
    };

    const spawnRipple = (x: number, y: number, maxRadius = 28 + Math.random() * 36) => {
      ripples.push({
        x,
        y,
        radius: 1,
        maxRadius,
        opacity: 0.38,
        spreadRate: RIPPLE_BASE_SPREAD,
      });
    };

    const spawnAcceleratedRipple = (x: number, y: number) => {
      ripples.push({
        x,
        y,
        radius: 2,
        maxRadius: 52 + Math.random() * 28,
        opacity: 0.44,
        spreadRate: RIPPLE_BASE_SPREAD + RIPPLE_BOOST_SPREAD,
      });
    };

    const boostRippleSpread = (ripple: Ripple) => {
      ripple.maxRadius = Math.min(ripple.maxRadius * 1.3 + 22, RIPPLE_BOOST_MAX_RADIUS);
      ripple.spreadRate = Math.min(ripple.spreadRate + RIPPLE_BOOST_SPREAD, 0.14);
      ripple.opacity = Math.min(ripple.opacity + 0.12, 0.55);
    };

    const isRippleHit = (ripple: Ripple, clickX: number, clickY: number, narrativeExhausted: boolean) => {
      const distance = Math.hypot(ripple.x - clickX, ripple.y - clickY);
      if (narrativeExhausted) {
        // 叙事读尽后：以当前可见波纹环为命中依据，并略放宽触控
        return distance < Math.max(ripple.radius + 14, 26);
      }
      return distance < ripple.maxRadius;
    };

    const handleCanvasClick = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (event.clientX - rect.left) * scaleX;
      const clickY = (event.clientY - rect.top) * scaleY;

      const state = useWeatherStore.getState();
      if (!state.hasStarted && !state.isWeatherPending) return;

      const pendingElapsed =
        state.isWeatherPending && state.weatherPendingSince !== null
          ? Date.now() - state.weatherPendingSince
          : Infinity;
      const canStartGathering =
        !state.isWeatherPending || pendingElapsed >= PENDING_GATHER_DELAY_MS;
      const cloudClickable = canStartGathering && state.cloudOpacity > 0.01;

      const baseY = canvas.height * 0.2;
      const floatOffset = Math.sin(Date.now() * CLOUD_FLOAT_FREQUENCY) * CLOUD_FLOAT_AMPLITUDE;
      const cloudX = currentCloudXRef.current + floatOffset;
      const target = useWeatherStore.getState().targetWeather;
      const dry = isDryCloud(target.weather, current.rain.intensity);
      const cloudRadius = getCloudBaseRadius(canvas.width, current.cloud.density, dry);

      if (cloudClickable) {
        const dx = clickX - cloudX;
        const dy = clickY - baseY;
        const isHitCloud = (dx * dx) / (2.5 * 2.5) + dy * dy < cloudRadius * cloudRadius;

        if (isHitCloud) {
          state.setCloudInteractState("menu");
          return;
        }
      }

      const speeches = state.targetWeather.messages.rippleMsgs;
      const narrativeExhausted = speeches.length > 0 && state.rippleReadIndex >= speeches.length;

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        if (!isRippleHit(ripple, clickX, clickY, narrativeExhausted)) continue;

        if (!narrativeExhausted) {
          const text = speeches[state.rippleReadIndex];
          state.incrementRippleReadIndex();
          state.triggerRippleMessage(event.clientX, event.clientY, text);
          ripples.splice(i, 1);
        } else {
          boostRippleSpread(ripple);
          state.setCloudInteractState("idle");
        }

        return;
      }

      // 叙事已全部触发：点击湖面任意处，荡开一圈加速扩散的波纹（无文字）
      if (narrativeExhausted) {
        const { top: lakeTop, bottom: lakeBottom } = getLakeBounds();
        if (clickY >= lakeTop && clickY <= lakeBottom) {
          spawnAcceleratedRipple(clickX, clickY);
          state.setCloudInteractState("idle");
          return;
        }
      }

      state.setCloudInteractState("idle");
    };

    canvas.addEventListener("pointerdown", handleCanvasClick);

    let frameId = 0;

    const tick = () => {
      const {
        targetWeather: target,
        hasStarted,
        isWeatherPending,
        weatherPendingSince,
        isDissipating,
        isLeaving,
        isWeatherExtended,
      } = useWeatherStore.getState();

      const pendingElapsed =
        isWeatherPending && weatherPendingSince !== null
          ? Date.now() - weatherPendingSince
          : Infinity;
      const canStartGathering = !isWeatherPending || pendingElapsed >= PENDING_GATHER_DELAY_MS;

      const dry = isDryCloud(target.weather, current.rain.intensity);
      const baseRadiusEstimate = getCloudBaseRadius(width, current.cloud.density, dry && !isWeatherPending);
      const windForBounds = current.environment.wind;
      const cloudHalfWidth = getCloudHalfWidth(baseRadiusEstimate, windForBounds);
      const bounceMinX = width * CLOUD_BOUNCE_MIN_RATIO + baseRadiusEstimate * 0.45;
      const bounceMaxX = width * CLOUD_BOUNCE_MAX_RATIO - baseRadiusEstimate * 0.45;

      if (isLeaving) {
        const leaveDir = cloudDriftVelocityRef.current >= 0 ? 1 : -1;
        currentCloudXRef.current += leaveDir * CLOUD_LEAVE_SPEED;
      } else if (!isWeatherPending && hasStarted && canStartGathering) {
        currentCloudXRef.current += cloudDriftVelocityRef.current;

        if (isWeatherExtended) {
          const leftEdge = currentCloudXRef.current - cloudHalfWidth;
          const rightEdge = currentCloudXRef.current + cloudHalfWidth;

          if (leftEdge <= 0) {
            currentCloudXRef.current = cloudHalfWidth;
            cloudDriftVelocityRef.current = CLOUD_DRIFT_SPEED;
          } else if (rightEdge >= width) {
            currentCloudXRef.current = width - cloudHalfWidth;
            cloudDriftVelocityRef.current = -CLOUD_DRIFT_SPEED;
          }
        } else if (currentCloudXRef.current <= bounceMinX) {
          currentCloudXRef.current = bounceMinX;
          cloudDriftVelocityRef.current = CLOUD_DRIFT_SPEED;
        } else if (currentCloudXRef.current >= bounceMaxX) {
          currentCloudXRef.current = bounceMaxX;
          cloudDriftVelocityRef.current = -CLOUD_DRIFT_SPEED;
        }
      }

      const dissolveLerp = isWeatherPending ? PENDING_DISSOLVE_LERP : EFFECT_LERP;
      const rainTarget = isWeatherPending ? 0 : target.rain.intensity;
      const windTarget = isWeatherPending
        ? Math.min(1, Math.max(target.environment.wind, current.environment.wind) + PENDING_WIND_BOOST)
        : target.environment.wind;

      let cloudOpacity = currentCloudOpacityRef.current;

      if (isDissipating) {
        cloudOpacity -= CLOUD_DISSIPATE_RATE;
        if (cloudOpacity < 0) cloudOpacity = 0;
      } else if (isWeatherPending && canStartGathering) {
        cloudOpacity += (0.8 - cloudOpacity) * 0.006;
      } else if (hasStarted && !isWeatherPending) {
        cloudOpacity += (1.0 - cloudOpacity) * 0.006;
      }

      currentCloudOpacityRef.current = cloudOpacity;

      const floatOffset = Math.sin(Date.now() * CLOUD_FLOAT_FREQUENCY) * CLOUD_FLOAT_AMPLITUDE;
      const cloudCanvasX = currentCloudXRef.current + floatOffset;
      const cloudCanvasY = height * 0.2;

      const canvasRect = canvas.getBoundingClientRect();
      const screenCloudX =
        canvasRect.left + (cloudCanvasX / canvas.width) * canvasRect.width;
      const screenCloudY =
        canvasRect.top + (cloudCanvasY / canvas.height) * canvasRect.height;
      const screenCloudRadius =
        (baseRadiusEstimate / canvas.width) * canvasRect.width;

      useWeatherStore.setState({
        cloudOpacity,
        cloudAnchor: canStartGathering && cloudOpacity > 0.01
          ? { x: screenCloudX, y: screenCloudY, radius: screenCloudRadius }
          : null,
      });

      const cloudVisible = cloudOpacity > 0.01 && canStartGathering;

      current.cloud.color = lerpColor(
        current.cloud.color,
        isWeatherPending ? EMBRYO_CLOUD_COLOR : target.cloud.color,
        isWeatherPending ? COLOR_LERP_FACTOR * 1.5 : COLOR_LERP_FACTOR,
      );
      current.cloud.density = lerp(
        current.cloud.density,
        isWeatherPending ? 0.06 : target.cloud.density,
        isWeatherPending ? dissolveLerp : LERP_FACTOR,
      );
      current.cloud.speed = lerp(current.cloud.speed, target.cloud.speed, LERP_FACTOR);
      current.rain.intensity = lerp(current.rain.intensity, rainTarget, dissolveLerp);
      current.rain.dropSize = lerp(current.rain.dropSize, target.rain.dropSize, LERP_FACTOR);
      current.rain.duration = target.rain.duration;
      current.environment.wind = lerp(current.environment.wind, windTarget, isWeatherPending ? 0.04 : LERP_FACTOR);
      current.environment.hasSun = target.environment.hasSun;

      const targetMistOpacity =
        isWeatherPending ? 0 : target.weather === "mist" || target.weather === "cloudy" ? 1 : 0;
      currentMistOpacity += (targetMistOpacity - currentMistOpacity) * dissolveLerp;

      const targetLightning = isWeatherPending ? 0 : target.weather === "thunderstorm" ? 0.01 : 0;
      currentLightningChance += (targetLightning - currentLightningChance) * dissolveLerp;

      const targetCloudPresence = isWeatherPending
        ? EMBRYO_CLOUD_PRESENCE
        : getCloudAlpha(target.weather);
      currentCloudPresence += (targetCloudPresence - currentCloudPresence) * (isWeatherPending ? 0.025 : EFFECT_LERP);

      const shouldAnimateCloud =
        (hasStarted || isWeatherPending) && cloudVisible && canStartGathering;

      ctx.clearRect(0, 0, width, height);

      const wind = current.environment.wind;

      if (shouldAnimateCloud && (currentCloudPresence > 0.05 || isWeatherPending)) {
        const cloudColor = current.cloud.color;
        const density = current.cloud.density;
        const baseY = cloudCanvasY;
        const baseX = cloudCanvasX;
        const baseRadius = baseRadiusEstimate;
        const windStretch = 1 + Math.abs(wind) * 0.8;

        const drawCloudPuff = (
          offsetX: number,
          offsetY: number,
          radius: number,
          scaleX: number,
          scaleY: number,
          alphaMultiplier: number,
        ) => {
          ctx.save();
          ctx.translate(baseX + offsetX, baseY + offsetY);
          ctx.scale(scaleX, scaleY);

          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
          const cloudAlpha = Math.min(
            1,
            alphaMultiplier * currentCloudPresence * CLOUD_OPACITY_SCALE * cloudOpacity,
          );
          gradient.addColorStop(0, `rgba(${cloudColor}, ${0.92 * cloudAlpha})`);
          gradient.addColorStop(0.4, `rgba(${cloudColor}, ${0.62 * cloudAlpha})`);
          gradient.addColorStop(0.75, `rgba(${cloudColor}, ${0.24 * cloudAlpha})`);
          gradient.addColorStop(1, `rgba(${cloudColor}, 0)`);

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        };

        drawCloudPuff(0, 0, baseRadius, 1.8 * windStretch, 0.4 + density * 0.2, 1);
        drawCloudPuff(-baseRadius * 0.8, -10, baseRadius * 0.7, 1.5 * windStretch, 0.5 + density * 0.1, 0.8);
        drawCloudPuff(baseRadius * 0.9, 15, baseRadius * 0.85, 1.6 * windStretch, 0.35 + density * 0.2, 0.9);

        if (current.rain.intensity > 0.01 && !isWeatherPending && !isDissipating) {
          const intensity = current.rain.intensity;
          const isStorm = target.weather === "thunderstorm" || currentLightningChance > 0.003;
          let dropsToSpawn = 0;

          if (intensity > 0.8) {
            dropsToSpawn = 8 + Math.floor(Math.random() * 6);
          } else if (intensity > 0.4) {
            dropsToSpawn = 4 + Math.floor(Math.random() * 4);
          } else {
            dropsToSpawn = Math.random() < intensity * 3.5 ? 1 + Math.floor(Math.random() * 2) : 0;
          }

          if (target.weather === "drizzle") {
            dropsToSpawn = Math.random() < 0.55 ? 1 + Math.floor(Math.random() * 2) : 0;
          } else if (target.weather === "light_rain") {
            dropsToSpawn = Math.max(1, Math.min(dropsToSpawn, 2 + Math.floor(Math.random() * 2)));
          }

          if (isStorm) {
            dropsToSpawn += 4 + Math.floor(Math.random() * 4);
          }

          const room = MAX_RAINDROPS - raindrops.length;
          dropsToSpawn = Math.min(dropsToSpawn, Math.max(0, room));

          for (let i = 0; i < dropsToSpawn; i++) {
            spawnRaindrop(baseX, baseY, baseRadius, isStorm);
          }
        }
      }

      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";

      const isStormWind = currentLightningChance > 0.003;
      const shouldDrawRain = cloudVisible && !isDissipating;

      for (let i = raindrops.length - 1; i >= 0; i--) {
        if (!shouldDrawRain) {
          raindrops.splice(i, 1);
          continue;
        }
        const drop = raindrops[i];
        drop.y += drop.fallSpeed;
        drop.x += wind * (isStormWind ? 3.2 : 0.9);

        const outOfBounds = drop.x < -30 || drop.x > width + 30;
        const hitTarget = drop.y >= drop.targetY;

        if (hitTarget) {
          if (Math.random() < 0.35) spawnRipple(drop.x, drop.targetY);
          raindrops.splice(i, 1);
          continue;
        }
        if (outOfBounds) {
          raindrops.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = drop.opacity * Math.min(1, current.rain.intensity);
        const windTilt = isStormWind ? 6 : 3.5;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - wind * windTilt, drop.y - drop.length * (isStormWind ? 1.25 : 1.15));
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(215, 232, 255, 0.7)";

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.radius += (ripple.maxRadius - ripple.radius) * ripple.spreadRate + 0.05;
        ripple.opacity -= ripple.spreadRate > RIPPLE_BASE_SPREAD * 2 ? 0.0035 : 0.002;

        if (ripple.opacity <= 0 || ripple.radius >= ripple.maxRadius * 1.8) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(ripple.opacity, 0);
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, ripple.radius, ripple.radius * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      if (currentMistOpacity > 0.01) {
        mistPhase += 0.0015;
        const gradient = ctx.createLinearGradient(
          width * (0.2 + Math.sin(mistPhase) * 0.08),
          0,
          width * (0.8 + Math.cos(mistPhase * 0.7) * 0.08),
          height,
        );
        gradient.addColorStop(0, `rgba(200, 210, 220, ${0.06 * currentMistOpacity})`);
        gradient.addColorStop(0.5, `rgba(180, 190, 200, ${0.1 * currentMistOpacity})`);
        gradient.addColorStop(1, `rgba(160, 170, 180, ${0.05 * currentMistOpacity})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      if (Math.random() < currentLightningChance) {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * Math.min(currentLightningChance / 0.01, 1)})`;
        ctx.fillRect(0, 0, width, height * 0.45);
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointerdown", handleCanvasClick);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-auto absolute inset-0 z-10"
      style={{ background: "transparent" }}
    />
  );
}
