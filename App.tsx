
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
  enableResizing: false,
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
  showFormatting: true,
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
  blockOffensiveWords: true,
  personalizedSuggestions: true,
  nextWordSuggestions: true,
  enabledLayouts: ALL_LAYOUTS
};

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
  soundProfile: string;
}

type SettingsView = 'main' | 'appearance' | 'preference' | 'layout' | 'mode' | 'smart' | 'advance' | 'textCorrection';

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
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (canvas && hasContent && !isLoading) {
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
        {!isLoading && hasContent && (
          <button 
            onClick={clear}
            className="absolute top-2 right-2 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors z-10"
            title="Clear All"
          >
            ✕
          </button>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-20 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-teal-400/50 shadow-[0_0_15px_rgba(45,212,191,0.8)] animate-scan"></div>
            <div className="flex flex-col items-center gap-3 z-30">
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
        <button onClick={clear} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-2">
          <span className="text-sm">সব মুছুন</span>
        </button>
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
  const [setupStep, setSetupStep] = useState<number>(0);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [text, setText] = useState<string>('');
  const [layout, setLayout] = useState<KeyboardLayout>(KeyboardLayout.BANGLA_AVRO);
  const [isShifted, setIsShifted] = useState<boolean>(false);
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [isNumericMode, setIsNumericMode] = useState<boolean>(false);
  const [isHandwritingMode, setIsHandwritingMode] = useState<boolean>(false);
  const [isQuickMatrixOpen, setIsQuickMatrixOpen] = useState<boolean>(false);
  const [isTranslateOpen, setIsTranslateOpen] = useState<boolean>(false);
  const [isFormattingOpen, setIsFormattingOpen] = useState<boolean>(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState<boolean>(false);
  const [isRecognizing, setIsRecognizing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isResizingMode, setIsResizingMode] = useState<boolean>(false);
  const [isLandscape, setIsLandscape] = useState<boolean>(window.innerWidth > window.innerHeight);
  
  const [translateFrom, setTranslateFrom] = useState<string>('Auto');
  const [translateTo, setTranslateTo] = useState<string>('English');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  
  const [clipboardHistory, setClipboardHistory] = useState<string[]>(["স্বাগতম", "ধন্যবাদ", "How are you?"]);
  
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
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const activeTheme = useMemo(() => {
    return KEYBOARD_THEMES.find(t => t.id === settings.theme) || KEYBOARD_THEMES[0];
  }, [settings.theme]);

  const handleVibrate = useCallback(() => {
    if (!settings.vibrateOnKeypress || !navigator.vibrate) return;
    let duration = 10;
    if (settings.vibrationDuration === '25ms') duration = 25;
    if (settings.vibrationDuration === '50ms') duration = 50;
    navigator.vibrate(duration);
  }, [settings.vibrateOnKeypress, settings.vibrationDuration]);

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
      
      const vol = (parseInt(settings.soundVolume) || 50) / 500;

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
        default:
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
    handleVibrate();
    playClickSound();
  }, [layout, settings.enabledLayouts, playClickSound, handleVibrate]);

  const updateTextAndCursor = (newText: string, newCursorPos: number) => {
    setText(newText);
    setTimeout(() => {
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const applyFormatting = (type: 'bold' | 'italic' | 'underline' | 'strike') => {
    const el = textareaRef.current;
    if (!el) return;
    handleVibrate();
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const selection = text.substring(start, end);
    
    let formatted = "";
    switch(type) {
      case 'bold': formatted = `**${selection}**`; break;
      case 'italic': formatted = `_${selection}_`; break;
      case 'underline': formatted = `<u>${selection}</u>`; break;
      case 'strike': formatted = `~~${selection}~~`; break;
    }
    
    const newText = text.substring(0, start) + formatted + text.substring(end);
    setText(newText);
    setTimeout(() => {
      const newCursorPos = start + formatted.length;
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
    handleVibrate();
    playClickSound();
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    let currentText = text.substring(0, start) + text.substring(end);
    let insertionIndex = start;

    let processedInputChar = char;
    if (settings.autoCapitalization && layout === KeyboardLayout.ENGLISH && !isNumericMode && !isHandwritingMode && !isQuickMatrixOpen && !isShifted && !isCapsLock) {
      const textBefore = text.substring(0, start);
      const isStartOfSentence = textBefore.trim().length === 0 || /[.!?]\s*$/.test(textBefore);
      if (isStartOfSentence) {
        processedInputChar = char.toUpperCase();
      }
    }

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

    const charToInsert = isHandwritingMode ? char : (isQuickMatrixOpen ? char : getMappedChar(processedInputChar));
    updateTextAndCursor(currentText.substring(0, insertionIndex) + charToInsert + currentText.substring(insertionIndex), insertionIndex + charToInsert.length);
    phoneticBuffer.current = ''; lastInsertedLen.current = 0;
  }, [text, layout, isNumericMode, isShifted, isCapsLock, settings, getMappedChar, isHandwritingMode, isQuickMatrixOpen, playClickSound, handleVibrate]);

  const handleHandwritingRecognition = async (base64: string) => {
    setIsRecognizing(true);
    try {
      let targetLang = 'Bengali';
      if (layout === KeyboardLayout.ENGLISH) targetLang = 'English';
      else if (layout === KeyboardLayout.ARABIC) targetLang = 'Arabic';
      
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
    handleVibrate();
    try {
      const result = await getAIAssistance(text, 'translate', { from: translateFrom, to: translateTo });
      if (result) {
        setText(result);
        handleVibrate();
      }
    } catch (err) {
      console.error("Translate error:", err);
    } finally {
      setIsTranslating(false);
    }
  };

  const getQuickResponseLanguage = useCallback(() => {
    if (layout === KeyboardLayout.ENGLISH) return 'en';
    if (layout === KeyboardLayout.ARABIC || layout === KeyboardLayout.ARABIC_PHONETIC) return 'ar';
    return 'bn';
  }, [layout]);

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

    recognition.onstart = () => {
      setIsListening(true);
      handleVibrate();
    };
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
  }, [isListening, layout, insertChar, handleVibrate]);

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

  const onResizeStart = (e: React.PointerEvent) => {
    resizeStartY.current = e.clientY;
    resizeStartSize.current = settings.kbSize;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e: React.PointerEvent) => {
    if (resizeStartY.current === null) return;
    const diffY = resizeStartY.current - e.clientY;
    const newSize = Math.max(70, Math.min(150, resizeStartSize.current + diffY / 2));
    setSettings(prev => ({ ...prev, kbSize: newSize }));
  };

  const onResizeEnd = (e: React.PointerEvent) => {
    resizeStartY.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const renderSettings = () => {
    const Toggle = ({ label, value, onChange, description }: { label: string, value: boolean, onChange: (v: boolean) => void, description?: string }) => (
      <div className="flex flex-col gap-1 py-4 border-b border-slate-100 dark:border-white/5 last:border-0 group">
        <div className="flex items-center justify-between px-6">
          <span className="text-lg font-medium text-slate-800 dark:text-white">{label}</span>
          <button onClick={() => onChange(!value)} className={`w-12 h-6 rounded-full relative transition-colors ${value ? 'bg-teal-500' : 'bg-slate-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {description && <p className="px-6 text-sm text-slate-400 dark:text-slate-500 leading-tight">{description}</p>}
      </div>
    );

    const SelectItem = ({ label, value, onClick }: { label: string, value: string | number, onClick: () => void }) => (
      <button onClick={onClick} className="flex flex-col gap-1 py-4 px-6 border-b border-slate-100 dark:border-white/5 last:border-0 w-full text-left active:bg-slate-50 dark:active:bg-white/5 transition-colors">
        <span className="text-lg font-medium text-slate-800 dark:text-white">{label}</span>
        <span className="text-sm text-slate-400 dark:text-slate-500">{value}</span>
      </button>
    );

    const RadioItem = ({ label, selected, onClick }: { label: string, selected: boolean, onClick: () => void }) => (
      <button onClick={onClick} className="w-full flex items-center justify-between py-5 px-6 border-b last:border-0 border-slate-100 dark:border-white/5 group active:bg-slate-50 dark:active:bg-white/5 transition-colors">
        <span className={`text-lg font-medium ${selected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
          {selected && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-inner" />}
        </div>
      </button>
    );

    const ThemeCard: React.FC<{ theme: ThemeConfig }> = ({ theme }) => {
      const isSelected = settings.theme === theme.id;
      return (
        <button 
          onClick={() => { setSettings({...settings, theme: theme.id}); handleVibrate(); }}
          className="flex flex-col gap-2 group"
        >
          <div className={`w-full aspect-video rounded-2xl overflow-hidden border-2 transition-all relative ${isSelected ? 'border-green-500' : 'border-transparent group-hover:border-slate-300'}`}>
            <div className={`w-full h-full ${theme.bg} p-2 flex flex-col gap-1.5`}>
              <div className="flex gap-1">
                {[1,2,3,4,5,6].map(i => <div key={i} className={`h-2 flex-1 rounded-sm ${theme.keyBg} opacity-60`} />)}
              </div>
              <div className="flex gap-1 pl-2">
                {[1,2,3,4,5].map(i => <div key={i} className={`h-2 flex-1 rounded-sm ${theme.keyBg} opacity-80`} />)}
              </div>
              <div className="flex gap-1 items-end mt-auto">
                <div className={`h-3 w-4 rounded-sm ${theme.keyBg}`} />
                <div className={`h-3 flex-1 rounded-sm ${theme.keyBg}`} />
                <div className={`h-3 w-4 rounded-sm ${theme.accent}`} />
              </div>
            </div>
            {isSelected && (
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs shadow-lg">
                ✓
              </div>
            )}
          </div>
          <span className={`text-sm font-bold truncate text-center w-full ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
            {theme.name}
          </span>
        </button>
      );
    };

    return (
      <div className="fixed inset-0 z-[3000] bg-[#f2f2f2] dark:bg-slate-950 flex flex-col font-sans animate-in slide-in-from-right overflow-y-auto no-scrollbar">
        <header className="flex items-center justify-between px-6 py-5 bg-[#f2f2f2] dark:bg-slate-900 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-6">
            <button onClick={() => settingsView === 'main' ? setIsSettingsOpen(false) : setSettingsView('main')} className="p-2 -ml-2 text-slate-800 dark:text-white text-2xl">
              {settingsView === 'main' ? '✕' : '←'}
            </button>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {settingsView === 'appearance' ? 'Themes' : settingsView === 'mode' ? 'Keyboard mode' : settingsView === 'preference' ? 'পছন্দসমূহ' : settingsView === 'layout' ? 'Layout' : settingsView === 'advance' ? 'Advanced' : settingsView === 'textCorrection' ? 'Text correction' : 'সেটিংস'}
            </h2>
          </div>
          {settingsView === 'appearance' && (
            <button className="text-green-600 font-bold text-lg hover:opacity-80">Store</button>
          )}
        </header>

        <div className="flex-1 w-full space-y-4 pb-20">
          {settingsView === 'main' && (
            <div className="px-6 grid gap-3 pt-4">
              <button onClick={() => setSettingsView('appearance')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">🎨</span><span className="font-black">চেহারা ও থিম (Themes)</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('mode')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">📱</span><span className="font-black">কীবোর্ড মোড (Keyboard Mode)</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('layout')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">⌨️</span><span className="font-black">লেআউট (Layout)</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('textCorrection')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">📝</span><span className="font-black">টেক্সট কারেকশন (Text correction)</span></div>
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

          {settingsView === 'layout' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="px-6 mb-6 pt-4">
                <div className="bg-[#121212] rounded-xl p-3 shadow-inner overflow-hidden border border-black flex flex-col gap-2">
                  <div className="flex justify-center gap-1">
                    {['z', 'x', 'c', 'v', 'b', 'n', 'm'].map(k => (
                      <div key={k} className="h-10 flex-1 bg-white/10 rounded-lg flex items-center justify-center text-white font-medium text-lg">{k}</div>
                    ))}
                    <div className="h-10 w-12 bg-white/10 rounded-lg flex items-center justify-center text-white">⌫</div>
                  </div>
                  <div className="flex justify-center gap-1">
                    <div className="h-10 w-12 bg-white/10 rounded-lg flex items-center justify-center text-white text-xs">?123</div>
                    <div className="h-10 w-10 bg-white/10 rounded-lg flex items-center justify-center text-white">🌐</div>
                    <div className="h-10 w-8 bg-white/10 rounded-lg flex items-center justify-center text-white">,</div>
                    <div className="h-10 flex-1 bg-white/10 rounded-lg flex items-center justify-center text-white font-bangla text-xs">অভ্র</div>
                    <div className="h-10 w-8 bg-white/10 rounded-lg flex items-center justify-center text-white">.</div>
                    <div className="h-10 w-12 bg-white/10 rounded-lg flex items-center justify-center text-white">⏎</div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border-t border-b border-slate-100 dark:border-white/5 mb-6">
                <SelectItem 
                  label="কীবোর্ড সাইজ (Size)" 
                  value="পরিবর্তন করতে ক্লিক করুন" 
                  onClick={() => { setIsResizingMode(true); setIsSettingsOpen(false); }} 
                />
                <div className="px-6 py-4 border-b dark:border-white/5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-medium text-slate-800 dark:text-white">স্বচ্ছতা (Transparency)</span>
                    <span className="text-sm font-bold text-teal-600">{settings.kbTransparency}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="20" 
                    max="100" 
                    value={settings.kbTransparency} 
                    onChange={(e) => setSettings({ ...settings, kbTransparency: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>
                <Toggle 
                  label="Text Format" 
                  description="Show formatting options (B, I, U, S) in toolbar" 
                  value={settings.showFormatting} 
                  onChange={(v) => setSettings({...settings, showFormatting: v})} 
                />
                <Toggle 
                  label="Keyboard Toolbar" 
                  description="Show toolbar above the keyboard" 
                  value={settings.showToolbar} 
                  onChange={(v) => setSettings({...settings, showToolbar: v})} 
                />
                <Toggle 
                  label="Number keys" 
                  description="Show a row of number keys at the top" 
                  value={settings.enableNumberRow} 
                  onChange={(v) => setSettings({...settings, enableNumberRow: v})} 
                />
              </div>

              <div className="mb-6">
                <h3 className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800">Spacebar Row</h3>
                <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
                  <Toggle 
                    label="Show Comma (,)" 
                    value={settings.showComma} 
                    onChange={(v) => setSettings({...settings, showComma: v})} 
                  />
                  <Toggle 
                    label="Show Period (.)" 
                    value={settings.showPeriod} 
                    onChange={(v) => setSettings({...settings, showPeriod: v})} 
                  />
                </div>
              </div>
            </div>
          )}

          {settingsView === 'textCorrection' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 px-4 space-y-4 pt-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                <Toggle 
                  label="Block offensive words" 
                  description="Do not suggest potentially offensive words"
                  value={settings.blockOffensiveWords} 
                  onChange={(v) => setSettings({...settings, blockOffensiveWords: v})} 
                />
                <Toggle 
                  label="Auto-correction" 
                  description="Spacebar and punctuation automatically correct mistyped words"
                  value={settings.autoCorrect} 
                  onChange={(v) => setSettings({...settings, autoCorrect: v})} 
                />
                <Toggle 
                  label="Show correction suggestions" 
                  description="Display suggested words while typing"
                  value={settings.showSuggestions} 
                  onChange={(v) => setSettings({...settings, showSuggestions: v})} 
                />
                <Toggle 
                  label="Personalized suggestions" 
                  description="Learn from your communications and typed data to improve suggestions"
                  value={settings.personalizedSuggestions} 
                  onChange={(v) => setSettings({...settings, personalizedSuggestions: v})} 
                />
                <Toggle 
                  label="Next-word suggestions" 
                  description="Use the previous word in making suggestions"
                  value={settings.nextWordSuggestions} 
                  onChange={(v) => setSettings({...settings, nextWordSuggestions: v})} 
                />
              </div>
            </div>
          )}
          
          {settingsView === 'preference' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 px-4 space-y-4 pt-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                <Toggle 
                  label="Auto-capitalization" 
                  description="Capitalize the first word of each sentence"
                  value={settings.autoCapitalization} 
                  onChange={(v) => setSettings({...settings, autoCapitalization: v})} 
                />
                <Toggle 
                  label="Double-space period" 
                  description="Double tap on spacebar inserts a period followed by a space"
                  value={settings.doubleSpacePeriod} 
                  onChange={(v) => setSettings({...settings, doubleSpacePeriod: v})} 
                />
                <Toggle 
                  label="Double-space tab" 
                  description="Double tap on spacebar inserts a tab"
                  value={settings.doubleSpaceTab} 
                  onChange={(v) => setSettings({...settings, doubleSpaceTab: v})} 
                />
                <Toggle 
                  label="Clipboard Recent Items" 
                  description="Show recent copied or cut text in clipboard"
                  value={settings.clipboardRecentItems} 
                  onChange={(v) => setSettings({...settings, clipboardRecentItems: v})} 
                />
                <Toggle 
                  label="Show copied images on Clipboard" 
                  description="Show screenshots or copied images on Clipboard"
                  value={settings.showCopiedImages} 
                  onChange={(v) => setSettings({...settings, showCopiedImages: v})} 
                />
                <Toggle 
                  label="Vibrate on keypress" 
                  value={settings.vibrateOnKeypress} 
                  onChange={(v) => setSettings({...settings, vibrateOnKeypress: v})} 
                />
                <Toggle 
                  label="Sound on keypress" 
                  value={settings.soundOnKeypress} 
                  onChange={(v) => setSettings({...settings, soundOnKeypress: v})} 
                />
                <Toggle 
                  label="Popup on keypress" 
                  value={settings.popupOnKeypress} 
                  onChange={(v) => setSettings({...settings, popupOnKeypress: v})} 
                />
                <Toggle 
                  label="Voice input key" 
                  value={settings.voiceInputKey} 
                  onChange={(v) => setSettings({...settings, voiceInputKey: v})} 
                />
                <Toggle 
                  label="Show Emoji Key" 
                  description="Switch to Emoji button"
                  value={settings.showEmojiKey} 
                  onChange={(v) => setSettings({...settings, showEmojiKey: v})} 
                />
              </div>

              <div className="h-4"></div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm">
                <Toggle 
                  label="Show Globe Key" 
                  description="Switch keyboard language"
                  value={settings.showGlobeKey} 
                  onChange={(v) => setSettings({...settings, showGlobeKey: v})} 
                />
                <Toggle 
                  label="Allow Other Keyboards" 
                  description="Globe key switches to other keyboards also"
                  value={settings.allowOtherKeyboards} 
                  onChange={(v) => setSettings({...settings, allowOtherKeyboards: v})} 
                />
                <Toggle 
                  label="Move Cursor Using Space Key" 
                  description="Swipe space key to move cursor when globe key is enabled"
                  value={settings.moveCursorSpaceKey} 
                  onChange={(v) => setSettings({...settings, moveCursorSpaceKey: v})} 
                />
                <Toggle 
                  label="Volume cursor" 
                  description="Use the volume keys to move the cursor"
                  value={settings.volumeCursor} 
                  onChange={(v) => setSettings({...settings, volumeCursor: v})} 
                />
              </div>
            </div>
          )}

          {settingsView === 'advance' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-0 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden shadow-sm mx-4 mt-4">
              <SelectItem 
                label="Key popup dismiss delay" 
                value={settings.keyPopupDismissDelay} 
                onClick={() => {}} 
              />
              <SelectItem 
                label="Keypress vibration duration" 
                value={settings.vibrationDuration === '10ms' ? 'System default' : settings.vibrationDuration} 
                onClick={() => {}} 
              />
              <SelectItem 
                label="Keypress sound volume" 
                value={settings.soundVolume === '50' ? 'System default' : settings.soundVolume} 
                onClick={() => {}} 
              />
              <SelectItem 
                label="Key long press delay" 
                value={`${settings.keyLongPressDelay}ms`} 
                onClick={() => {}} 
              />
              <SelectItem 
                label="Space cursor long press delay" 
                value={`${settings.spaceCursorLongPressDelay}ms`} 
                onClick={() => {}} 
              />
              <SelectItem 
                label="Space cursor speed" 
                value={settings.spaceCursorSpeed} 
                onClick={() => {}} 
              />
              <Toggle 
                label="Emoji for physical keyboard" 
                description="Physical Alt key shows the emoji palette"
                value={settings.emojiPhysicalKeyboard} 
                onChange={(v) => setSettings({...settings, emojiPhysicalKeyboard: v})} 
              />
              <Toggle 
                label="Show typed word" 
                description="Show typed word as the first suggestion in phonetic mode"
                value={settings.showTypedWord} 
                onChange={(v) => setSettings({...settings, showTypedWord: v})} 
              />
              <SelectItem 
                label="Voice typing engine" 
                value={settings.voiceInputKey ? "Enabled" : "Disabled"} 
                onClick={() => {}} 
              />
            </div>
          )}

          {settingsView === 'appearance' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 px-6 pb-10 pt-4">
              <div className="mb-10">
                <h3 className="text-lg font-bold text-slate-500 mb-6 font-bangla"> ঈদ-উল-আজহা ২০২৪ (১)</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                  {KEYBOARD_THEMES.filter(t => t.category === 'eid').map(t => (
                    <ThemeCard key={t.id} theme={t} />
                  ))}
                </div>
              </div>
              <div className="mb-10">
                <h3 className="text-lg font-bold text-slate-500 mb-6 font-bangla">কালার থিম</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                  {KEYBOARD_THEMES.filter(t => t.category === 'color').map(t => (
                    <ThemeCard key={t.id} theme={t} />
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-500 mb-6 font-bangla">আরও থিম</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8">
                  {KEYBOARD_THEMES.filter(t => !t.category).map(t => (
                    <ThemeCard key={t.id} theme={t} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {settingsView === 'mode' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pt-4">
              <div className="px-6 space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1 mb-4">Portrait View</h3>
                  <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm overflow-hidden border dark:border-white/5">
                    <RadioItem 
                      label="Standard keyboard" 
                      selected={settings.portraitMode === 'standard'} 
                      onClick={() => setSettings({...settings, portraitMode: 'standard'})} 
                    />
                    <RadioItem 
                      label="One-handed keyboard" 
                      selected={settings.portraitMode === 'one-handed'} 
                      onClick={() => setSettings({...settings, portraitMode: 'one-handed'})} 
                    />
                    <RadioItem 
                      label="Floating keyboard" 
                      selected={settings.portraitMode === 'floating'} 
                      onClick={() => setSettings({...settings, portraitMode: 'floating'})} 
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1 mb-4">Landscape View</h3>
                  <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm overflow-hidden border dark:border-white/5">
                    <RadioItem 
                      label="Standard keyboard" 
                      selected={settings.landscapeMode === 'standard'} 
                      onClick={() => setSettings({...settings, landscapeMode: 'standard'})} 
                    />
                    <RadioItem 
                      label="Split keyboard" 
                      selected={settings.landscapeMode === 'split'} 
                      onClick={() => setSettings({...settings, landscapeMode: 'split'})} 
                    />
                    <RadioItem 
                      label="Floating keyboard" 
                      selected={settings.landscapeMode === 'floating'} 
                      onClick={() => setSettings({...settings, landscapeMode: 'floating'})} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const isRTL = layout === KeyboardLayout.ARABIC;
  const currentMode = isLandscape ? settings.landscapeMode : settings.portraitMode;
  const isSplit = isLandscape && currentMode === 'split';
  const isOneHanded = !isLandscape && currentMode === 'one-handed';
  const isFloating = currentMode === 'floating';

  const kbContainerStyle: React.CSSProperties = {
    opacity: settings.kbTransparency / 100,
    position: isFloating ? 'fixed' : 'relative',
    bottom: isFloating ? '10%' : 'auto',
    left: isFloating ? '50%' : 'auto',
    transform: isFloating ? 'translateX(-50%) scale(0.9)' : 'none',
    width: isFloating ? 'min(90%, 400px)' : (isOneHanded ? '85%' : '100%'),
    marginLeft: isOneHanded ? (settings.oneHandedSide === 'right' ? 'auto' : '0') : 'auto',
    marginRight: isOneHanded ? (settings.oneHandedSide === 'left' ? 'auto' : '0') : 'auto',
    overflow: 'hidden',
    height: `${settings.kbSize * 2.8}px`,
    transition: 'all 0.1s ease-out',
    zIndex: isFloating ? 2000 : 10,
    boxShadow: isFloating ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)' : 'none',
    border: isFloating ? '2px solid rgba(255,255,255,0.1)' : 'none'
  };

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
                  { label: 'সেটিিংস', onClick: () => { setSettingsView('main'); setIsSettingsOpen(true); } },
                  { label: 'অনুশীলন', onClick: () => {} },
                  { label: 'কী-ম্যাপ', onClick: () => {} },
                  { label: 'টিপস', onClick: () => {} },
                  { label: 'সম্পর্কে', onClick: () => {} },
                  { label: 'বের হোন', onClick: () => window.close(), dark: true }
                ].map(item => (
                  <button key={item.label} onClick={item.onClick} className={`p-6 rounded-xl flex flex-col items-center justify-center font-black text-xl shadow-lg active:scale-95 transition-all ${item.dark ? 'bg-[#2a2a2a] text-white hover:bg-[#333]' : 'bg-white text-slate-800 border hover:bg-slate-50'}`}>
                    {item.label}
                  </button>
                ))}
                <div className="col-span-2 mt-4 flex justify-between h-14 items-center px-2">
                   {['😀', '🖼️', '🕒', '+'].map(s => <button key={s} className="text-white text-3xl opacity-60 hover:opacity-100">{s}</button>)}
                   <button className="text-teal-400 font-black text-xl hover:scale-110 transition-transform">a>z</button>
                   <button onClick={toggleVoiceTyping} className={`text-white text-3xl transition-all hover:opacity-100 ${isListening ? 'text-red-500 scale-125 animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'opacity-60'}`}>🎤</button>
                   <button className="text-pink-500 text-3xl hover:scale-110">🔊</button>
                   <button className="text-yellow-400 text-3xl hover:scale-110">⭐</button>
                   <button onClick={() => { setSettingsView('main'); setIsSettingsOpen(true); }} className="text-white text-3xl hover:opacity-100">⚙️</button>
                </div>
                <button onClick={() => { setShowDashboard(false); setTimeout(() => textareaRef.current?.focus(), 100); }} className="col-span-2 bg-[#1e40af] p-6 rounded-2xl text-white font-black text-2xl uppercase shadow-xl hover:bg-blue-700 active:scale-95 transition-all">Keyboard Mode</button>
             </div>
          </div>
        ) : (
          <div className="relative w-full">
            {isResizingMode && (
              <div className="absolute -top-12 left-0 right-0 z-[2000] flex justify-between items-center px-2 animate-in slide-in-from-bottom-2">
                <div className="bg-teal-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg">সাইজ পরিবর্তন করুন</div>
                <button 
                  onClick={() => setIsResizingMode(false)}
                  className="bg-white text-slate-900 px-6 py-2 rounded-full text-xs font-black shadow-lg hover:bg-slate-100 transition-colors"
                >
                  ঠিক আছে
                </button>
              </div>
            )}
            
            <div 
              style={kbContainerStyle}
              className={`rounded-[2rem] p-4 shadow-2xl ${activeTheme.bg} animate-in slide-in-from-bottom w-full flex flex-col transition-all duration-300 relative group`}
            >
              {isResizingMode && (
                <div 
                  onPointerDown={onResizeStart}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeEnd}
                  className="absolute -top-1 left-0 right-0 h-6 cursor-ns-resize flex items-center justify-center z-50 group-hover:bg-white/5 transition-colors"
                >
                  <div className="w-12 h-1.5 bg-teal-500 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                </div>
              )}

              <div className={`flex items-center h-12 px-2 gap-1 border-b relative z-10 ${activeTheme.isDark ? 'border-white/10' : 'border-black/5'} mb-2 shrink-0 overflow-x-auto no-scrollbar`}>
                  <button onClick={() => setShowDashboard(true)} className="p-2 opacity-60 text-white hover:opacity-100">🏠</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className="p-2 font-black opacity-60 text-white hover:opacity-100 shrink-0">123</button>
                  <button onClick={() => cycleLayout('next')} className="p-2 opacity-60 text-white hover:opacity-100 shrink-0">🌐</button>
                  <button onClick={() => { setIsHandwritingMode(!isHandwritingMode); setIsQuickMatrixOpen(false); setIsTranslateOpen(false); setIsFormattingOpen(false); setIsClipboardOpen(false); }} className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl shrink-0 ${isHandwritingMode ? 'bg-teal-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}>
                    <span className="text-xl">✍️</span>
                  </button>
                  <button onClick={() => { setIsClipboardOpen(!isClipboardOpen); setIsHandwritingMode(false); setIsQuickMatrixOpen(false); setIsTranslateOpen(false); setIsFormattingOpen(false); }} className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl shrink-0 ${isClipboardOpen ? 'bg-blue-600 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}>
                    <span className="text-xl">📋</span>
                  </button>
                  <button onClick={() => { setIsQuickMatrixOpen(!isQuickMatrixOpen); setIsHandwritingMode(false); setIsTranslateOpen(false); setIsFormattingOpen(false); setIsClipboardOpen(false); }} className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl shrink-0 ${isQuickMatrixOpen ? 'bg-indigo-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}>⚡</button>
                  <button onClick={() => { setIsTranslateOpen(!isTranslateOpen); setIsHandwritingMode(false); setIsQuickMatrixOpen(false); setIsFormattingOpen(false); setIsClipboardOpen(false); }} className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl shrink-0 ${isTranslateOpen ? 'bg-orange-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}>🌍</button>
                  {settings.showFormatting && (
                    <button onClick={() => { setIsFormattingOpen(!isFormattingOpen); setIsHandwritingMode(false); setIsQuickMatrixOpen(false); setIsTranslateOpen(false); setIsClipboardOpen(false); }} className={`p-2 px-3 flex items-center gap-2 transition-all rounded-xl shrink-0 ${isFormattingOpen ? 'bg-blue-500 opacity-100 text-white shadow-lg' : 'opacity-60 text-white hover:opacity-100'}`}>
                      <span className="text-xl font-black">Tt</span>
                    </button>
                  )}
                  {settings.voiceInputKey && (
                    <button onClick={toggleVoiceTyping} className={`p-2 transition-all hover:opacity-100 flex items-center justify-center rounded-xl shrink-0 ${isListening ? 'bg-red-500 opacity-100 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'opacity-60 text-white'}`}>
                      <span className="text-xl">🎤</span>
                    </button>
                  )}
                  <button onClick={() => { setSettingsView('main'); setIsSettingsOpen(true); }} className="p-2 opacity-60 ml-auto text-white hover:opacity-100 shrink-0">⚙️</button>
              </div>
              
              <div className="flex flex-col gap-1.5 pb-2 relative z-10 flex-1 overflow-hidden">
                {isHandwritingMode ? (
                  <HandwritingCanvas isDark={activeTheme.isDark} onClose={() => setIsHandwritingMode(false)} onRecognize={handleHandwritingRecognition} isLoading={isRecognizing} />
                ) : isClipboardOpen ? (
                  <div className="flex flex-col gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto no-scrollbar h-full p-2">
                    <div className="flex justify-between items-center px-1 mb-1">
                      <span className="text-white/60 text-xs font-bold uppercase tracking-widest">সাম্প্রতিক ক্লিপবোর্ড</span>
                      <button onClick={() => setClipboardHistory([])} className="text-red-400 text-xs hover:underline">সব মুছুন</button>
                    </div>
                    {clipboardHistory.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-white/40 italic font-bangla text-sm">কোনো কপি করা টেক্সট নেই</div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {clipboardHistory.map((item, idx) => (
                          <button 
                            key={idx} 
                            onClick={() => { insertChar(item); handleVibrate(); }}
                            className={`p-4 rounded-xl text-left font-bangla transition-all active:scale-[0.98] ${activeTheme.keyBg} ${activeTheme.keyText} border border-white/5 hover:bg-white/10 truncate`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : isFormattingOpen ? (
                  <div className="flex gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 p-2 overflow-x-auto no-scrollbar">
                    <button onClick={() => applyFormatting('bold')} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black text-xl transition-all active:scale-95 flex items-center justify-center">B</button>
                    <button onClick={() => applyFormatting('italic')} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black italic text-xl transition-all active:scale-95 flex items-center justify-center">I</button>
                    <button onClick={() => applyFormatting('underline')} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black underline text-xl transition-all active:scale-95 flex items-center justify-center">U</button>
                    <button onClick={() => applyFormatting('strike')} className="flex-1 py-4 bg-white/10 text-white rounded-2xl font-black line-through text-xl transition-all active:scale-95 flex items-center justify-center">S</button>
                  </div>
                ) : isQuickMatrixOpen ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-y-auto custom-scrollbar">
                    {QUICK_RESPONSES[getQuickResponseLanguage()].map((phrase, idx) => (
                      <button key={idx} onMouseDown={e => { e.preventDefault(); insertChar(phrase + " "); }} className={`py-4 px-3 rounded-xl shadow-md font-bangla font-black text-sm text-center transition-all active:scale-95 ${activeTheme.keyBg} ${activeTheme.keyText} border border-white/10 hover:bg-white/10`}>{phrase}</button>
                    ))}
                  </div>
                ) : isTranslateOpen ? (
                  <div className="flex flex-col gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 p-2 overflow-y-auto">
                    <button onClick={handleTranslateAction} disabled={isTranslating || !text.trim()} className={`w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isTranslating || !text.trim() ? 'bg-slate-700 opacity-50 text-slate-400' : 'bg-orange-500 text-white shadow-xl shadow-orange-900/20'}`}>{isTranslating ? 'অনুবাদ করা হচ্ছে...' : 'অনুবাদ করুন'}</button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 flex-1 justify-center">
                    {settings.enableNumberRow && (
                      <div className={`flex justify-center gap-1 mb-1 ${isSplit ? 'justify-between' : ''}`}>
                         {(NUMERALS[layout === KeyboardLayout.ENGLISH ? 'en' : (layout === KeyboardLayout.ARABIC ? 'ar' : 'bn')]).map(num => (
                            <button key={num} onMouseDown={e => {e.preventDefault(); insertChar(num)}} className={`h-9 flex-1 max-w-[40px] rounded-lg shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} ${settings.showKeyBorder ? 'border-white/5' : 'border-transparent'} text-sm active:scale-95 opacity-80`}>{num}</button>
                         ))}
                      </div>
                    )}
                    
                    {(isNumericMode ? NUMERIC_ROWS : KEYBOARD_ROWS).map((row, i) => (
                      <div key={i} className={`flex justify-center gap-1 ${isSplit ? 'justify-between' : ''}`}>
                          <div className={`flex gap-1 ${isSplit ? 'flex-1 justify-end pr-2' : ''}`}>
                            {row.map(key => (
                              <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-11 flex-1 max-w-[45px] rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} ${settings.showKeyBorder ? 'border-white/10' : 'border-transparent'} text-lg active:scale-95 font-medium`}>{getMappedChar(key)}</button>
                            ))}
                          </div>
                      </div>
                    ))}
                    <div className={`flex justify-center gap-1 mt-1 ${isSplit ? 'justify-between px-2' : ''}`}>
                        <button onMouseDown={e => { e.preventDefault(); setIsNumericMode(!isNumericMode); playClickSound(); handleVibrate(); }} className={`h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-all font-black text-sm`}>{isNumericMode ? 'ABC' : '123'}</button>
                        
                        {settings.showComma && <button onMouseDown={e => {e.preventDefault(); insertChar(',')}} className={`h-16 w-12 rounded-xl bg-white/5 flex items-center justify-center text-white active:bg-white/10 text-xl font-bold`}>,</button>}
                        
                        <button ref={spaceRef} onPointerDown={onSpacePointerDown} onPointerMove={onSpacePointerMove} onPointerUp={onSpacePointerUp} className={`h-16 flex-1 rounded-xl bg-white/10 text-lg font-bold uppercase text-white transition-all active:bg-white/20 select-none overflow-hidden relative touch-none`}>
                          <div key={layout} className="absolute inset-0 flex items-center justify-center animate-in fade-in slide-in-from-left-4 duration-300 pointer-events-none text-white font-black">
                            {layout === KeyboardLayout.BANGLA_AVRO ? 'অভ্র' : layout === KeyboardLayout.BANGLA_JATIYO ? 'জাতীয়' : layout === KeyboardLayout.BANGLA_UNIBIJOY ? 'ইউনিবিজয়' : layout === KeyboardLayout.ARABIC ? 'العربية' : layout === KeyboardLayout.BANGLA_PROVHAT ? 'প্রভাতে' : 'English'}
                          </div>
                        </button>
                        
                        {settings.showPeriod && <button onMouseDown={e => {e.preventDefault(); insertChar(layout === KeyboardLayout.ENGLISH ? '.' : '।')}} className={`h-16 w-12 rounded-xl bg-white/5 flex items-center justify-center text-white active:bg-white/10 text-xl font-bold`}>{layout === KeyboardLayout.ENGLISH ? '.' : '।'}</button>}
                        
                        <button onMouseDown={e => {e.preventDefault(); playClickSound(); const s = textareaRef.current?.selectionStart || 0; updateTextAndCursor(text.substring(0, s-1) + text.substring(s), s-1)}} className={`h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center text-white active:bg-white/20`}>⌫</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
