"use client";

import { useEffect, useRef } from "react";
import { isRainWeather } from "@/lib/weather";
import { useWeatherStore, type WeatherState, type WeatherType } from "@/store/useWeatherStore";

const LERP_FACTOR = 0.02;
const COLOR_LERP_FACTOR = 0.01;

const LAKE_TOP_RATIO = 0.7;
const LAKE_BOTTOM_RATIO = 0.95;

/** 全局云团透明度缩放，数值越大云越实、越凸显。 */
const CLOUD_OPACITY_SCALE = 1.48;

/** 暴雨场景需要更高雨滴上限。 */
const MAX_RAINDROPS = 220;

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

function getCloudBaseRadius(density: number, dry: boolean): number {
  const base = 120 + density * 80;
  return dry ? base * DRY_CLOUD_SIZE_BOOST + DRY_CLOUD_BASE_EXTRA : base;
}

function getCloudAlpha(weather: WeatherType): number {
  if (weather === "clear") return 0.3;
  if (weather === "breeze") return 0.52;
  if (weather === "mist") return 0.62;
  return 1;
}

export default function WeatherEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentCloudXRef = useRef(
    typeof window !== "undefined" ? window.innerWidth + 300 : 300,
  );

  useEffect(() => {
    const unsub = useWeatherStore.subscribe((state, prevState) => {
      if (state.cloudSpawnKey > 0 && state.cloudSpawnKey !== prevState.cloudSpawnKey) {
        currentCloudXRef.current = window.innerWidth + 300;
      }
    });
    return unsub;
  }, []);

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
        fallSpeed: stormBoost ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
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
      });
    };

    const handleCanvasClick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (event.clientX - rect.left) * scaleX;
      const clickY = (event.clientY - rect.top) * scaleY;

      const state = useWeatherStore.getState();
      if (!state.hasStarted) return;

      const baseY = canvas.height * 0.2;
      const currentCloudX = currentCloudXRef.current;
      const target = useWeatherStore.getState().targetWeather;
      const dry = isDryCloud(target.weather, current.rain.intensity);
      const cloudRadius = getCloudBaseRadius(current.cloud.density, dry);

      const dx = clickX - currentCloudX;
      const dy = clickY - baseY;
      const isHitCloud = (dx * dx) / (2.5 * 2.5) + dy * dy < cloudRadius * cloudRadius;

      if (isHitCloud) {
        state.setCloudActive(true);
        return;
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        const distance = Math.hypot(ripple.x - clickX, ripple.y - clickY);
        if (distance < ripple.maxRadius) {
          if (Math.random() < 0.1) {
            spawnRipple(clickX, clickY, 20);
            state.setCloudActive(false);
          } else {
            state.triggerRippleMessage(event.clientX, event.clientY);
          }
          ripples.splice(i, 1);
          return;
        }
      }

      state.setCloudActive(false);
    };

    canvas.addEventListener("click", handleCanvasClick);

    let frameId = 0;

    const tick = () => {
      const { targetWeather: target, hasStarted } = useWeatherStore.getState();

      current.cloud.color = lerpColor(current.cloud.color, target.cloud.color, COLOR_LERP_FACTOR);
      current.cloud.density = lerp(current.cloud.density, target.cloud.density, LERP_FACTOR);
      current.cloud.speed = lerp(current.cloud.speed, target.cloud.speed, LERP_FACTOR);
      current.rain.intensity = lerp(current.rain.intensity, target.rain.intensity, LERP_FACTOR);
      current.rain.dropSize = lerp(current.rain.dropSize, target.rain.dropSize, LERP_FACTOR);
      current.rain.duration = target.rain.duration;
      current.environment.wind = lerp(current.environment.wind, target.environment.wind, LERP_FACTOR);
      current.environment.hasSun = target.environment.hasSun;

      const targetMistOpacity =
        target.weather === "mist" || target.weather === "cloudy" ? 1 : 0;
      currentMistOpacity += (targetMistOpacity - currentMistOpacity) * EFFECT_LERP;

      const targetLightning = target.weather === "thunderstorm" ? 0.01 : 0;
      currentLightningChance += (targetLightning - currentLightningChance) * EFFECT_LERP;

      const targetCloudPresence = getCloudAlpha(target.weather);
      currentCloudPresence += (targetCloudPresence - currentCloudPresence) * EFFECT_LERP;

      if (hasStarted) {
        let moveSpeed = 0.18 + current.cloud.speed * 0.32;
        const canvasWidth = canvas.width;
        const entryThreshold = canvasWidth - canvasWidth * 0.2;

        // 快进慢陪：刚从右侧入场时加速掠过，进入视野后放慢陪伴
        if (currentCloudXRef.current > entryThreshold) {
          moveSpeed += (currentCloudXRef.current - entryThreshold) * 0.003;
        }

        currentCloudXRef.current -= moveSpeed;
      }

      ctx.clearRect(0, 0, width, height);

      const wind = current.environment.wind;

      if (hasStarted && currentCloudPresence > 0.05) {
        const cloudColor = current.cloud.color;
        const density = current.cloud.density;
        const baseY = canvas.height * 0.2;
        const baseX = currentCloudXRef.current;
        const dry = isDryCloud(target.weather, current.rain.intensity);
        const baseRadius = getCloudBaseRadius(density, dry);
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
            alphaMultiplier * currentCloudPresence * CLOUD_OPACITY_SCALE,
          );
          gradient.addColorStop(0, `rgba(${cloudColor}, ${0.85 * cloudAlpha})`);
          gradient.addColorStop(0.4, `rgba(${cloudColor}, ${0.52 * cloudAlpha})`);
          gradient.addColorStop(0.75, `rgba(${cloudColor}, ${0.18 * cloudAlpha})`);
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

        const cloudOffScreen = baseX + baseRadius * 2.5 < 0;
        if (cloudOffScreen && useWeatherStore.getState().isCloudActive) {
          useWeatherStore.getState().setCloudActive(false);
        }

        if (current.rain.intensity > 0.01) {
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

      for (let i = raindrops.length - 1; i >= 0; i--) {
        const drop = raindrops[i];
        drop.y += drop.fallSpeed;
        drop.x += wind * (isStormWind ? 5.5 : 1.6);

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
        const windTilt = isStormWind ? 9 : 5;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - wind * windTilt, drop.y - drop.length * (isStormWind ? 1.25 : 1.15));
        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(215, 232, 255, 0.7)";

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.radius += (ripple.maxRadius - ripple.radius) * 0.03 + 0.1;
        ripple.opacity -= 0.003;

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
        mistPhase += 0.003;
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
      canvas.removeEventListener("click", handleCanvasClick);
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
