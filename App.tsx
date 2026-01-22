
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KeyboardLayout, AppSettings, ThemeConfig, KeyboardMode } from './types';
import { KEYBOARD_ROWS, SYMBOLS_ROWS, ARABIC_MAP, ARABIC_PHONETIC_MAP, JATIYO_MAP, UNIBIJOY_MAP, PHONETIC_MAP, NUMERIC_ROWS, NUMERALS, PROVHAT_MAP } from './constants/layouts';
import { KEYBOARD_THEMES } from './constants/themes';
import { getAIAssistance, AITask } from './services/geminiService';
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

const STORAGE_KEY = 'ekushey_kb_v2_settings';
const SETUP_KEY = 'ekushey_kb_setup_complete';
const SETUP_STEP_KEY = 'ekushey_kb_setup_step';

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸', '💖', '✨', '🔥', '🌈', '🌍', '🚀', '⭐', '🎈', '🎉', '💻', '📱', '🎮', '🎧', '📸', '🎵', '⚽', '🍕', '☕', '🍦'
];

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
}

const App: React.FC = () => {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean>(() => localStorage.getItem(SETUP_KEY) === 'true');
  const [currentStep, setCurrentStep] = useState<number>(() => parseInt(localStorage.getItem(SETUP_STEP_KEY) || '0'));
  const [setupDialog, setSetupDialog] = useState<string | null>(null);
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
  const [settingsSubPage, setSettingsSubPage] = useState<null | 'preferences' | 'appearance' | 'layout-options' | 'kb-mode' | 'advanced' | 'themes' | 'smart-typing' | 'layout-management'>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false); 
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isSmartMenuOpen, setIsSmartMenuOpen] = useState<boolean>(false);
  const [isClipboardOpen, setIsClipboardOpen] = useState<boolean>(false);
  const [clipboardItems, setClipboardItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Resizing state
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  const phoneticBuffer = useRef<string>('');
  const lastInsertedLength = useRef<number>(0);
  const lastSpaceTime = useRef<number>(0);
  const swipeStartX = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hwInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [settings, setSettings] = useState<ExtendedAppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaults: ExtendedAppSettings = {
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
      enabledLayouts: [KeyboardLayout.ENGLISH, KeyboardLayout.BANGLA_AVRO, KeyboardLayout.ARABIC]
    };
    return saved ? JSON.parse(saved) : defaults;
  });

  const activeTheme = useMemo(() => {
    if (settings.theme === 'custom' && settings.customThemeImage) {
        return {
            id: 'custom',
            name: 'Custom',
            bg: 'bg-transparent',
            keyBg: settings.showKeyBorder ? 'bg-white/10' : 'bg-transparent',
            keyText: 'text-white',
            accent: 'bg-blue-500',
            accentText: 'text-white',
            border: settings.showKeyBorder ? 'border-white/5' : 'border-transparent',
            isDark: true
        } as ThemeConfig;
    }
    let theme = KEYBOARD_THEMES.find(t => t.id === settings.theme) || KEYBOARD_THEMES[0];
    if (!settings.showKeyBorder) {
        return { ...theme, keyBg: 'bg-transparent', border: 'border-transparent' };
    }
    return theme;
  }, [settings.theme, settings.customThemeImage, settings.showKeyBorder]);

  const getScriptClass = useCallback((l: KeyboardLayout) => {
    if (l === KeyboardLayout.BANGLA_AVRO || l === KeyboardLayout.BANGLA_JATIYO || l === KeyboardLayout.BANGLA_UNIBIJOY || l === KeyboardLayout.BANGLA_PROVHAT) return 'font-bangla';
    if (l === KeyboardLayout.ARABIC || l === KeyboardLayout.ARABIC_PHONETIC) return 'font-arabic';
    return 'font-inter';
  }, []);

  useEffect(() => {
    if (layout === KeyboardLayout.ENGLISH) {
      setNumericSubLang('en');
    } else if (layout === KeyboardLayout.ARABIC || layout === KeyboardLayout.ARABIC_PHONETIC) {
      setNumericSubLang('ar');
    } else {
      setNumericSubLang('bn');
    }
  }, [layout]);

  const currentRows = useMemo(() => {
    if (isNumericMode) return NUMERIC_ROWS;
    if (isSymbolMode) return SYMBOLS_ROWS;
    const rows = [...KEYBOARD_ROWS];
    if (settings.enableNumberRow) rows.unshift(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    return rows;
  }, [isSymbolMode, isNumericMode, settings.enableNumberRow]);

  const spacebarLabel = useMemo(() => {
    const labels: Record<string, string> = {
      [KeyboardLayout.ENGLISH]: 'English',
      [KeyboardLayout.ARABIC]: 'আরবী',
      [KeyboardLayout.ARABIC_PHONETIC]: 'আরবী ফোনেটিক',
      [KeyboardLayout.BANGLA_AVRO]: 'অভ্র',
      [KeyboardLayout.BANGLA_JATIYO]: 'জাতীয়',
      [KeyboardLayout.BANGLA_UNIBIJOY]: 'ইউনিবিজয়',
      [KeyboardLayout.BANGLA_PROVHAT]: 'প্রভাত',
    };
    return labels[layout] || layout;
  }, [layout]);

  const toggleKeyLabel = useMemo(() => {
    const isAltMode = isSymbolMode || isNumericMode;
    if (layout === KeyboardLayout.ENGLISH) {
      return isAltMode ? 'ABC' : '123/ABC';
    }
    if (layout === KeyboardLayout.ARABIC || layout === KeyboardLayout.ARABIC_PHONETIC) {
      return isAltMode ? 'أ ب' : '١٢٣/أ ب';
    }
    return isAltMode ? 'অ আ' : '১২৩/অ আ';
  }, [isSymbolMode, isNumericMode, layout]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (activeTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings, activeTheme]);

  const updateTextWithHistory = (newText: string) => {
    if (newText === text) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newText);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setText(newText);
  };

  const speakText = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
        const source = outCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(outCtx.destination);
        source.start();
      }
    } catch (e) {
      console.error("TTS Error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setIsLoading(true);
    try {
      const res = await getAIAssistance(text, 'translate', { to: 'English' });
      if (res) updateTextWithHistory(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHandwriting = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await getAIAssistance('', 'handwriting', { imageData: base64, mimeType: file.type });
        if (res) updateTextWithHistory(text + " " + res);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackspace = () => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    if (selectionStart === selectionEnd && selectionStart > 0) {
      const newText = text.substring(0, selectionStart - 1) + text.substring(selectionEnd);
      updateTextWithHistory(newText);
      phoneticBuffer.current = phoneticBuffer.current.slice(0, -1);
      lastInsertedLength.current = 0;
    } else {
      const newText = text.substring(0, selectionStart) + text.substring(selectionEnd);
      updateTextWithHistory(newText);
      phoneticBuffer.current = '';
      lastInsertedLength.current = 0;
    }
  };

  const getMappedChar = useCallback((key: string) => {
    if (!isNaN(parseInt(key)) && key.length === 1) {
      const val = parseInt(key);
      const index = val === 0 ? 9 : val - 1;
      return NUMERALS[numericSubLang][index];
    }
    if (isSymbolMode || isNumericMode) return key;
    const isShift = isShifted || isCapsLock;
    if (layout === KeyboardLayout.ENGLISH) return isShift ? key.toUpperCase() : key;
    const map = layout === KeyboardLayout.ARABIC ? ARABIC_MAP :
                layout === KeyboardLayout.BANGLA_JATIYO ? JATIYO_MAP :
                layout === KeyboardLayout.BANGLA_UNIBIJOY ? UNIBIJOY_MAP :
                layout === KeyboardLayout.BANGLA_PROVHAT ? PROVHAT_MAP : null;
    if (map && map[key]) return map[key];
    return isShift ? key.toUpperCase() : key;
  }, [isSymbolMode, isNumericMode, isShifted, isCapsLock, layout, numericSubLang]);

  const insertChar = (char: string) => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const now = Date.now();
    let charToInsert = char;
    let removePreviousCount = 0;

    if (!isNaN(parseInt(char)) && char.length === 1) {
        const val = parseInt(char);
        const index = val === 0 ? 9 : val - 1;
        charToInsert = NUMERALS[numericSubLang][index];
    }

    if (char === ' ' && selectionStart > 0 && text[selectionStart-1] === ' ' && (now - lastSpaceTime.current < 500)) {
        if (settings.doubleSpacePeriod) { charToInsert = '. '; removePreviousCount = 1; }
    }
    if (char === ' ') lastSpaceTime.current = now;

    const isPhonetic = layout === KeyboardLayout.BANGLA_AVRO || layout === KeyboardLayout.ARABIC_PHONETIC;
    if (isPhonetic && !isSymbolMode && !isNumericMode && char.match(/[a-zA-Z]/)) {
        const map = layout === KeyboardLayout.BANGLA_AVRO ? PHONETIC_MAP : ARABIC_PHONETIC_MAP;
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
            removePreviousCount = lastInsertedLength.current; 
            lastInsertedLength.current = match.length; 
        } else { 
            charToInsert = currentInput; 
            phoneticBuffer.current = currentInput; 
            removePreviousCount = 0; 
            lastInsertedLength.current = charToInsert.length; 
        }
    } else {
        if (char !== ' ') { phoneticBuffer.current = ''; lastInsertedLength.current = charToInsert.length; }
    }

    const startPart = text.substring(0, selectionStart - removePreviousCount);
    const endPart = text.substring(selectionEnd);
    const newText = startPart + charToInsert + endPart;
    updateTextWithHistory(newText);

    setTimeout(() => {
        if (textareaRef.current) {
            const newPos = selectionStart - removePreviousCount + charToInsert.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
        }
    }, 0);
  };

  const startVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = inputCtx;
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: { 
          responseModalities: [Modality.AUDIO], 
          inputAudioTranscription: {}, 
          systemInstruction: `Transcribe accurately.` 
        },
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
              const pcmBlob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => { session.sendRealtimeInput({ media: pcmBlob }); });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.inputTranscription) {
              const transcript = msg.serverContent.inputTranscription.text;
              if (transcript) setText(prev => prev + transcript);
            }
          },
          onerror: () => stopVoiceInput(),
          onclose: () => setIsRecording(false)
        }
      });
      sessionRef.current = await sessionPromise; setIsRecording(true);
    } catch (err) { console.error(err); }
  };

  const stopVoiceInput = () => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    setIsRecording(false);
  };

  const toggleVoiceInput = () => {
    if (isRecording) stopVoiceInput();
    else startVoiceInput();
  };

  const switchLayout = (direction: 'next' | 'prev') => {
    const currentIndex = settings.enabledLayouts.indexOf(layout);
    if (currentIndex === -1) return;
    let nextIndex = direction === 'next' ? (currentIndex + 1) % settings.enabledLayouts.length : (currentIndex - 1 + settings.enabledLayouts.length) % settings.enabledLayouts.length;
    setLayout(settings.enabledLayouts[nextIndex]);
    phoneticBuffer.current = '';
  };

  const nextStep = () => { 
    const next = currentStep + 1; 
    setCurrentStep(next); 
    localStorage.setItem(SETUP_STEP_KEY, next.toString()); 
  };

  const finishSetup = () => { 
    localStorage.setItem(SETUP_KEY, 'true'); 
    setIsSetupComplete(true); 
    setShowDashboard(true); 
  };

  const handleAISmartAction = async (task: AITask) => {
    setIsSmartMenuOpen(false);
    if (!text.trim()) return;
    try {
        const result = await getAIAssistance(text, task);
        if (result) updateTextWithHistory(result);
    } catch (err) { console.error(err); }
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    if (!settings.enableResizing) return;
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = settings.heightPortrait;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    const diffY = resizeStartY.current - e.clientY;
    const newHeight = Math.max(70, Math.min(150, resizeStartHeight.current + (diffY / 5)));
    setSettings(prev => ({ ...prev, heightPortrait: newHeight }));
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  const renderSettingsPage = () => {
    const renderHeader = (title: string, backToMain = false) => (
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 p-6 border-b dark:border-slate-800 flex items-center gap-4">
        <button onClick={() => {
            if (settingsSubPage === 'kb-mode') setSettingsSubPage('appearance');
            else if (backToMain) setSettingsSubPage(null);
            else setIsSettingsOpen(false);
        }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-xl font-bold font-inter">{title}</h2>
      </header>
    );

    const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
      <div className="flex justify-between items-center py-4 border-b dark:border-slate-800 last:border-0">
        <span className="font-medium text-[16px]">{label}</span>
        <div onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${value ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`}></div>
        </div>
      </div>
    );

    const radioOption = (label: string, selected: boolean, onClick: () => void) => (
        <div onClick={onClick} className="flex justify-between items-center py-4 border-b border-slate-50 last:border-0 cursor-pointer">
            <span className="text-[17px] font-medium text-slate-800">{label}</span>
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected ? 'border-blue-500' : 'border-slate-300'}`}>
                {selected && <div className="w-3.5 h-3.5 bg-blue-500 rounded-full" />}
            </div>
        </div>
    );

    if (settingsSubPage === 'kb-mode') {
        return (
            <div className="flex flex-col min-h-screen font-inter bg-slate-50">
                {renderHeader('Keyboard mode')}
                <div className="p-6 space-y-8">
                    <section className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-4">PORTRAIT VIEW</h3>
                        <div className="bg-white rounded-3xl p-6 shadow-sm">
                            {radioOption('Standard keyboard', settings.portraitMode === 'standard', () => setSettings({...settings, portraitMode: 'standard'}))}
                            {radioOption('One-handed keyboard', settings.portraitMode === 'one-handed', () => setSettings({...settings, portraitMode: 'one-handed'}))}
                            {radioOption('Floating keyboard', settings.portraitMode === 'floating', () => setSettings({...settings, portraitMode: 'floating'}))}
                        </div>
                    </section>

                    <section className="space-y-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-4">LANDSCAPE VIEW</h3>
                        <div className="bg-white rounded-3xl p-6 shadow-sm">
                            {radioOption('Standard keyboard', settings.landscapeMode === 'standard', () => setSettings({...settings, landscapeMode: 'standard'}))}
                            {radioOption('Split keyboard', settings.landscapeMode === 'split', () => setSettings({...settings, landscapeMode: 'split'}))}
                            {radioOption('Floating keyboard', settings.landscapeMode === 'floating', () => setSettings({...settings, landscapeMode: 'floating'}))}
                        </div>
                    </section>
                </div>
            </div>
        );
    }

    if (settingsSubPage === 'themes') {
      return (
        <div className="flex flex-col min-h-screen font-inter">
          {renderHeader('থিমসমূহ', true)}
          <div className="p-6 grid grid-cols-2 gap-4">
            {KEYBOARD_THEMES.map(t => (
              <button key={t.id} onClick={() => setSettings({...settings, theme: t.id})} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${settings.theme === t.id ? 'border-teal-600' : 'border-transparent bg-slate-50 dark:bg-slate-800'}`}>
                <div className={`w-full aspect-video rounded-lg ${t.bg} border ${t.border}`}>
                   <div className="flex gap-1 p-2">
                     <div className={`h-4 flex-1 rounded-sm ${t.keyBg}`}></div>
                     <div className={`h-4 flex-1 rounded-sm ${t.keyBg}`}></div>
                     <div className={`h-4 flex-1 rounded-sm ${t.accent}`}></div>
                   </div>
                </div>
                <span className="text-xs font-bold">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (!settingsSubPage) {
      return (
        <div className="flex flex-col min-h-screen font-bangla">
          {renderHeader('সেটিংস')}
          <div className="p-6 space-y-2">
            {[
              { id: 'preferences', label: 'পছন্দসমূহ', icon: '⚡', color: 'text-orange-500' },
              { id: 'appearance', label: 'আকার ও উচ্চতা', icon: '📏', color: 'text-blue-500' },
              { id: 'themes', label: 'থিম', icon: '🎨', color: 'text-pink-500' },
              { id: 'layout-management', label: 'ভাষা ও লে-আউট', icon: '⌨️', color: 'text-teal-500' },
              { id: 'smart-typing', label: 'স্মার্ট টাইপিং (AI)', icon: '✨', color: 'text-purple-500' },
              { id: 'advanced', label: 'অ্যাডভান্সড সেটিংস', icon: '⚙️', color: 'text-slate-500' }
            ].map(item => (
              <button key={item.id} onClick={() => setSettingsSubPage(item.id as any)} className="w-full p-5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={`text-2xl ${item.color}`}>{item.icon}</span>
                  <span className="text-lg font-bold">{item.label}</span>
                </div>
                <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-screen font-inter">
        {renderHeader(settingsSubPage.charAt(0).toUpperCase() + settingsSubPage.slice(1).replace('-', ' '), true)}
        <div className="p-6 space-y-4">
          {settingsSubPage === 'preferences' && (
            <div className="space-y-4 font-bangla">
              {toggle('অটো ক্যাপিটালাইজেশন', settings.autoCapitalization, (v) => setSettings({...settings, autoCapitalization: v}))}
              {toggle('ডাবল স্পেস পিরিয়ড (. )', settings.doubleSpacePeriod, (v) => setSettings({...settings, doubleSpacePeriod: v}))}
              {toggle('ভয়েস টাইপিং বাটন দেখান', settings.voiceInputKey, (v) => setSettings({...settings, voiceInputKey: v}))}
              {toggle('ভাইব্রেশন', settings.vibrateOnKeypress, (v) => setSettings({...settings, vibrateOnKeypress: v}))}
              {toggle('সাউন্ড', settings.soundOnKeypress, (v) => setSettings({...settings, soundOnKeypress: v}))}
              {toggle('কী পপআপ', settings.popupOnKeypress, (v) => setSettings({...settings, popupOnKeypress: v}))}
            </div>
          )}
          {settingsSubPage === 'appearance' && (
            <div className="space-y-6">
              <button onClick={() => setSettingsSubPage('kb-mode')} className="w-full p-5 flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex flex-col items-start">
                    <span className="font-bold text-slate-800">Keyboard mode</span>
                    <span className="text-xs text-slate-400">Portrait: {settings.portraitMode}, Landscape: {settings.landscapeMode}</span>
                </div>
                <svg className="w-5 h-5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
              </button>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>উচ্চতা (পোর্ট্রেট)</span><span>{settings.heightPortrait.toFixed(0)}%</span></div>
                <input type="range" min="70" max="150" value={settings.heightPortrait} onChange={(e) => setSettings({...settings, heightPortrait: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>কিবোর্ড স্কেল</span><span>{settings.kbSize}%</span></div>
                <input type="range" min="50" max="120" value={settings.kbSize} onChange={(e) => setSettings({...settings, kbSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>স্বচ্ছতা (Transparency)</span><span>{settings.kbTransparency}%</span></div>
                <input type="range" min="30" max="100" value={settings.kbTransparency} onChange={(e) => setSettings({...settings, kbTransparency: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              {toggle('Show Key Border', settings.showKeyBorder, (v) => setSettings({...settings, showKeyBorder: v}))}
              {toggle('Enable Number Row', settings.enableNumberRow, (v) => setSettings({...settings, enableNumberRow: v}))}
              {toggle('Enable Drag Resizing', settings.enableResizing, (v) => setSettings({...settings, enableResizing: v}))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const currentMode = useMemo(() => {
    return window.matchMedia("(orientation: landscape)").matches ? settings.landscapeMode : settings.portraitMode;
  }, [settings.landscapeMode, settings.portraitMode]);

  const keyboardStyles = useMemo(() => {
    const base = {
        transform: `scale(${settings.kbSize / 100})`, 
        backgroundImage: settings.theme === 'custom' && settings.customThemeImage ? `url(${settings.customThemeImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        height: `${(settings.heightPortrait / 100) * 340}px`,
        opacity: settings.kbTransparency / 100 
    };
    
    if (currentMode === 'floating') {
        return { ...base, width: '70%', margin: '0 auto', borderRadius: '2rem' };
    }
    if (currentMode === 'one-handed') {
        return { 
            ...base, 
            width: `${settings.oneHandedWidthPortrait}%`, 
            marginRight: settings.oneHandedSide === 'left' ? 'auto' : '0', 
            marginLeft: settings.oneHandedSide === 'right' ? 'auto' : '0' 
        };
    }
    return base;
  }, [settings.kbSize, settings.heightPortrait, settings.kbTransparency, settings.theme, settings.customThemeImage, currentMode, settings.oneHandedWidthPortrait, settings.oneHandedSide]);

  return (
    <div className={`min-h-screen transition-all duration-700 ${activeTheme.bg} ${activeTheme.isDark ? 'text-white' : 'text-slate-900'} flex flex-col items-center overflow-hidden`}>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[400] bg-white dark:bg-slate-900 overflow-y-auto">
          {renderSettingsPage()}
        </div>
      )}

      {isHelpOpen && (
        <div className="fixed inset-0 z-[500] bg-black/70 backdrop-blur-lg flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-white/10">
                <header className="p-8 border-b dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-2xl font-black font-bangla">টাইপিং গাইড</h2>
                    <button onClick={() => setIsHelpOpen(false)} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </header>
            </div>
        </div>
      )}

      <main className="w-full max-w-4xl h-full flex flex-col p-6 gap-6">
        <div className={`glass-panel rounded-[2.5rem] shadow-2xl border-t-2 border-blue-500/30 p-8 transition-all relative ${showDashboard ? 'flex-1' : 'h-40'}`}>
            <textarea ref={textareaRef} value={text} onFocus={() => setShowDashboard(false)} onChange={(e) => updateTextWithHistory(e.target.value)} placeholder="টাইপ করা শুরু করুন..." style={{ fontSize: `${settings.fontSize}px` }} className={`w-full h-full bg-transparent border-none focus:ring-0 resize-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 font-medium ${getScriptClass(layout)}`} dir={layout.includes('Arabic') ? 'rtl' : 'ltr'} />
        </div>

        {!showDashboard && (
          <div 
            style={keyboardStyles}
            className={`glass-panel rounded-t-[3rem] p-6 pt-0 shadow-2xl ${activeTheme.bg} overflow-hidden relative flex flex-col animate-in slide-in-from-bottom duration-400`}
          >
              {settings.theme === 'custom' && settings.customThemeImage && (
                  <div className="absolute inset-0 bg-black pointer-events-none z-0" style={{ opacity: 1 - (settings.customThemeBrightness || 70) / 100 }}></div>
              )}
              
              {settings.enableResizing && (
                <div onPointerDown={handleResizeStart} onPointerMove={handleResizeMove} onPointerUp={handleResizeEnd} className="w-full h-8 flex items-center justify-center cursor-ns-resize group relative z-50 touch-none">
                  <div className={`w-12 h-1.5 rounded-full ${isResizing ? 'bg-teal-500 scale-x-125' : 'bg-slate-400/30 group-hover:bg-slate-400/50'} transition-all`}></div>
                </div>
              )}

              <div className="flex items-center h-14 px-2 relative z-10 overflow-x-auto no-scrollbar gap-1 border-b dark:border-white/10 mb-2">
                  <button onClick={() => setShowDashboard(true)} className="p-3 opacity-50 hover:opacity-100 flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 flex-shrink-0"></div>
                  <button onClick={() => setIsClipboardOpen(true)} className="p-3 opacity-60 flex-shrink-0">📋</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className={`p-3 text-[14px] font-black ${isNumericMode ? 'text-teal-500' : 'opacity-60'} flex-shrink-0`}>🔢</button>
                  <button onClick={speakText} className="p-3 opacity-60 flex-shrink-0">🔊</button>
                  <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-3 opacity-50 flex-shrink-0">😊</button>
                  {settings.voiceInputKey && (
                    <button onClick={() => toggleVoiceInput()} className={`p-3 flex-shrink-0 ${isRecording ? 'text-red-500 animate-pulse' : 'opacity-50'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                    </button>
                  )}
              </div>

              <div className={`flex ${currentMode === 'split' ? 'gap-8' : 'flex-col gap-1'} relative z-10 flex-grow justify-end pb-4`}>
                  {currentMode === 'split' ? (
                      <>
                        <div className="flex-1 flex flex-col gap-1">
                            {currentRows.map((row, i) => (
                                <div key={i} className="flex gap-1">
                                    {row.slice(0, Math.ceil(row.length / 2)).map(key => (
                                        <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-10 flex-1 rounded-full border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-[15px] active:scale-90 transition-all ${getScriptClass(layout)}`}>{getMappedChar(key)}</button>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                             {currentRows.map((row, i) => (
                                <div key={i} className="flex gap-1">
                                    {row.slice(Math.ceil(row.length / 2)).map(key => (
                                        <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-10 flex-1 rounded-full border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-[15px] active:scale-90 transition-all ${getScriptClass(layout)}`}>{getMappedChar(key)}</button>
                                    ))}
                                </div>
                            ))}
                        </div>
                      </>
                  ) : (
                    currentRows.map((row, i) => (
                        <div key={i} className="flex justify-center gap-1">
                            {((settings.enableNumberRow && i === 3) || (!settings.enableNumberRow && i === 2)) && (
                               <button onMouseDown={(e) => { e.preventDefault(); setIsShifted(!isShifted); }} className={`h-11 w-12 rounded-full font-black text-xs flex items-center justify-center transition-all ${isShifted ? activeTheme.accent + ' ' + activeTheme.accentText : 'bg-white/5 ' + activeTheme.keyText + ' border border-white/5 shadow-inner'}`}>{isShifted ? '▲' : '△'}</button>
                            )}
                            {row.map((key) => (
                                <button key={key} onMouseDown={(e) => { e.preventDefault(); insertChar(key); }} className={`h-11 ${!isNumericMode ? 'flex-1 min-w-0 max-w-[40px]' : 'w-16'} rounded-full shadow-md border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-[17px] active:scale-90 transition-all ${getScriptClass(layout)} flex items-center justify-center overflow-hidden`}>{getMappedChar(key)}</button>
                            ))}
                            {((settings.enableNumberRow && i === 2) || (!settings.enableNumberRow && i === 1)) && !isNumericMode && (
                              <button onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }} className={`h-11 w-14 rounded-[1.2rem] border bg-white/5 ${activeTheme.keyText} border-white/10 flex items-center justify-center text-lg active:scale-95 shadow-lg`}><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/></svg></button>
                            )}
                        </div>
                      ))
                  )}
                  
                  {currentMode !== 'split' && (
                    <div className="flex justify-center gap-1.5 mt-1">
                        <button onClick={() => { setIsSymbolMode(!isSymbolMode); setIsNumericMode(false); }} className={`h-12 w-16 rounded-full border font-black text-[10px] leading-tight flex items-center justify-center transition-all active:scale-90 bg-white/5 ${activeTheme.keyText} border-white/10 ${layout.includes('Arabic') ? 'font-arabic' : 'font-inter'}`}>
                            <span className="text-center">{toggleKeyLabel}</span>
                        </button>
                        <button onPointerDown={(e) => { swipeStartX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }} onPointerUp={(e) => { if (swipeStartX.current !== null) { const diffX = e.clientX - swipeStartX.current; if (Math.abs(diffX) > 40) switchLayout(diffX > 0 ? 'prev' : 'next'); else insertChar(' '); swipeStartX.current = null; } }} className={`h-12 flex-[4] rounded-full border shadow-inner font-black text-xs uppercase active:scale-[0.98] bg-white/5 ${activeTheme.keyText} border-white/10`}>{spacebarLabel}</button>
                        <button onMouseDown={(e) => { e.preventDefault(); insertChar('\n'); }} className={`h-12 w-20 rounded-full ${activeTheme.accent} ${activeTheme.accentText} text-[10px] font-black uppercase shadow-xl active:scale-95 flex items-center justify-center`}>DONE</button>
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
