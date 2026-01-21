
import { ThemeConfig } from '../types';

export const KEYBOARD_THEMES: ThemeConfig[] = [
  // --- Material 3 / Android 14 Originals ---
  { id: 'm3_blue', name: 'Material Ocean', bg: 'bg-[#1a1c1e]', keyBg: 'bg-[#2f3033]', keyText: 'text-[#e2e2e6]', accent: 'bg-[#d1e4ff]', accentText: 'text-[#003156]', border: 'border-white/5', isDark: true },
  { id: 'm3_lavender', name: 'Material Lavender', bg: 'bg-[#fdfbff]', keyBg: 'bg-[#f2f0f4]', keyText: 'text-[#1b1b1f]', accent: 'bg-[#6750a4]', accentText: 'text-white', border: 'border-slate-100', isDark: false },
  { id: 'm3_mint', name: 'Material Mint', bg: 'bg-[#191c1b]', keyBg: 'bg-[#2b312f]', keyText: 'text-[#e1e3e0]', accent: 'bg-[#bcebe2]', accentText: 'text-[#003732]', border: 'border-white/5', isDark: true },

  // --- Classic Multi-color ---
  { id: 'bleached_white', name: 'Standard White', bg: 'bg-[#f1f5f9]', keyBg: 'bg-white', keyText: 'text-slate-700', accent: 'bg-[#0d9488]', accentText: 'text-white', border: 'border-slate-200', isDark: false },
  { id: 'matte_black', name: 'Matte Black', bg: 'bg-[#121212]', keyBg: 'bg-[#2a2a2a]', keyText: 'text-slate-300', accent: 'bg-[#334155]', accentText: 'text-white', border: 'border-white/5', isDark: true },
  { id: 'midnight_black', name: 'Midnight Deep', bg: 'bg-[#000000]', keyBg: 'bg-[#111111]', keyText: 'text-white', accent: 'bg-blue-700', accentText: 'text-white', border: 'border-white/5', isDark: true },
  
  // --- Vibrant Variants ---
  { id: 'sour_grape', name: 'Sour Grape', bg: 'bg-[#2e1065]', keyBg: 'bg-[#4c1d95]', keyText: 'text-white', accent: 'bg-purple-400', accentText: 'text-white', isDark: true },
  { id: 'ridmik_blue', name: 'Legacy Blue', bg: 'bg-[#1e3a8a]', keyBg: 'bg-[#2563eb]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-blue-700', isDark: true },
  { id: 'only_pink', name: 'Sunset Pink', bg: 'bg-[#831843]', keyBg: 'bg-[#be185d]', keyText: 'text-white', accent: 'bg-pink-300', accentText: 'text-pink-900', isDark: true },
];
