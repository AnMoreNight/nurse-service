import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Color mapping for dynamic status/staff colors
// Tailwind doesn't support dynamic class names at build time, so we use inline styles
export const colorStyles: Record<string, { text: string; bg: string; bgLight: string; border: string; borderLight: string }> = {
  red: { text: '#b91c1c', bg: '#dc2626', bgLight: '#fef2f2', border: '#fecaca', borderLight: '#fee2e2' },
  blue: { text: '#1d4ed8', bg: '#2563eb', bgLight: '#eff6ff', border: '#bfdbfe', borderLight: '#dbeafe' },
  green: { text: '#15803d', bg: '#16a34a', bgLight: '#f0fdf4', border: '#bbf7d0', borderLight: '#dcfce7' },
  emerald: { text: '#047857', bg: '#059669', bgLight: '#ecfdf5', border: '#a7f3d0', borderLight: '#d1fae5' },
  yellow: { text: '#a16207', bg: '#ca8a04', bgLight: '#fefce8', border: '#fef08a', borderLight: '#fef9c3' },
  purple: { text: '#7e22ce', bg: '#9333ea', bgLight: '#faf5ff', border: '#e9d5ff', borderLight: '#f3e8ff' },
  orange: { text: '#c2410c', bg: '#ea580c', bgLight: '#fff7ed', border: '#fed7aa', borderLight: '#ffedd5' },
  gray: { text: '#374151', bg: '#6b7280', bgLight: '#f9fafb', border: '#e5e7eb', borderLight: '#f3f4f6' },
  slate: { text: '#475569', bg: '#64748b', bgLight: '#f8fafc', border: '#cbd5e1', borderLight: '#e2e8f0' },
  teal: { text: '#0f766e', bg: '#14b8a6', bgLight: '#f0fdfa', border: '#99f6e4', borderLight: '#ccfbf1' },
  pink: { text: '#be185d', bg: '#ec4899', bgLight: '#fdf2f8', border: '#fbcfe8', borderLight: '#fce7f3' },
  rose: { text: '#be123c', bg: '#f43f5e', bgLight: '#fff1f2', border: '#fecdd3', borderLight: '#ffe4e6' },
  amber: { text: '#b45309', bg: '#f59e0b', bgLight: '#fffbeb', border: '#fcd34d', borderLight: '#fef3c7' },
  cyan: { text: '#0e7490', bg: '#06b6d4', bgLight: '#ecfeff', border: '#67e8f9', borderLight: '#cffafe' },
  indigo: { text: '#4338ca', bg: '#6366f1', bgLight: '#eef2ff', border: '#c7d2fe', borderLight: '#e0e7ff' },
};

export const getColorStyles = (color: string) => {
  // If it's a named color, return the predefined styles
  if (colorStyles[color]) {
    return colorStyles[color];
  }
  
  // If it's a hex color, generate styles dynamically
  if (color && color.startsWith('#')) {
    // Create lighter and darker variants
    const lightenColor = (hex: string, percent: number) => {
      const num = parseInt(hex.slice(1), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, (num >> 16) + amt);
      const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
      const B = Math.min(255, (num & 0x0000FF) + amt);
      return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    };
    
    const darkenColor = (hex: string, percent: number) => {
      const num = parseInt(hex.slice(1), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max(0, (num >> 16) - amt);
      const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
      const B = Math.max(0, (num & 0x0000FF) - amt);
      return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    };
    
    return {
      text: darkenColor(color, 30),
      bg: color,
      bgLight: lightenColor(color, 80),
      border: lightenColor(color, 40),
      borderLight: lightenColor(color, 60),
    };
  }
  
  return colorStyles.gray;
};
