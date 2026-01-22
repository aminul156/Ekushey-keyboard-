
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KeyboardLayout, AppSettings, ThemeConfig, KeyboardMode } from './types';
import { KEYBOARD_ROWS, SYMBOLS_ROWS, ARABIC_MAP, ARABIC_PHONETIC_MAP, JATIYO_MAP, UNIBIJOY_MAP, PHONETIC_MAP, NUMERIC_ROWS, NUMERALS, PROVHAT_MAP } from './constants/layouts';
import { KEYBOARD_THEMES } from './constants/themes';
import { GoogleGenAI, Modality } from '@google/genai';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const STORAGE_KEY = 'ekushey_kb_v3_settings';

const DEFAULT_SETTINGS: ExtendedAppSettings = {
  isSetupComplete: false,
  defaultLayout: KeyboardLayout.ENGLISH,
  fontSize: 18,
  theme: 'bleached_white',
  customThemeBrightness: 70,
  showKeyBorder: true,
  showSuggestions: true,
  showToolbar: true,
  physicalMapping: true,
  fontStyle: 'modern',
  autoCorrect: true,
  autoCapitalization: true,
  doubleSpacePeriod: true,
  doubleSpaceTab: false,
  clipboardRecentItems: true,
  showCopiedImages: true,
  vibrateOnKeypress: true,
  soundOnKeypress: false,
  popupOnKeypress: true,
  voiceInputKey: true,
  showEmojiKey: true,
  showGlobeKey: true,
  allowOtherKeyboards: false,
  moveCursorSpaceKey: true,
  volumeCursor: false,
  enableNumberRow: true,
  largeNumberRow: false,
  hideLongPressHints: false,
  enableResizing: true,
  heightPortrait: 100,
  heightLandscape: 100,
  oneHandedWidthPortrait: 85,
  oneHandedWidthLandscape: 40,
  enableSplitKeyboard: false,
  enableSplitFoldable: false,
  forcedEnterButton: true,
  portraitMode: 'standard',
  landscapeMode: 'standard',
  oneHandedSide: 'right',
  showFormatting: false,
  showComma: true,
  showPeriod: true,
  kbSize: 100,
  kbWidth: 100,
  posX: 0,
  posY: 0,
  kbTransparency: 100,
  keyPopupDismissDelay: 'Default',
  vibrationDuration: '10ms',
  soundVolume: 'Low',
  keyLongPressDelay: 300,
  spaceCursorLongPressDelay: 1000,
  spaceCursorSpeed: 150,
  emojiPhysicalKeyboard: true,
  showTypedWord: true,
  voiceTypingEngine: 'Google Voice Typing',
  enableSmartTyping: true,
  smartGrammar: true,
  smartWritingStyle: true,
  smartSummaries: true,
  smartBulletPoints: true,
  smartCompose: true,
  smartTranslate: true,
  enableDrawingAssist: true,
  enabledLayouts: [KeyboardLayout.ENGLISH, KeyboardLayout.BANGLA_AVRO, KeyboardLayout.BANGLA_JATIYO]
};

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
}

const App: React.FC = () => {
  const [setupStep, setSetupStep] = useState<number>(0);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [text, setText] = useState<string>('');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [layout, setLayout] = useState<KeyboardLayout>(KeyboardLayout.ENGLISH);
  const [isShifted, setIsShifted] = useState<boolean>(false);
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [isSymbolMode, setIsSymbolMode] = useState<boolean>(false);
  const [isNumericMode, setIsNumericMode] = useState<boolean>(false);
  const [numericSubLang, setNumericSubLang] = useState<'en' | 'bn' | 'ar'>('en');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsSubPage, setSettingsSubPage] = useState<null | string>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Resize interaction states
  const [resizeMode, setResizeMode] = useState<'none' | 'height' | 'width' | 'move'>('none');
  const interactionRef = useRef({ startX: 0, startY: 0, startVal: 0, startVal2: 0 });

  const phoneticBuffer = useRef<string>('');
  const lastInsertedLength = useRef<number>(0);
  const lastSpaceTime = useRef<number>(0);
  const swipeStartX = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [settings, setSettings] = useState<ExtendedAppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const activeTheme = useMemo(() => {
    let theme = KEYBOARD_THEMES.find(t => t.id === settings.theme) || KEYBOARD_THEMES[0];
    if (!settings.showKeyBorder) return { ...theme, keyBg: 'bg-transparent', border: 'border-transparent' };
    return theme;
  }, [settings.theme, settings.showKeyBorder]);

  const spacebarLabel = useMemo(() => {
    switch (layout) {
      case KeyboardLayout.ENGLISH: return 'English';
      case KeyboardLayout.BANGLA_AVRO: return 'অভ্র';
      case KeyboardLayout.BANGLA_JATIYO: return 'জাতীয়';
      case KeyboardLayout.ARABIC: return 'العربية';
      default: return 'Space';
    }
  }, [layout]);

  const getScriptClass = useCallback((l: KeyboardLayout) => {
    if (l === KeyboardLayout.BANGLA_AVRO || l === KeyboardLayout.BANGLA_JATIYO || l === KeyboardLayout.BANGLA_UNIBIJOY || l === KeyboardLayout.BANGLA_PROVHAT) return 'font-bangla';
    if (l === KeyboardLayout.ARABIC || l === KeyboardLayout.ARABIC_PHONETIC) return 'font-arabic';
    return 'font-inter';
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (activeTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings, activeTheme]);

  const resetAllSettings = () => {
    if (window.confirm("আপনি কি সব সেটিংস রিসেট করতে চান?")) {
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
        setSetupStep(0);
    }
  };

  const updateTextWithHistory = (newText: string) => {
    if (newText === text) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newText);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setText(newText);
  };

  const handleBackspace = () => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    if (selectionStart === selectionEnd && selectionStart > 0) {
      const newText = text.substring(0, selectionStart - 1) + text.substring(selectionEnd);
      updateTextWithHistory(newText);
    } else {
      const newText = text.substring(0, selectionStart) + text.substring(selectionEnd);
      updateTextWithHistory(newText);
    }
  };

  // Fix: Defined getMappedChar here so it can be used in insertChar and the UI
  const getMappedChar = useCallback((key: string) => {
    if (isSymbolMode || isNumericMode) return key;
    const isShift = isShifted || isCapsLock;
    if (layout === KeyboardLayout.ENGLISH) return isShift ? key.toUpperCase() : key;
    const map = layout === KeyboardLayout.BANGLA_JATIYO ? JATIYO_MAP : 
                layout === KeyboardLayout.ARABIC ? ARABIC_MAP : 
                layout === KeyboardLayout.BANGLA_PROVHAT ? PROVHAT_MAP :
                layout === KeyboardLayout.BANGLA_UNIBIJOY ? UNIBIJOY_MAP : null;
    if (map && map[key]) return map[key];
    return isShift ? key.toUpperCase() : key;
  }, [isSymbolMode, isNumericMode, isShifted, isCapsLock, layout]);

  // Fix: Corrected insertChar to use getMappedChar for non-phonetic layouts
  const insertChar = (char: string) => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    
    const isPhonetic = layout === KeyboardLayout.BANGLA_AVRO;
    let charToInsert = isPhonetic ? char : getMappedChar(char);
    
    if (isPhonetic && !isSymbolMode && !isNumericMode && char.match(/[a-zA-Z]/)) {
        const map = PHONETIC_MAP;
        const currentInput = isShifted || isCapsLock ? char.toUpperCase() : char.toLowerCase();
        const newBuffer = phoneticBuffer.current + currentInput;
        let match = '';
        for (let i = Math.min(newBuffer.length, 3); i >= 1; i--) {
            const part = newBuffer.slice(-i);
            if (map[part]) { match = map[part]; break; }
        }
        if (match) { 
            charToInsert = match; 
            phoneticBuffer.current = newBuffer; 
            const newText = text.substring(0, selectionStart - lastInsertedLength.current) + charToInsert + text.substring(selectionEnd);
            updateTextWithHistory(newText);
            lastInsertedLength.current = charToInsert.length;
            return;
        } else {
            charToInsert = currentInput;
            phoneticBuffer.current = currentInput;
            lastInsertedLength.current = 1;
        }
    } else {
        phoneticBuffer.current = '';
        lastInsertedLength.current = charToInsert.length;
    }

    const newText = text.substring(0, selectionStart) + charToInsert + text.substring(selectionEnd);
    updateTextWithHistory(newText);
  };

  const toggleVoiceInput = () => {
    if (isRecording) setIsRecording(false);
    else setIsRecording(true);
  };

  const handleInteractionStart = (mode: 'height' | 'width' | 'move', e: React.PointerEvent) => {
    setResizeMode(mode);
    interactionRef.current = { startX: e.clientX, startY: e.clientY, startVal: mode === 'height' ? settings.heightPortrait : settings.kbWidth, startVal2: settings.posX };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleInteractionMove = (e: React.PointerEvent) => {
    if (resizeMode === 'none') return;
    const diffY = interactionRef.current.startY - e.clientY;
    const diffX = e.clientX - interactionRef.current.startX;
    if (resizeMode === 'height') setSettings(s => ({ ...s, heightPortrait: Math.max(50, Math.min(200, interactionRef.current.startVal + diffY / 2)) }));
    if (resizeMode === 'width') setSettings(s => ({ ...s, kbWidth: Math.max(40, Math.min(100, interactionRef.current.startVal + diffX / 5)) }));
    if (resizeMode === 'move') setSettings(s => ({ ...s, posX: interactionRef.current.startVal2 + diffX }));
  };

  const renderSetupWizard = () => {
    const stepsCount = 7;
    const progressNumbers = ['১', '২', '৩', '৪', '৫', '৬', '৭'];

    const renderHeader = () => (
      <div className="flex flex-col items-center pt-8 mb-6 font-bangla">
        <h1 className="text-4xl font-bold text-slate-600 mb-2">একুশে বাংলা কীবোর্ড</h1>
        <h2 className="text-3xl font-light text-slate-400">সেট আপ হচ্ছে</h2>
        <div className="flex gap-10 mt-12">
            {progressNumbers.map((n, i) => (
                <span key={i} className={`text-xl ${setupStep === i + 1 ? 'text-teal-600 font-bold border-b-4 border-teal-600 pb-1' : 'text-slate-300'}`}>{n}</span>
            ))}
        </div>
      </div>
    );

    const renderFooter = () => (
      <div className="mt-auto py-8 border-t border-slate-100 flex items-center justify-center gap-4 text-slate-500 font-bangla">
         <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"/></svg>
         <div>
            <p className="font-bold text-teal-800 text-lg">আপনার ডাটা নিরাপদ</p>
            <p className="text-sm opacity-60">একুশে বাংলা কীবোর্ড আপনার কোনো তথ্য সংগ্রহ করে না।</p>
         </div>
      </div>
    );

    const cardClass = "bg-white rounded-[2rem] shadow-sm border border-slate-100 p-8 w-full max-w-xl flex flex-col items-center gap-6";
    const btnClass = "w-full py-5 text-teal-600 font-bold text-xl border-t border-slate-50 hover:bg-slate-50 transition-colors";

    if (setupStep === 0) {
        return (
            <div className="flex flex-col items-center h-full p-6 animate-in fade-in duration-500">
                {renderHeader()}
                <div className={cardClass + " mt-8"}>
                    <h3 className="text-2xl font-bold font-bangla">সেট আপ শুরু করুন</h3>
                    <p className="text-slate-500 font-bangla text-center">একুশে বাংলা কীবোর্ড ব্যবহার করতে হলে আপনাকে কয়েকটি ধাপ সম্পন্ন করতে হবে।</p>
                    <button onClick={() => setSetupStep(1)} className={btnClass}>সেট আপ শুরু করুন</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 1) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">কীবোর্ড অন করুন</h3>
                    <p className="text-slate-500 text-center">অনুগ্রহ করে আপনার ভাষা ও ইনপুট সেটিংসে একুশে কীবোর্ড অন করুন। এর ফলে এটি আপনার ডিভাইসে চলার অনুমতি পাবে।</p>
                    <button onClick={() => setSetupStep(2)} className={btnClass + " flex items-center justify-center gap-3"}><span className="text-2xl">🌐</span> সেটিংস অন করুন</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 2) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">কীবোর্ড সুইচ করুন</h3>
                    <p className="text-slate-500 text-center">আপনার কীবোর্ড পরিবর্তন করুন এবং একুশে বাংলা কীবোর্ড নির্বাচন করুন।</p>
                    <button onClick={() => setSetupStep(3)} className={btnClass + " flex items-center justify-center gap-3"}><span className="text-2xl">⌨️</span> কীবোর্ড পরিবর্তন করুন</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 3) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">বাংলা লেখার পদ্ধতি পছন্দ করুন</h3>
                    <p className="text-slate-500 text-center text-sm">আপনার পছন্দের বাংলা লে-আউট নির্বাচন করুন (পরবর্তীতে পরিবর্তন করা যাবে)।</p>
                    <div className="w-full space-y-3 mt-2">
                        {[KeyboardLayout.BANGLA_AVRO, KeyboardLayout.BANGLA_JATIYO, KeyboardLayout.BANGLA_PROVHAT].map(l => (
                           <div key={l} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                               <input type="checkbox" checked={settings.enabledLayouts.includes(l)} onChange={() => {
                                   const exists = settings.enabledLayouts.includes(l);
                                   const next = exists ? settings.enabledLayouts.filter(x => x !== l) : [...settings.enabledLayouts, l];
                                   setSettings({...settings, enabledLayouts: next});
                               }} className="w-6 h-6 accent-teal-600" />
                               <span className="text-lg font-bold">{l}</span>
                           </div>
                        ))}
                    </div>
                    <button onClick={() => setSetupStep(4)} className={btnClass}>পরের ধাপে যান</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 4) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">ভাষা পরিবর্তনের বাটন</h3>
                    <p className="text-slate-500 text-center">আপনি স্পেস বারে সোয়াইপ করে অথবা গ্লোব আইকনে ক্লিক করে ভাষা পরিবর্তন করতে পারবেন।</p>
                    <div className="flex justify-between items-center w-full p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold">অতিরিক্ত বাটন ব্যবহার করুন</span>
                        <div onClick={() => setSettings({...settings, showGlobeKey: !settings.showGlobeKey})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.showGlobeKey ? 'bg-teal-600' : 'bg-slate-300'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.showGlobeKey ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    <button onClick={() => setSetupStep(5)} className={btnClass}>পরের ধাপে যান</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 5) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">কীবোর্ডের উচ্চতা</h3>
                    <p className="text-slate-500">কীবোর্ডের উচ্চতা ঠিক করুন</p>
                    <div className="w-full space-y-6 mt-4">
                        <div className="flex justify-between text-slate-400 font-bold"><span>স্বাভাবিক</span><span>সম্প্রসারিত</span></div>
                        <input type="range" min="50" max="150" value={settings.heightPortrait} onChange={(e) => setSettings({...settings, heightPortrait: parseInt(e.target.value)})} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-teal-600" />
                    </div>
                    <button onClick={() => setSetupStep(6)} className={btnClass}>পরের ধাপে যান</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 6) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-2xl font-bold">নম্বর সারি</h3>
                    <p className="text-slate-500 text-center">নম্বর সারিটি কীবোর্ডে একটি অতিরিক্ত সারি যুক্ত করবে।</p>
                    <div className="flex justify-between items-center w-full p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold">নম্বর সারি যুক্ত করুন</span>
                        <div onClick={() => setSettings({...settings, enableNumberRow: !settings.enableNumberRow})} className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.enableNumberRow ? 'bg-teal-600' : 'bg-slate-300'}`}>
                             <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.enableNumberRow ? 'translate-x-6' : 'translate-x-0'}`}></div>
                        </div>
                    </div>
                    <button onClick={() => setSetupStep(7)} className={btnClass}>পরের ধাপে যান</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    if (setupStep === 7) {
        return (
            <div className="flex flex-col items-center h-full p-6 font-bangla animate-in zoom-in duration-500">
                {renderHeader()}
                <div className={cardClass}>
                    <h3 className="text-3xl font-black text-orange-500">অভিনন্দন!</h3>
                    <h3 className="text-2xl font-bold">আপনি পুরোপুরি প্রস্তুত</h3>
                    <p className="text-slate-500 text-center">আপনার কীবোর্ড সেটআপ সম্পন্ন হয়েছে। আপনি চাইলে সেটিংস ঠিক করতে পারেন।</p>
                    <button onClick={() => setSettings({...settings, isSetupComplete: true})} className={btnClass}>সেট আপ শেষ করুন</button>
                </div>
                {renderFooter()}
            </div>
        );
    }

    return null;
  };

  // Fix: Defined currentRows to provide the layout data for the keyboard grid
  const currentRows = useMemo(() => {
    if (isNumericMode) return NUMERIC_ROWS;
    if (isSymbolMode) return SYMBOLS_ROWS;
    
    let base = [...KEYBOARD_ROWS];
    if (settings.enableNumberRow) {
      base = [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ...base];
    }
    return base;
  }, [isNumericMode, isSymbolMode, settings.enableNumberRow]);

  // Fix: Defined switchLayout to cycle through enabled language layouts
  const switchLayout = useCallback((direction: 'next' | 'prev') => {
    const currentIndex = settings.enabledLayouts.indexOf(layout);
    if (currentIndex === -1) {
      setLayout(settings.enabledLayouts[0] || KeyboardLayout.ENGLISH);
      return;
    }
    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % settings.enabledLayouts.length;
    } else {
      nextIndex = (currentIndex - 1 + settings.enabledLayouts.length) % settings.enabledLayouts.length;
    }
    setLayout(settings.enabledLayouts[nextIndex]);
  }, [layout, settings.enabledLayouts]);

  const keyboardStyles = useMemo(() => ({
    width: `${settings.kbWidth}%`,
    transform: `translate(${settings.posX}px, ${settings.posY}px)`,
    height: `${(settings.heightPortrait / 100) * 320}px`,
    opacity: settings.kbTransparency / 100,
    transition: resizeMode !== 'none' ? 'none' : 'all 0.3s cubic-bezier(0.2, 0, 0, 1)'
  }), [settings, resizeMode]);

  // Main Render logic
  if (!settings.isSetupComplete) {
    return <div className="min-h-screen bg-[#f8fafc] text-slate-900 overflow-y-auto">{renderSetupWizard()}</div>;
  }

  return (
    <div className={`min-h-screen transition-all duration-700 ${activeTheme.bg} ${activeTheme.isDark ? 'text-white' : 'text-slate-900'} flex flex-col items-center overflow-hidden relative`}>
      {/* Settings Modal (Simplified) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[1000] bg-white dark:bg-slate-900 overflow-y-auto p-6 font-bangla">
           <header className="flex items-center gap-4 mb-8">
              <button onClick={() => setIsSettingsOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">←</button>
              <h2 className="text-2xl font-bold">সেটিংস</h2>
           </header>
           <div className="space-y-4">
              <button onClick={resetAllSettings} className="w-full p-6 bg-red-50 text-red-600 rounded-3xl font-bold border border-red-100">রিসেট সেটআপ</button>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl font-bold">বন্ধ করুন</button>
           </div>
        </div>
      )}

      {/* Main App Content */}
      <main className="w-full max-w-4xl h-full flex flex-col p-6 gap-6 z-10">
        <div className={`glass-panel rounded-[2.5rem] shadow-2xl border-t-2 border-blue-500/30 p-8 transition-all relative ${showDashboard ? 'flex-1' : 'h-40'}`}>
            <textarea ref={textareaRef} value={text} onFocus={() => setShowDashboard(false)} onChange={(e) => updateTextWithHistory(e.target.value)} placeholder="টাইপ করা শুরু করুন..." style={{ fontSize: `${settings.fontSize}px` }} className={`w-full h-full bg-transparent border-none focus:ring-0 resize-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 font-medium ${getScriptClass(layout)}`} dir={layout.includes('Arabic') ? 'rtl' : 'ltr'} />
        </div>

        {showDashboard ? (
          <div className="flex-1 flex flex-col justify-center animate-in zoom-in-95 duration-500 font-bangla">
             <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'সেটিংস', icon: '⚙️', onClick: () => setIsSettingsOpen(true) },
                  { label: 'অনুশীলন', icon: '⌨️', onClick: () => { setShowDashboard(false); setTimeout(() => textareaRef.current?.focus(), 100); } },
                  { label: 'কী-ম্যাপ', icon: '🗺️', onClick: () => {} },
                  { label: 'রিসেট', icon: '🔄', onClick: resetAllSettings }
                ].map(card => (
                  <button key={card.label} onClick={card.onClick} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl flex flex-col items-center gap-4 active:scale-95 transition-all border border-slate-50 dark:border-white/5">
                      <span className="text-4xl">{card.icon}</span>
                      <span className="font-black text-lg">{card.label}</span>
                  </button>
                ))}
             </div>
          </div>
        ) : (
          <div style={keyboardStyles} className={`glass-panel rounded-[2rem] p-4 shadow-2xl ${activeTheme.bg} relative flex flex-col animate-in slide-in-from-bottom duration-400 mx-auto touch-none border ${resizeMode !== 'none' ? 'border-teal-400 border-dashed scale-[1.02]' : 'border-transparent'}`}>
              <div className="flex items-center h-12 px-2 gap-1 border-b dark:border-white/10 mb-2 overflow-x-auto no-scrollbar">
                  <button onClick={() => setShowDashboard(true)} className="p-2.5 opacity-60">🏠</button>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 opacity-60">⚙️</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className="p-2.5 text-sm font-black opacity-60">🔢</button>
                  <button onClick={() => setIsEmojiOpen(true)} className="p-2.5 opacity-60">😊</button>
                  <button onClick={toggleVoiceInput} className={`p-2.5 ${isRecording ? 'text-red-500 animate-pulse' : 'opacity-60'}`}>🎤</button>
              </div>

              <div className="flex flex-col gap-1 flex-grow justify-end pb-2">
                  {currentRows.map((row, i) => (
                    <div key={i} className="flex justify-center gap-1">
                        {((settings.enableNumberRow && i === 3) || (!settings.enableNumberRow && i === 2)) && (
                           <button onMouseDown={e => {e.preventDefault(); setIsShifted(!isShifted)}} className={`h-10 w-12 rounded-xl font-black text-xs transition-all ${isShifted ? activeTheme.accent + ' ' + activeTheme.accentText : 'bg-white/10 ' + activeTheme.keyText}`}>▲</button>
                        )}
                        {row.map(key => (
                           <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-10 flex-1 rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-[15px] active:scale-95 transition-all ${getScriptClass(layout)}`}>{getMappedChar(key)}</button>
                        ))}
                        {((settings.enableNumberRow && i === 2) || (!settings.enableNumberRow && i === 1)) && !isNumericMode && (
                          <button onMouseDown={e => {e.preventDefault(); handleBackspace()}} className="h-10 w-12 rounded-xl bg-white/10 flex items-center justify-center opacity-70">⌫</button>
                        )}
                    </div>
                  ))}
                  <div className="flex justify-center gap-1 mt-1">
                      <button onClick={() => setIsSymbolMode(!isSymbolMode)} className="h-11 w-16 rounded-xl bg-white/10 text-xs font-bold">{isSymbolMode ? 'ABC' : '!?#'}</button>
                      <button onPointerDown={e => {swipeStartX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId)}} onPointerUp={e => {if (swipeStartX.current !== null){ const diff = e.clientX - swipeStartX.current; if (Math.abs(diff) > 40) switchLayout(diff > 0 ? 'prev' : 'next'); else insertChar(' '); swipeStartX.current = null; }}} className="h-11 flex-[4] rounded-xl bg-white/10 text-xs font-bold uppercase">{spacebarLabel}</button>
                      <button onMouseDown={e => {e.preventDefault(); insertChar('\n')}} className={`h-11 w-16 rounded-xl ${activeTheme.accent} ${activeTheme.accentText} font-bold text-xs`}>DONE</button>
                  </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
