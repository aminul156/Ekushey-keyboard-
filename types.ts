
export enum KeyboardLayout {
  ENGLISH = 'English',
  ARABIC = 'Arabic',
  ARABIC_PHONETIC = 'Arabic Phonetic',
  BANGLA_AVRO = 'Avro',
  BANGLA_JATIYO = 'Jatiyo',
  BANGLA_UNIBIJOY = 'UniBijoy',
  BANGLA_PROVHAT = 'Provhat'
}

export type TypographyStyle = 'modern' | 'classic' | 'bold' | 'artistic';
export type KeyboardMode = 'standard' | 'one-handed' | 'split' | 'floating';

export interface KeyMap {
  [key: string]: string;
}

export interface KeyboardState {
  isShifted: boolean;
  isCapsLock: boolean;
  layout: KeyboardLayout;
}

export interface ThemeConfig {
  id: string;
  name: string;
  bg: string;
  keyBg: string;
  keyText: string;
  accent: string;
  accentText: string;
  border?: string;
  isDark: boolean;
}

export interface AppSettings {
  defaultLayout: KeyboardLayout;
  fontSize: number;
  theme: string;
  customThemeImage?: string; 
  customThemeBrightness?: number; 
  showKeyBorder: boolean; // New: Toggle key borders/outlines
  showSuggestions: boolean;
  showToolbar: boolean;
  physicalMapping: boolean;
  fontStyle: TypographyStyle;
  autoCorrect: boolean;
  // Preferences
  autoCapitalization: boolean;
  doubleSpacePeriod: boolean;
  doubleSpaceTab: boolean;
  clipboardRecentItems: boolean;
  showCopiedImages: boolean;
  vibrateOnKeypress: boolean;
  soundOnKeypress: boolean;
  popupOnKeypress: boolean;
  voiceInputKey: boolean;
  showEmojiKey: boolean;
  showGlobeKey: boolean;
  allowOtherKeyboards: boolean;
  moveCursorSpaceKey: boolean;
  volumeCursor: boolean;
  // Appearance & Layout
  enableNumberRow: boolean;
  largeNumberRow: boolean;
  hideLongPressHints: boolean;
  enableResizing: boolean;
  heightPortrait: number;
  heightLandscape: number;
  oneHandedWidthPortrait: number;
  oneHandedWidthLandscape: number;
  enableSplitKeyboard: boolean;
  enableSplitFoldable: boolean;
  forcedEnterButton: boolean;
  // Keyboard Mode
  portraitMode: KeyboardMode;
  landscapeMode: KeyboardMode;
  oneHandedSide: 'left' | 'right';
  // Layout Options
  showFormatting: boolean;
  showComma: boolean;
  showPeriod: boolean;
  // Size & Transparency
  kbSize: number;
  kbTransparency: number;
  // Advanced Settings
  keyPopupDismissDelay: string;
  vibrationDuration: string;
  soundVolume: string;
  keyLongPressDelay: number;
  spaceCursorLongPressDelay: number;
  spaceCursorSpeed: number;
  emojiPhysicalKeyboard: boolean;
  showTypedWord: boolean;
  voiceTypingEngine: string;
  // Smart Typing
  enableSmartTyping: boolean;
  smartGrammar: boolean;
  smartWritingStyle: boolean;
  smartSummaries: boolean;
  smartBulletPoints: boolean;
  smartCompose: boolean;
  smartTranslate: boolean;
  enableDrawingAssist: boolean;
}
