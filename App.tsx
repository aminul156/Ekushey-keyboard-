
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KeyboardLayout, AppSettings, ThemeConfig, KeyboardMode } from './types';
import { KEYBOARD_ROWS, SYMBOLS_ROWS, ARABIC_MAP, ARABIC_PHONETIC_MAP, JATIYO_MAP, UNIBIJOY_MAP, PHONETIC_MAP, PHONETIC_VOWEL_FULL, NUMERIC_ROWS, NUMERALS, PROVHAT_MAP } from './constants/layouts';
import { KEYBOARD_THEMES } from './constants/themes';
import { getAIAssistance } from './services/geminiService';

const STORAGE_KEY = 'ekushey_kb_v3_settings';

const ALL_LAYOUTS = [
  KeyboardLayout.BANGLA_AVRO, 
  KeyboardLayout.ENGLISH, 
  KeyboardLayout.BANGLA_JATIYO, 
  KeyboardLayout.BANGLA_UNIBIJOY,
  KeyboardLayout.BANGLA_PROVHAT,
  KeyboardLayout.ARABIC
];

const QUICK_RESPONSES: Record<string, string[]> = {
  'bn': ["কেমন আছেন?", "ধন্যবাদ", "হ্যাঁ", "না", "আমি ব্যস্ত আছি", "পরে কথা হবে", "কোথায় আপনি?", "শুভ সকাল", "ঠিক আছে", "স্বাগতম", "আলহামদুলিল্লাহ", "মাফ করবেন"],
  'en': ["How are you?", "Thank you", "Yes", "No", "I'm busy", "Talk later", "Where are you?", "Good morning", "OK", "Welcome", "I'm on my way", "Sorry"],
  'ar': ["كيف حالك؟", "شكراً", "نعم", "لا", "أنا مشغول", "نتحدث لاحقاً", "أين أنت؟", "صباح الخير", "حسناً", "أهلاً", "الحمد لله", "عفواً"]
};

const DEFAULT_SETTINGS: ExtendedAppSettings = {
  isSetupComplete: false,
  defaultLayout: KeyboardLayout.BANGLA_AVRO,
  fontSize: 18,
  theme: 'matte_black',
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
  soundVolume: '50',
  soundProfile: 'Click',
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
  enableBanglaInNumberPad: true,
  oldStyleReph: false,
  autoVowelForming: true,
  enabledLayouts: ALL_LAYOUTS
};

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
  soundProfile: string;
}

type SettingsView = 'main' | 'appearance' | 'preference' | 'layout' | 'mode' | 'smart' | 'advance';

// --- Handwriting Component ---
const HandwritingCanvas: React.FC<{
  onClose: () => void;
  onRecognize: (base64: string) => void;
  isDark: boolean;
  isLoading: boolean;
}> = ({ onClose, onRecognize, isDark, isLoading }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = 200;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5;
      ctx.strokeStyle = isDark ? '#ffffff' : '#000000';
    }
  }, [isDark]);

  const startDrawing = (e: React.PointerEvent) => {
    setIsDrawing(true);
    setHasContent(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const rect = canvas.getBoundingClientRect();
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const stopDrawing = () => setIsDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasContent(false);
    }
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent && !isLoading) {
      if (navigator.vibrate) navigator.vibrate(30);
      const base64 = canvas.toDataURL('image/png').split(',')[1];
      onRecognize(base64);
      clear();
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="relative bg-black/10 rounded-2xl border border-white/10 h-[200px] overflow-hidden touch-none shadow-inner">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          className="w-full h-full cursor-crosshair"
        />
        {!hasContent && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40 text-white font-bangla text-xl">
            এখানে আঁকুন বা লিখুন...
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-white text-sm font-black uppercase tracking-widest animate-pulse">অনুসন্ধান করা হচ্ছে...</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2">
          <span>⌨️</span>
        </button>
        <button onClick={clear} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black transition-all active:scale-95">মুছুন</button>
        <button 
          onClick={handleDone} 
          disabled={isLoading || !hasContent} 
          className={`flex-[2] py-4 rounded-2xl font-black text-lg shadow-xl transition-all active:scale-95 ${isLoading || !hasContent ? 'bg-slate-700 opacity-50 text-slate-400' : 'bg-teal-500 text-white hover:bg-teal-400'}`}
        >
          {isLoading ? '...' : 'ঠিক আছে'}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [setupStep, setSetupStep] = useState<number>(1);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [text, setText] = useState<string>('');
  const [layout, setLayout] = useState<KeyboardLayout>(KeyboardLayout.BANGLA_AVRO);
  const [isShifted, setIsShifted] = useState<boolean>(false);
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [isNumericMode, setIsNumericMode] = useState<boolean>(false);
  const [isHandwritingMode, setIsHandwritingMode] = useState<boolean>(false);
  const [isQuickMatrixOpen, setIsQuickMatrixOpen] = useState<boolean>(false);
  const [isTranslateOpen, setIsTranslateOpen] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isResizingMode, setIsResizingMode] = useState<boolean>(false);
  
  const [translateFrom, setTranslateFrom] = useState<string>('Auto');
  const [translateTo, setTranslateTo] = useState<string>('English');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  
  const phoneticBuffer = useRef<string>('');
  const lastInsertedLen = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const spaceRef = useRef<HTMLButtonElement>(null);
  const startX = useRef<number | null>(null);
  const resizeStartY = useRef<number | null>(null);
  const resizeStartSize = useRef<number>(100);
  const isSwiping = useRef<boolean>(false);
  
  const [settings, setSettings] = useState<ExtendedAppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_SETTINGS, ...parsed, enabledLayouts: ALL_LAYOUTS };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const activeTheme = useMemo(() => {
    return KEYBOARD_THEMES.find(t => t.id === settings.theme) || KEYBOARD_THEMES[0];
  }, [settings.theme]);

  const playClickSound = useCallback(() => {
    if (!settings.soundOnKeypress) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      const vol = (parseInt(settings.soundVolume) || 50) / 500; // Normalized volume

      switch(settings.soundProfile) {
        case 'Tink':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(900, ctx.currentTime);
          break;
        case 'Bubble':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.04);
          break;
        case 'Mechanical':
          osc.type = 'square';
          osc.frequency.setValueAtTime(120, ctx.currentTime);
          break;
        default: // Click
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, ctx.currentTime);
      }
      
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn("Audio Context Error", e);
    }
  }, [settings.soundOnKeypress, settings.soundVolume, settings.soundProfile]);

  const cycleLayout = useCallback((direction: 'next' | 'prev' = 'next') => {
    const layouts = settings.enabledLayouts;
    const currentIdx = layouts.indexOf(layout);
    let nextIdx;
    if (direction === 'next') {
      nextIdx = (currentIdx + 1) % layouts.length;
    } else {
      nextIdx = (currentIdx - 1 + layouts.length) % layouts.length;
    }
    setLayout(layouts[nextIdx]);
    if (navigator.vibrate) navigator.vibrate(20);
    playClickSound();
  }, [layout, settings.enabledLayouts, playClickSound]);

  const updateTextAndCursor = (newText: string, newCursorPos: number) => {
    setText(newText);
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const getMappedChar = useCallback((key: string) => {
    if (isNumericMode) {
      if (!settings.enableBanglaInNumberPad) return key;
      const numMap = NUMERALS['bn'];
      const num = parseInt(key);
      return isNaN(num) ? key : numMap[num === 0 ? 9 : num - 1];
    }
    const isShift = isShifted || isCapsLock;
    if (layout === KeyboardLayout.ENGLISH) return isShift ? key.toUpperCase() : key;
    
    let map = null;
    if (layout === KeyboardLayout.BANGLA_JATIYO) map = JATIYO_MAP;
    else if (layout === KeyboardLayout.BANGLA_UNIBIJOY) map = UNIBIJOY_MAP;
    else if (layout === KeyboardLayout.BANGLA_PROVHAT) map = PROVHAT_MAP;
    else if (layout === KeyboardLayout.ARABIC) map = ARABIC_MAP;
    
    if (map && map[key]) return map[key];
    return isShift ? key.toUpperCase() : key;
  }, [isNumericMode, isShifted, isCapsLock, layout, settings.enableBanglaInNumberPad]);

  const insertChar = useCallback((char: string) => {
    playClickSound();
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    let currentText = text.substring(0, start) + text.substring(end);
    let insertionIndex = start;

    if (layout === KeyboardLayout.BANGLA_AVRO && !isNumericMode && !isHandwritingMode && char.match(/[a-zA-Z\^`':]/)) {
        if (char === '`') { phoneticBuffer.current = ''; lastInsertedLen.current = 0; return; }
        const prevChar = currentText[insertionIndex - 1] || ' ';
        const isStart = settings.autoVowelForming && (insertionIndex === 0 || prevChar === ' ' || prevChar === '\n' || prevChar === '।');
        const currentInput = isShifted || isCapsLock ? char.toUpperCase() : char.toLowerCase();
        
        const fullBuffer = phoneticBuffer.current + currentInput;
        let match = ''; let matchLen = 0;
        
        for (let i = Math.min(fullBuffer.length, 3); i >= 1; i--) {
            const part = fullBuffer.slice(-i);
            if (isStart && PHONETIC_VOWEL_FULL[part]) { match = PHONETIC_VOWEL_FULL[part]; matchLen = i; break; }
            else if (PHONETIC_MAP[part]) { match = PHONETIC_MAP[part]; matchLen = i; break; }
        }

        if (match !== '') {
            const backTrack = (matchLen > 1) ? lastInsertedLen.current : 0;
            updateTextAndCursor(currentText.substring(0, insertionIndex - backTrack) + match + currentText.substring(insertionIndex), insertionIndex - backTrack + match.length);
            phoneticBuffer.current = fullBuffer; lastInsertedLen.current = match.length;
            return;
        }
    }

    const charToInsert = isHandwritingMode ? char : (isQuickMatrixOpen ? char : getMappedChar(char));
    updateTextAndCursor(currentText.substring(0, insertionIndex) + charToInsert + currentText.substring(insertionIndex), insertionIndex + charToInsert.length);
    phoneticBuffer.current = ''; lastInsertedLen.current = 0;
  }, [text, layout, isNumericMode, isShifted, isCapsLock, settings, getMappedChar, isHandwritingMode, isQuickMatrixOpen, playClickSound]);

  const handleHandwritingRecognition = async (base64: string) => {
    setIsRecognizing(true);
    try {
      const targetLang = layout === KeyboardLayout.ARABIC ? 'Arabic' : (layout === KeyboardLayout.ENGLISH ? 'English' : 'Bangla');
      const result = await getAIAssistance("", 'handwriting', { imageData: base64, language: targetLang });
      if (result) {
        insertChar(result);
      }
    } catch (err) {
      console.error("Handwriting error:", err);
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleTranslateAction = async () => {
    if (!text.trim() || isTranslating) return;
    setIsTranslating(true);
    if (navigator.vibrate) navigator.vibrate(20);
    try {
      const result = await getAIAssistance(text, 'translate', { from: translateFrom, to: translateTo });
      if (result) {
        setText(result);
        if (navigator.vibrate) navigator.vibrate(50);
      }
    } catch (err) {
      console.error("Translate error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  const toggleVoiceTyping = useCallback(() => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice typing is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = layout === KeyboardLayout.ARABIC ? 'ar-SA' : 
                       (layout === KeyboardLayout.ENGLISH ? 'en-US' : 'bn-BD');
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        insertChar(transcript + " ");
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error("Voice typing start error:", e);
      setIsListening(false);
    }
  }, [isListening, layout, insertChar]);

  const onSpacePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    startX.current = e.clientX;
    isSwiping.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSpacePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startX.current === null) return;
    const diffX = Math.abs(e.clientX - startX.current);
    if (diffX > 8) {
      isSwiping.current = true;
    }
  };

  const onSpacePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (startX.current === null) return;
    const totalDiffX = e.clientX - startX.current;
    const swipeThreshold = 30;

    if (Math.abs(totalDiffX) > swipeThreshold) {
      cycleLayout(totalDiffX > 0 ? 'prev' : 'next');
    } else if (!isSwiping.current) {
      insertChar(' ');
    }
    
    startX.current = null;
    isSwiping.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    resizeStartY.current = e.clientY;
    resizeStartSize.current = settings.kbSize;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent) => {
    if (resizeStartY.current === null) return;
    const diffY = resizeStartY.current - e.clientY;
    const newSize = Math.max(50, Math.min(150, resizeStartSize.current + (diffY / 2)));
    setSettings(prev => ({ ...prev, kbSize: newSize }));
  };

  const handleResizePointerUp = (e: React.PointerEvent) => {
    resizeStartY.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, customThemeImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderSettings = () => {
    const Toggle = ({ label, value, onChange }: { label: string, value: boolean, onChange: (v: boolean) => void }) => (
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-white/5 shadow-sm">
        <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
        <button onClick={() => onChange(!value)} className={`w-12 h-6 rounded-full relative transition-colors ${value ? 'bg-teal-500' : 'bg-slate-300'}`}>
          <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );

    return (
      <div className="fixed inset-0 z-[3000] bg-slate-50 dark:bg-slate-950 p-6 flex flex-col font-bangla animate-in slide-in-from-right overflow-y-auto">
        <header className="flex items-center gap-4 mb-8">
          <button onClick={() => settingsView === 'main' ? setIsSettingsOpen(false) : setSettingsView('main')} className="p-3 bg-white dark:bg-slate-800 rounded-2xl">
            {settingsView === 'main' ? '✕' : '←'}
          </button>
          <h2 className="text-2xl font-black">সেটিংস</h2>
        </header>

        <div className="max-w-xl mx-auto w-full space-y-4 pb-20">
          {settingsView === 'main' && (
            <div className="grid gap-3">
              <button onClick={() => setSettingsView('appearance')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">🎨</span><span className="font-black">চেহারা ও থিম (Themes)</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('preference')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">⚙️</span><span className="font-black">পছন্দসমূহ (Preferences)</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('advance')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">🛠️</span><span className="font-black">অ্যাডভান্সড (অভ্র)</span></div>
                <span>➔</span>
              </button>
            </div>
          )}

          {settingsView === 'appearance' && (
            <div className="space-y-6">
               <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm">
                 <h3 className="font-black text-xs text-slate-400 uppercase mb-5 tracking-widest px-1">উপলব্ধ থিমসমূহ (Themes)</h3>
                 <div className="grid grid-cols-2 gap-4">
                   {KEYBOARD_THEMES.map(t => (
                     <button 
                        key={t.id} 
                        onClick={() => {
                          setSettings({...settings, theme: t.id});
                          if (navigator.vibrate) navigator.vibrate(10);
                          playClickSound();
                        }} 
                        className={`group relative p-3 rounded-[1.5rem] border-2 transition-all duration-300 ${settings.theme === t.id ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-900/20 scale-105 shadow-md' : 'border-slate-100 dark:border-white/5 hover:border-slate-200'}`}
                     >
                       <div className="flex flex-col gap-3">
                         <div className={`h-16 w-full rounded-2xl ${t.bg} shadow-inner border border-black/5 overflow-hidden flex flex-col justify-end p-1 gap-1`}>
                            <div className="flex gap-1">
                                <div className={`h-4 flex-1 rounded-md ${t.keyBg} shadow-sm border border-black/5 opacity-80`}></div>
                                <div className={`h-4 flex-1 rounded-md ${t.keyBg} shadow-sm border border-black/5 opacity-80`}></div>
                                <div className={`h-4 flex-1 rounded-md ${t.keyBg} shadow-sm border border-black/5 opacity-80`}></div>
                            </div>
                            <div className={`h-5 w-full rounded-md ${t.accent} shadow-sm opacity-90`}></div>
                         </div>
                         <span className={`text-[11px] font-black truncate text-center ${settings.theme === t.id ? 'text-teal-600 dark:text-teal-400' : 'text-slate-500'}`}>{t.name}</span>
                       </div>
                       {settings.theme === t.id && (
                         <div className="absolute -top-1 -right-1 w-6 h-6 bg-teal-500 rounded-full flex items-center justify-center shadow-lg animate-in zoom-in">
                           <span className="text-[12px] text-white font-bold">✓</span>
                         </div>
                       )}
                     </button>
                   ))}
                 </div>
               </div>

               <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] space-y-4 shadow-sm">
                 <h3 className="font-black text-xs text-slate-400 uppercase mb-2 tracking-widest px-1">কাস্টম ব্যাকগ্রাউন্ড</h3>
                 <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <label className="flex-1 cursor-pointer py-4 bg-teal-500 text-white rounded-2xl text-center font-black shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
                            🖼️ ইমেজ আপলোড করুন
                            <input type="file" accept="image/*" className="hidden" onChange={handleCustomImageUpload} />
                        </label>
                        {settings.customThemeImage && (
                            <button onClick={() => setSettings({...settings, customThemeImage: undefined})} className="px-5 py-4 bg-red-100 text-red-600 rounded-2xl font-black shadow-sm active:scale-95">✕</button>
                        )}
                    </div>
                    {settings.customThemeImage && (
                        <div className="space-y-3 pt-2">
                            <label className="text-xs font-black text-slate-500 flex justify-between">
                                <span>ব্রাইটনেস (Brightness)</span>
                                <span>{settings.customThemeBrightness}%</span>
                            </label>
                            <input type="range" min="0" max="100" value={settings.customThemeBrightness} onChange={e => setSettings({...settings, customThemeBrightness: parseInt(e.target.value)})} className="w-full accent-teal-500" />
                        </div>
                    )}
                 </div>
               </div>

               <div className="space-y-4">
                    <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm">
                        <label className="font-black text-xs text-slate-400 block mb-4 uppercase tracking-widest flex justify-between">
                            <span>কীবোর্ড সাইজ (Size)</span>
                            <span>{Math.round(settings.kbSize)}%</span>
                        </label>
                        <input type="range" min="50" max="150" value={settings.kbSize} onChange={e => setSettings({...settings, kbSize: parseInt(e.target.value)})} className="w-full accent-teal-500" />
                        <button 
                          onClick={() => { setIsSettingsOpen(false); setIsResizingMode(true); }}
                          className="mt-4 w-full py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                        >
                          ম্যানুয়ালি রিসাইজ করুন (Resize with Handle)
                        </button>
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm">
                        <label className="font-black text-xs text-slate-400 block mb-4 uppercase tracking-widest flex justify-between">
                            <span>ট্রান্সপারেন্সি (Transparency)</span>
                            <span>{settings.kbTransparency}%</span>
                        </label>
                        <input type="range" min="20" max="100" value={settings.kbTransparency} onChange={e => setSettings({...settings, kbTransparency: parseInt(e.target.value)})} className="w-full accent-teal-500" />
                    </div>

                    <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm">
                        <label className="font-black text-xs text-slate-400 block mb-4 uppercase tracking-widest flex justify-between">
                            <span>ফন্ট সাইজ (Font Size)</span>
                            <span>{settings.fontSize}px</span>
                        </label>
                        <input type="range" min="12" max="32" value={settings.fontSize} onChange={e => setSettings({...settings, fontSize: parseInt(e.target.value)})} className="w-full accent-teal-500" />
                    </div>
                    <Toggle label="কী-বোর্ড বর্ডার দেখান (Key Borders)" value={settings.showKeyBorder} onChange={v => setSettings({...settings, showKeyBorder: v})} />
               </div>
            </div>
          )}

          {settingsView === 'preference' && (
            <div className="space-y-4">
               <div className="p-5 bg-white dark:bg-slate-800 rounded-[2rem] space-y-4">
                  <h3 className="font-black text-slate-400 text-xs uppercase mb-2 tracking-widest">টাইপিং পছন্দ</h3>
                  <Toggle label="স্প্লিট কীবোর্ড (Split Mode)" value={settings.enableSplitKeyboard} onChange={v => setSettings({...settings, enableSplitKeyboard: v})} />
                  <Toggle label="কী-প্রেস সাউন্ড (Sound on keypress)" value={settings.soundOnKeypress} onChange={v => setSettings({...settings, soundOnKeypress: v})} />
                  {settings.soundOnKeypress && (
                    <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-top-2">
                       <div className="space-y-3">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">সাউন্ড প্রোফাইল (Profiles)</label>
                          <div className="grid grid-cols-2 gap-2">
                             {['Click', 'Tink', 'Bubble', 'Mechanical'].map(p => (
                               <button 
                                 key={p} 
                                 onClick={() => { setSettings({...settings, soundProfile: p}); playClickSound(); }}
                                 className={`py-3 rounded-xl text-xs font-black transition-all ${settings.soundProfile === p ? 'bg-teal-500 text-white shadow-md' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'}`}
                               >
                                 {p === 'Click' ? 'Default Click' : p}
                               </button>
                             ))}
                          </div>
                       </div>
                       <div className="space-y-3">
                          <label className="text-xs font-black text-slate-500 flex justify-between uppercase tracking-widest">
                             <span>সাউন্ড ভলিউম (Volume)</span>
                             <span>{settings.soundVolume}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={settings.soundVolume} onChange={e => setSettings({...settings, soundVolume: e.target.value})} className="w-full accent-teal-500" />
                       </div>
                    </div>
                  )}
               </div>
            </div>
          )}

          {settingsView === 'advance' && (
            <div className="space-y-3">
               <div className="p-5 bg-teal-50 rounded-[2rem] space-y-3 border border-teal-100">
                  <h3 className="font-black text-teal-600 text-[10px] uppercase mb-4 tracking-widest">অভ্র সেটিংস (Avro)</h3>
                  <Toggle label="পুরাতন নিয়মে রেফ" value={settings.oldStyleReph} onChange={v => setSettings({...settings, oldStyleReph: v})} />
                  <Toggle label="স্বয়ংক্রিয় স্বরবর্ণ গঠন" value={settings.autoVowelForming} onChange={v => setSettings({...settings, autoVowelForming: v})} />
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isRTL = layout === KeyboardLayout.ARABIC;

  // Compute Custom Styles
  const kbContainerStyle: React.CSSProperties = {
    opacity: settings.kbTransparency / 100,
    position: 'relative',
    overflow: 'hidden',
    height: `${settings.kbSize * 2.8}px`,
    transition: 'height 0.1s linear'
  };

  const kbBackgroundStyle: React.CSSProperties = settings.customThemeImage ? {
    backgroundImage: `url(${settings.customThemeImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'absolute',
    inset: 0,
    zIndex: -1
  } : {};

  const kbOverlayStyle: React.CSSProperties = settings.customThemeImage ? {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'black',
    opacity: (100 - (settings.customThemeBrightness || 70)) / 100,
    zIndex: 0
  } : {};

  const getQuickResponseLanguage = () => {
    if (layout === KeyboardLayout.ARABIC) return 'ar';
    if (layout === KeyboardLayout.ENGLISH) return 'en';
    return 'bn';
  };

  if (!settings.isSetupComplete) {
    const steps = [
      null,
      { title: 'বাংলা লেখার পদ্ধতি পছন্দ করুন', desc: 'আপনার পছন্দের বাংলা লে-আউট নির্বাচন করুন।', content: (
        <div className="space-y-3 mt-6">
          {[
            { id: KeyboardLayout.BANGLA_AVRO, name: 'অভ্র (Phonetic)' },
            { id: KeyboardLayout.BANGLA_JATIYO, name: 'জাতীয় (Jatiyo)' },
            { id: KeyboardLayout.BANGLA_UNIBIJOY, name: 'ইউনিবিজয় (UniBijoy)' },
            { id: KeyboardLayout.ARABIC, name: 'আরবি (Arabic)' }
          ].map((l) => (
            <label key={l.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <input type="checkbox" defaultChecked className="w-6 h-6 accent-teal-600" />
              <span className="font-bold">{l.name}</span>
            </label>
          ))}
        </div>
      )},
      { title: 'কী-বোর্ড অন করুন', desc: 'সেটিংসে গিয়ে একুশে কীবোর্ড অন করুন।', content: (
        <button className="mt-8 w-full py-5 bg-teal-50 shadow-sm border border-teal-100 rounded-3xl text-teal-600 font-bold">🌐 সেটিংস অন করুন</button>
      )},
      { title: 'কী-বোর্ড সুইচ করুন', desc: 'একুশে বাংলা কীবোর্ড নির্বাচন করুন।', content: (
        <button className="mt-8 w-full py-5 bg-blue-50 shadow-sm border border-blue-100 rounded-3xl text-blue-600 font-bold">🔄 কীবোর্ড পরিবর্তন করুন</button>
      )},
      { title: 'ভাষা পরিবর্তনের অতিরিক্ত বাটন', desc: 'স্পেস বার বা গ্লোব আইকন দিয়ে ভাষা পরিবর্তন করুন।', content: (
        <div className="p-4 bg-slate-50 rounded-2xl mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold">অতিরিক্ত বাটন ব্যবহার করুন</span>
            <input type="checkbox" defaultChecked className="w-6 h-6 accent-teal-600" />
          </div>
          <p className="text-[10px] text-teal-600 font-bold italic">টিপস: স্পেস বারে সোয়াইপ করে ভাষা পরিবর্তন করা যায়।</p>
        </div>
      )},
      { title: 'কিবোর্ডের উচ্চতা', desc: 'কিবোর্ডের উচ্চতা ঠিক করুন', content: (
        <div className="mt-8"><input type="range" className="w-full accent-teal-600" /></div>
      )},
      { title: 'নম্বর সারি', desc: 'নম্বর সারিটি কিবোর্ডে যুক্ত হবে', content: (
        <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl mt-6">
          <span className="font-bold">নম্বর সারি যুক্ত করুন</span>
          <input type="checkbox" defaultChecked className="w-6 h-6 accent-teal-600" />
        </label>
      )},
      { title: 'অভিনন্দন আপনি পুরোপুরি প্রস্তুত', desc: 'আপনার কীবোর্ড সেটআপ সম্পন্ন হয়েছে।', content: (
        <div className="space-y-3 mt-8">
           <button onClick={() => setSettings({...settings, isSetupComplete: true})} className="w-full py-4 text-blue-600 font-bold text-left">সেট আপ শেষ করুন</button>
        </div>
      )}
    ];

    const current = steps[setupStep];
    if (!current) return null;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col p-6 font-bangla">
        <header className="mb-10 pt-4">
          <h1 className="text-4xl font-black text-slate-400">একুশে বাংলা কীবোর্ড <br/><span className="text-slate-700">সেট আপ</span></h1>
          <div className="flex justify-between px-2 mt-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <span key={i} className={`text-lg font-bold ${setupStep === i ? 'text-teal-600' : 'text-slate-300'}`}>{NUMERALS.bn[i-1]}</span>
            ))}
          </div>
        </header>
        <div className="bg-white rounded-[2rem] p-10 shadow-sm flex-1 relative">
          <h2 className="text-2xl font-black mb-4 text-slate-800">{current.title}</h2>
          <p className="text-slate-500 font-medium">{current.desc}</p>
          {current.content}
          {setupStep < 7 && <button onClick={() => setSetupStep(setupStep + 1)} className="absolute bottom-10 left-10 text-blue-600 font-black text-xl">পরের ধাপে যান</button>}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${activeTheme.isDark ? 'bg-black' : 'bg-slate-50'} flex flex-col items-center relative overflow-hidden transition-colors`}>
      {isSettingsOpen && renderSettings()}
      <main className="w-full max-w-4xl h-full flex flex-col p-4 gap-4 z-10">
        <div className={`rounded-3xl shadow-2xl p-6 flex flex-col ${showDashboard ? 'flex-1' : 'h-40'} ${activeTheme.isDark ? 'bg-[#121212]' : 'bg-white border'}`}>
            <textarea 
              ref={textareaRef} 
              value={text} 
              onFocus={() => setShowDashboard(false)} 
              onChange={(e) => setText(e.target.value)} 
              dir={isRTL ? 'rtl' : 'ltr'}
              placeholder="এখানে লিখুন..." 
              style={{ fontSize: `${settings.fontSize}px` }} 
              className={`w-full h-full bg-transparent border-none focus:ring-0 font-bangla resize-none ${activeTheme.isDark ? 'text-white' : 'text-slate-800'} outline-none`} 
            />
        </div>

        {showDashboard ? (
          <div className="flex-1 flex flex-col justify-center font-bangla animate-in zoom-in-95">
             <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'সেটিংস', onClick: () => { setSettingsView('main'); setIsSettingsOpen(true); } },
                  { label: 'অনুশীলন', onClick: () => {} },
                  { label: 'কী-ম্যাপ', onClick: () => {} },
                  { label: 'টিপস', onClick: () => {} },
                  { label: 'সম্পর্কে', onClick: () => {} },
                  { label: 'বের হোন', onClick: () => window.close(), dark: true }
                ].map(item => (
                  <button key={item.label} onClick={item.onClick} className={`p-6 rounded-xl flex flex-col items-center justify-center font-black text-xl shadow-lg active:scale-95 ${item.dark ? 'bg-[#2a2a2a] text-white' : 'bg-white text-slate-800 border'}`}>
                    {item.label}
                  </button>
                ))}
                <div className="col-span-2 mt-4 flex justify-between h-14 items-center px-2">
                   {['😀', '🖼️', '🕒', '+'].map(s => <button key={s} className="text-white text-3xl opacity-60">{s}</button>)}
                   <button className="text-teal-400 font-black text-xl">a>z</button>
                   <button className="text-white text-3xl opacity-60">🎤</button>
                   <button className="text-pink-500 text-3xl">🔊</button>
                   <button className="text-yellow-400 text-3xl">⭐</button>
                   <button onClick={() => { setSettingsView('main'); setIsSettingsOpen(true); }} className="text-white text-3xl">⚙️</button>
                </div>
                <button onClick={() => { setShowDashboard(false); setTimeout(() => textareaRef.current?.focus(), 100); }} className="col-span-2 bg-[#1e40af] p-6 rounded-2xl text-white font-black text-2xl uppercase">Keyboard Mode</button>
             </div>
          </div>
        ) : (
          <div 
            style={kbContainerStyle}
            className={`rounded-[2rem] p-4 shadow-2xl ${settings.customThemeImage ? '' : activeTheme.bg} animate-in slide-in-from-bottom w-full flex flex-col`}
          >
              <div style={kbBackgroundStyle}></div>
              <div style={kbOverlayStyle}></div>

              {/* Manual Resize Drag Handle Overlay */}
              {isResizingMode && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-6 text-center">
                  <div 
                    onPointerDown={handleResizePointerDown}
                    onPointerMove={handleResizePointerMove}
                    onPointerUp={handleResizePointerUp}
                    className="w-full py-8 mb-4 bg-teal-500/20 border-2 border-teal-500 border-dashed rounded-3xl flex flex-col items-center justify-center gap-2 cursor-ns-resize active:bg-teal-500/40 transition-colors"
                  >
                    <span className="text-4xl">↕️</span>
                    <span className="text-white font-black uppercase text-xs tracking-widest">সাইজ পরিবর্তন করতে টানুন</span>
                  </div>
                  <button 
                    onClick={() => setIsResizingMode(false)}
                    className="py-4 px-12 bg-white text-slate-900 rounded-2xl font-black shadow-2xl active:scale-95 transition-transform"
                  >
                    সেভ করুন (Done)
                  </button>
                </div>
              )}
              
              <div className={`flex items-center h-12 px-2 gap-2 border-b relative z-10 ${activeTheme.isDark ? 'border-white/10' : 'border-black/5'} mb-2 shrink-0`}>
                  <button onClick={() => setShowDashboard(true)} className="p-2 opacity-60 text-white hover:opacity-100">🏠</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className="p-2 font-black opacity-60 text-white hover:opacity-100">123</button>
                  <button onClick={() => cycleLayout('next')} className="p-2 opacity-60 text-white hover:opacity-100">🌐</button>
                  
                  {/* Dedicated Handwriting Button */}
                  <button 
                    onClick={() => { setIsHandwritingMode(!isHandwritingMode); setIsQuickMatrixOpen(false); setIsTranslateOpen(false); }} 
                    className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl ${isHandwritingMode ? 'bg-teal-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}
                  >
                    <span className="text-xl">✍️</span>
                    {isHandwritingMode && <span className="text-xs font-black uppercase">Handwriting</span>}
                  </button>

                  {/* Quick Response Matrix Button */}
                  <button 
                    onClick={() => { setIsQuickMatrixOpen(!isQuickMatrixOpen); setIsHandwritingMode(false); setIsTranslateOpen(false); }} 
                    className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl ${isQuickMatrixOpen ? 'bg-indigo-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}
                  >
                    <span className="text-xl">⚡</span>
                    {isQuickMatrixOpen && <span className="text-xs font-black uppercase">Matrix</span>}
                  </button>

                  {/* Translation Button */}
                  <button 
                    onClick={() => { setIsTranslateOpen(!isTranslateOpen); setIsHandwritingMode(false); setIsQuickMatrixOpen(false); }} 
                    className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl ${isTranslateOpen ? 'bg-orange-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}
                  >
                    <span className="text-xl">🌍</span>
                    {isTranslateOpen && <span className="text-xs font-black uppercase">Translate</span>}
                  </button>
                  
                  <button onClick={toggleVoiceTyping} className={`p-2 opacity-60 text-white transition-all hover:opacity-100 ${isListening ? 'bg-red-500 rounded-lg opacity-100 animate-pulse shadow-lg' : ''}`}>🎤</button>
                  <button onClick={() => { setSettingsView('main'); setIsSettingsOpen(true); }} className="p-2 opacity-60 ml-auto text-white hover:opacity-100">⚙️</button>
              </div>
              
              <div className="flex flex-col gap-1.5 pb-2 relative z-10 flex-1 overflow-hidden">
                {isHandwritingMode ? (
                  <HandwritingCanvas 
                    isDark={activeTheme.isDark} 
                    onClose={() => setIsHandwritingMode(false)}
                    onRecognize={handleHandwritingRecognition}
                    isLoading={isRecognizing}
                  />
                ) : isQuickMatrixOpen ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto custom-scrollbar">
                    {QUICK_RESPONSES[getQuickResponseLanguage()].map((phrase, idx) => (
                      <button 
                        key={idx}
                        onMouseDown={e => { e.preventDefault(); insertChar(phrase + " "); if (navigator.vibrate) navigator.vibrate(10); }}
                        className={`py-4 px-3 rounded-xl shadow-md font-bangla font-black text-sm text-center transition-all active:scale-95 ${activeTheme.keyBg} ${activeTheme.keyText} border border-white/10 hover:bg-white/10`}
                      >
                        {phrase}
                      </button>
                    ))}
                    <button 
                      onClick={() => setIsQuickMatrixOpen(false)}
                      className="col-span-full py-3 mt-2 bg-white/10 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                    >
                      কীবোর্ডে ফিরে যান
                    </button>
                  </div>
                ) : isTranslateOpen ? (
                  <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 p-2 overflow-y-auto">
                    <div className="flex items-center gap-2">
                       <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-black text-white/40 px-1">From</label>
                          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                             {['Auto', 'Bangla', 'English', 'Arabic'].map(lang => (
                               <button 
                                 key={lang} 
                                 onClick={() => setTranslateFrom(lang)}
                                 className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${translateFrom === lang ? 'bg-orange-500 text-white shadow-md' : 'bg-white/10 text-white/60'}`}
                               >
                                 {lang}
                               </button>
                             ))}
                          </div>
                       </div>
                       <div className="text-white/20 text-xl pt-4">➔</div>
                       <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-black text-white/40 px-1">To</label>
                          <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                             {['Bangla', 'English', 'Arabic'].map(lang => (
                               <button 
                                 key={lang} 
                                 onClick={() => setTranslateTo(lang)}
                                 className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${translateTo === lang ? 'bg-orange-500 text-white shadow-md' : 'bg-white/10 text-white/60'}`}
                               >
                                 {lang}
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>
                    
                    <button 
                      onClick={handleTranslateAction}
                      disabled={isTranslating || !text.trim()}
                      className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isTranslating || !text.trim() ? 'bg-slate-700 opacity-50 text-slate-400' : 'bg-orange-500 text-white shadow-xl shadow-orange-900/20'}`}
                    >
                      {isTranslating ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>অনুবাদ করা হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <span>🌍</span>
                          <span>অনুবাদ করুন</span>
                        </>
                      )}
                    </button>
                    
                    <button 
                      onClick={() => setIsTranslateOpen(false)}
                      className="w-full py-2 bg-white/5 text-white/40 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                      কীবোর্ডে ফিরে যান
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 flex-1 justify-center">
                    {(isNumericMode ? NUMERIC_ROWS : KEYBOARD_ROWS).map((row, i) => {
                      const mid = Math.ceil(row.length / 2);
                      const leftHalf = row.slice(0, mid);
                      const rightHalf = row.slice(mid);
                      
                      return (
                        <div key={i} className={`flex justify-center gap-1 ${settings.enableSplitKeyboard ? 'justify-between' : ''}`}>
                            <div className={`flex gap-1 ${settings.enableSplitKeyboard ? 'flex-1 justify-end pr-2' : ''}`}>
                              {leftHalf.map(key => (
                                <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-11 flex-1 max-w-[45px] rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} ${settings.showKeyBorder ? 'border-white/10' : 'border-transparent'} text-lg active:scale-95 font-medium`}>{getMappedChar(key)}</button>
                              ))}
                            </div>
                            
                            {settings.enableSplitKeyboard && <div className="w-10 shrink-0"></div>}
                            
                            <div className={`flex gap-1 ${settings.enableSplitKeyboard ? 'flex-1 justify-start pl-2' : ''}`}>
                              {rightHalf.map(key => (
                                <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-11 flex-1 max-w-[45px] rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} ${settings.showKeyBorder ? 'border-white/10' : 'border-transparent'} text-lg active:scale-95 font-medium`}>{getMappedChar(key)}</button>
                              ))}
                            </div>
                        </div>
                      );
                    })}
                    
                    <div className={`flex justify-center gap-1 mt-1 ${settings.enableSplitKeyboard ? 'justify-between px-2' : ''}`}>
                        <button 
                          onMouseDown={e => { e.preventDefault(); setIsNumericMode(!isNumericMode); playClickSound(); }}
                          className={`h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-all font-black text-sm ${settings.enableSplitKeyboard ? 'flex-1 max-w-[60px]' : ''}`}
                        >
                          {isNumericMode ? 'ABC' : '123'}
                        </button>
                        
                        {settings.enableSplitKeyboard && <div className="w-4 shrink-0"></div>}
                        
                        <button 
                          ref={spaceRef}
                          onPointerDown={onSpacePointerDown}
                          onPointerMove={onSpacePointerMove}
                          onPointerUp={onSpacePointerUp}
                          onPointerCancel={(e) => { startX.current = null; isSwiping.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
                          className={`h-16 flex-1 rounded-xl bg-white/10 text-lg font-bold uppercase text-white transition-all active:bg-white/20 select-none overflow-hidden relative touch-none ${settings.enableSplitKeyboard ? 'flex-[2]' : ''}`}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                        >
                          <div key={layout} className="absolute inset-0 flex items-center justify-center animate-in fade-in slide-in-from-left-4 duration-300 pointer-events-none text-white font-black">
                            {layout === KeyboardLayout.BANGLA_AVRO ? 'অভ্র' : 
                              layout === KeyboardLayout.BANGLA_JATIYO ? 'জাতীয়' : 
                              layout === KeyboardLayout.BANGLA_UNIBIJOY ? 'ইউনিবিজয়' :
                              layout === KeyboardLayout.ARABIC ? 'العربية' : 
                              layout === KeyboardLayout.BANGLA_PROVHAT ? 'প্রভাতে' : 
                              layout === KeyboardLayout.ENGLISH ? 'English' : layout}
                          </div>
                        </button>
                        
                        {settings.enableSplitKeyboard && <div className="w-4 shrink-0"></div>}
                        
                        <button 
                          onMouseDown={e => {e.preventDefault(); playClickSound(); const s = textareaRef.current?.selectionStart || 0; updateTextAndCursor(text.substring(0, s-1) + text.substring(s), s-1)}} 
                          className={`h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center text-white active:bg-white/20 ${settings.enableSplitKeyboard ? 'flex-1 max-w-[60px]' : ''}`}
                        >
                          ⌫
                        </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
