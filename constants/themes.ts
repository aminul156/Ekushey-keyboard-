
import { ThemeConfig } from '../types';

export const KEYBOARD_THEMES: ThemeConfig[] = [
  // --- Featured / Images ---
  { id: 'mystic_magenta', name: 'Mystic Magenta', bg: 'bg-[#000000]', keyBg: 'bg-[#be185d]', keyText: 'text-white', accent: 'bg-[#be185d]', accentText: 'text-white', isDark: true },
  { id: 'black_pearl', name: 'Black Pearl', bg: 'bg-[#000000]', keyBg: 'bg-[#1e293b]', keyText: 'text-slate-300', accent: 'bg-slate-700', accentText: 'text-white', isDark: true },
  { id: 'admiral_black', name: 'Admiral Black', bg: 'bg-gradient-to-br from-[#0f172a] to-[#1e3a8a]', keyBg: 'bg-[#1e293b]/80', keyText: 'text-white', accent: 'bg-blue-500', accentText: 'text-white', isDark: true },
  { id: 'dark_fossil', name: 'Dark Fossil', bg: 'bg-[#d6d3d1]', keyBg: 'bg-[#44403c]', keyText: 'text-white', accent: 'bg-[#57534e]', accentText: 'text-white', isDark: true },
  { id: 'aventurine_light', name: 'Aventurine Light', bg: 'bg-[#065f46]', keyBg: 'bg-[#059669]', keyText: 'text-white', accent: 'bg-[#10b981]', accentText: 'text-white', isDark: true },
  { id: 'seaweed_green', name: 'Seaweed Green', bg: 'bg-[#525252]', keyBg: 'bg-[#166534]', keyText: 'text-white', accent: 'bg-[#15803d]', accentText: 'text-white', isDark: true },
  { id: 'ivory_white', name: 'Ivory White', bg: 'bg-[#f8fafc]', keyBg: 'bg-white', keyText: 'text-slate-700', accent: 'bg-slate-200', accentText: 'text-slate-900', border: 'border-slate-200', isDark: false },

  // --- ঈদ-উল-আজহা ২০২৪ (১) ---
  { id: 'dark_night', name: 'Dark Night', category: 'eid', bg: 'bg-black', keyBg: 'bg-[#111111]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-black', isDark: true },
  { id: 'greenery', name: 'Greenery', category: 'eid', bg: 'bg-[#166534]', keyBg: 'bg-[#22c55e]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-green-900', isDark: true },
  { id: 'aqua_sky', name: 'Aqua Sky', category: 'eid', bg: 'bg-[#e0f2fe]', keyBg: 'bg-[#0891b2]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-cyan-900', isDark: false },
  { id: 'light_ocean', name: 'Light Ocean', category: 'eid', bg: 'bg-[#f0f9ff]', keyBg: 'bg-[#0ea5e9]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-blue-900', isDark: false },
  { id: 'pastel_leaves', name: 'Pastel Leaves', category: 'eid', bg: 'bg-[#f0fdf4]', keyBg: 'bg-[#86efac]', keyText: 'text-slate-700', accent: 'bg-white', accentText: 'text-green-900', isDark: false },
  { id: 'rose_quartz', name: 'Rose Quartz', category: 'eid', bg: 'bg-[#fff1f2]', keyBg: 'bg-[#fda4af]', keyText: 'text-slate-700', accent: 'bg-white', accentText: 'text-rose-900', isDark: false },

  // --- কালার থিম ---
  { id: 'minty_fresh', name: 'Minty Fresh', category: 'color', bg: 'bg-[#f5f3ff]', keyBg: 'bg-[#8b5cf6]', keyText: 'text-white', accent: 'bg-[#7c3aed]', accentText: 'text-white', isDark: false },
  { id: 'deep_teal', name: 'Deep Teal', category: 'color', bg: 'bg-[#042f2e]', keyBg: 'bg-[#115e59]', keyText: 'text-white', accent: 'bg-[#14b8a6]', accentText: 'text-white', isDark: true },
  { id: 'purple_haze', name: 'Purple Haze', category: 'color', bg: 'bg-[#4c1d95]', keyBg: 'bg-[#6d28d9]', keyText: 'text-white', accent: 'bg-[#a78bfa]', accentText: 'text-white', isDark: true },
  { id: 'lavender_dream', name: 'Lavender Dream', category: 'color', bg: 'bg-[#ede9fe]', keyBg: 'bg-[#c4b5fd]', keyText: 'text-slate-700', accent: 'bg-white', accentText: 'text-purple-900', isDark: false },
  { id: 'blue_lagoon', name: 'Blue Lagoon', category: 'color', bg: 'bg-[#1e3a8a]', keyBg: 'bg-[#3b82f6]', keyText: 'text-white', accent: 'bg-[#60a5fa]', accentText: 'text-white', isDark: true },
  { id: 'orchid_bloom', name: 'Orchid Bloom', category: 'color', bg: 'bg-[#701a75]', keyBg: 'bg-[#d946ef]', keyText: 'text-white', accent: 'bg-[#f5d0fe]', accentText: 'text-purple-900', isDark: true },
  { id: 'midnight_plum', name: 'Midnight Plum', category: 'color', bg: 'bg-[#2e1065]', keyBg: 'bg-[#7e22ce]', keyText: 'text-white', accent: 'bg-[#c084fc]', accentText: 'text-white', isDark: true },
  { id: 'oceanic_elegance', name: 'Oceanic Elegance', category: 'color', bg: 'bg-[#0f172a]', keyBg: 'bg-[#0d9488]', keyText: 'text-white', accent: 'bg-[#2dd4bf]', accentText: 'text-white', isDark: true },
  { id: 'elegant_midnight_aqua', name: 'Elegant Midnight Aqua', category: 'color', bg: 'bg-[#000000]', keyBg: 'bg-[#008b8b]', keyText: 'text-white', accent: 'bg-[#00ced1]', accentText: 'text-white', isDark: true },
  { id: 'twilight_blossom', name: 'Twilight Blossom', category: 'color', bg: 'bg-[#000000]', keyBg: 'bg-[#ff69b4]', keyText: 'text-white', accent: 'bg-[#ffc0cb]', accentText: 'text-black', isDark: true },
  { id: 'peachy_marble', name: 'Peachy Marble', category: 'color', bg: 'bg-gradient-to-r from-[#f97316] to-[#fb923c]', keyBg: 'bg-white/20', keyText: 'text-white', accent: 'bg-white', accentText: 'text-orange-600', isDark: true },
  { id: 'aquamarine', name: 'Aquamarine', category: 'color', bg: 'bg-gradient-to-br from-[#0891b2] to-[#2dd4bf]', keyBg: 'bg-white/10', keyText: 'text-white', accent: 'bg-white', accentText: 'text-teal-600', isDark: true },

  // --- আরও থিম / Classics ---
  { id: 'ridmik_blue', name: 'Ridmik Blue', bg: 'bg-[#1e40af]', keyBg: 'bg-[#3b82f6]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-blue-700', isDark: true },
  { id: 'only_pink', name: 'Only Pink', bg: 'bg-[#be185d]', keyBg: 'bg-[#ec4899]', keyText: 'text-white', accent: 'bg-white', accentText: 'text-pink-600', isDark: true },
  { id: 'matte_black', name: 'Matte Black', bg: 'bg-[#121212]', keyBg: 'bg-[#2a2a2a]', keyText: 'text-slate-300', accent: 'bg-[#334155]', accentText: 'text-white', border: 'border-white/5', isDark: true },
  { id: 'shiny_black', name: 'Shiny Black', bg: 'bg-[#000000]', keyBg: 'bg-[#334155]', keyText: 'text-white', accent: 'bg-blue-600', accentText: 'text-white', isDark: true },
  { id: 'moonstruck_blue', name: 'Moonstruck Blue', bg: 'bg-[#001f3f]', keyBg: 'bg-[#003366]', keyText: 'text-white', accent: 'bg-[#0074D9]', accentText: 'text-white', isDark: true },
  { id: 'midnight_black', name: 'Midnight Black', bg: 'bg-[#111111]', keyBg: 'bg-black', keyText: 'text-white', accent: 'bg-slate-800', accentText: 'text-white', isDark: true },
  { id: 'midnight_green', name: 'Midnight Green', bg: 'bg-[#002b36]', keyBg: 'bg-[#073642]', keyText: 'text-white', accent: 'bg-[#2aa198]', accentText: 'text-white', isDark: true },
  { id: 'sour_grape', name: 'Sour Grape', bg: 'bg-[#2e1065]', keyBg: 'bg-[#4c1d95]', keyText: 'text-white', accent: 'bg-purple-400', accentText: 'text-white', isDark: true },
  { id: 'radiant_gray', name: 'Radiant Gray', bg: 'bg-[#262626]', keyBg: 'bg-[#404040]', keyText: 'text-white', accent: 'bg-[#525252]', accentText: 'text-white', isDark: true },
  { id: 'bleached_white', name: 'Bleached White', bg: 'bg-[#f1f5f9]', keyBg: 'bg-white', keyText: 'text-slate-700', accent: 'bg-slate-300', accentText: 'text-slate-900', border: 'border-slate-200', isDark: false },
  { id: 'nightfall', name: 'Nightfall', bg: 'bg-[#1e293b]', keyBg: 'bg-[#334155]', keyText: 'text-white', accent: 'bg-slate-700', accentText: 'text-white', isDark: true },
  { id: 'basic_border', name: 'Basic (Border)', bg: 'bg-[#121212]', keyBg: 'bg-[#1a1a1a]', keyText: 'text-white', accent: 'bg-slate-700', accentText: 'text-white', border: 'border-white/20', isDark: true },
  { id: 'basic_borderless', name: 'Basic (Borderless)', bg: 'bg-[#121212]', keyBg: 'bg-[#1a1a1a]', keyText: 'text-white', accent: 'bg-slate-700', accentText: 'text-white', border: 'border-transparent', isDark: true },
];
