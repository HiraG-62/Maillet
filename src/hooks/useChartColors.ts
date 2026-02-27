import { useState, useEffect } from 'react';

const DEFAULT_PRIMARY = '#0d9488';

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generateShades(primaryHex: string, count: number, lMin: number, lMax: number): string[] {
  const [h, s] = hexToHsl(primaryHex);
  return Array.from({ length: count }, (_, i) => {
    const l = count === 1 ? (lMin + lMax) / 2 : lMin + (i * (lMax - lMin)) / (count - 1);
    return hslToHex(h, s, l);
  });
}

function getPrimaryHex(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
  return raw && raw.startsWith('#') ? raw : DEFAULT_PRIMARY;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface ChartColors {
  barShades: string[];
  pieShades: string[];
  tooltipAccent: string;
}

export function useChartColors(): ChartColors {
  const [primary, setPrimary] = useState(getPrimaryHex);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setPrimary(getPrimaryHex());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => observer.disconnect();
  }, []);

  return {
    barShades: generateShades(primary, 6, 15, 75),
    pieShades: generateShades(primary, 8, 10, 80),
    tooltipAccent: primary,
  };
}
