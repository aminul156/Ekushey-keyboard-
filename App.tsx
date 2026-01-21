
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
      theme: 'midnight_black',
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

  const insertChar = (char: string) => {
    if (!textareaRef.current) return;
    const { selectionStart, selectionEnd } = textareaRef.current;
    const now = Date.now();
    let charToInsert = char;
    let removePreviousCount = 0;

    if (isNumericMode && !isNaN(parseInt(char))) {
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

  const getMappedChar = (key: string) => {
    if (isSymbolMode || isNumericMode) return key;
    const isShift = isShifted || isCapsLock;
    if (layout === KeyboardLayout.ENGLISH) return isShift ? key.toUpperCase() : key;
    const map = layout === KeyboardLayout.ARABIC ? ARABIC_MAP :
                layout === KeyboardLayout.BANGLA_JATIYO ? JATIYO_MAP :
                layout === KeyboardLayout.BANGLA_UNIBIJOY ? UNIBIJOY_MAP :
                layout === KeyboardLayout.BANGLA_PROVHAT ? PROVHAT_MAP : null;
    if (map && map[key]) return map[key];
    return isShift ? key.toUpperCase() : key;
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

  const renderSettingsPage = () => {
    const renderHeader = (title: string, backToMain = false) => (
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 p-6 border-b dark:border-slate-800 flex items-center gap-4">
        <button onClick={() => backToMain ? setSettingsSubPage(null) : setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-xl font-bold font-bangla">{title}</h2>
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
            <div className="col-span-2 mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <h3 className="font-bold mb-4">কাস্টম ইমেজ থিম</h3>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setSettings({ ...settings, theme: 'custom', customThemeImage: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }
              }} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-teal-600 text-white rounded-xl font-bold mb-4">গ্যালারি থেকে ছবি নিন</button>
              {settings.theme === 'custom' && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm font-bold"><span>উজ্জ্বলতা</span><span>{settings.customThemeBrightness}%</span></div>
                  <input type="range" min="0" max="100" value={settings.customThemeBrightness} onChange={(e) => setSettings({...settings, customThemeBrightness: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
                </div>
              )}
            </div>
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
            <>
              {toggle('Auto Capitalization', settings.autoCapitalization, (v) => setSettings({...settings, autoCapitalization: v}))}
              {toggle('Double-space period', settings.doubleSpacePeriod, (v) => setSettings({...settings, doubleSpacePeriod: v}))}
              {toggle('Vibrate on keypress', settings.vibrateOnKeypress, (v) => setSettings({...settings, vibrateOnKeypress: v}))}
              {toggle('Sound on keypress', settings.soundOnKeypress, (v) => setSettings({...settings, soundOnKeypress: v}))}
              {toggle('Popup on keypress', settings.popupOnKeypress, (v) => setSettings({...settings, popupOnKeypress: v}))}
            </>
          )}
          {settingsSubPage === 'appearance' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>উচ্চতা (পোর্ট্রেট)</span><span>{settings.heightPortrait}%</span></div>
                <input type="range" min="70" max="150" value={settings.heightPortrait} onChange={(e) => setSettings({...settings, heightPortrait: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>কিবোর্ড সাইজ</span><span>{settings.kbSize}%</span></div>
                <input type="range" min="50" max="120" value={settings.kbSize} onChange={(e) => setSettings({...settings, kbSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              {toggle('Show Key Border', settings.showKeyBorder, (v) => setSettings({...settings, showKeyBorder: v}))}
              {toggle('Enable Number Row', settings.enableNumberRow, (v) => setSettings({...settings, enableNumberRow: v}))}
            </div>
          )}
          {settingsSubPage === 'smart-typing' && (
            <>
              {toggle('Enable AI Smart Typing', settings.enableSmartTyping, (v) => setSettings({...settings, enableSmartTyping: v}))}
              {toggle('Smart Grammar Check', settings.smartGrammar, (v) => setSettings({...settings, smartGrammar: v}))}
              {toggle('Smart Compose completions', settings.smartCompose, (v) => setSettings({...settings, smartCompose: v}))}
            </>
          )}
          {settingsSubPage === 'layout-management' && (
             <div className="space-y-6">
                <h3 className="font-bold text-teal-600">এনাবেল লে-আউটসমূহ</h3>
                {[KeyboardLayout.ENGLISH, KeyboardLayout.BANGLA_AVRO, KeyboardLayout.BANGLA_JATIYO, KeyboardLayout.BANGLA_PROVHAT, KeyboardLayout.ARABIC].map(l => (
                  <div key={l} className="flex justify-between items-center py-2">
                    <span className="font-medium">{l}</span>
                    <button onClick={() => {
                       const isEnabled = settings.enabledLayouts.includes(l);
                       if (isEnabled && settings.enabledLayouts.length > 1) {
                         setSettings({...settings, enabledLayouts: settings.enabledLayouts.filter(item => item !== l)});
                       } else if (!isEnabled) {
                         setSettings({...settings, enabledLayouts: [...settings.enabledLayouts, l]});
                       }
                    }} className={`px-4 py-1.5 rounded-full font-bold text-xs transition-colors ${settings.enabledLayouts.includes(l) ? 'bg-teal-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      {settings.enabledLayouts.includes(l) ? 'অ্যাক্টিভ' : 'চালু করুন'}
                    </button>
                  </div>
                ))}
             </div>
          )}
        </div>
      </div>
    );
  };

  const renderSetupHeader = () => (
      <div className="p-8 pb-4">
          <h1 className="text-[32px] font-bold text-slate-800 leading-tight mb-8 font-bangla">একুশে বাংলা কিবোর্ড<br />সেট আপ<br />হচ্ছে</h1>
          <div className="flex gap-8 items-center mb-12">
              {['১', '২', '৩', '৪', '৫', '৬'].map((num, i) => (
                  <span key={i} className={`text-lg font-bold transition-colors ${currentStep >= (i + 1) ? "text-teal-600" : "text-slate-300"}`}>{num}</span>
              ))}
          </div>
      </div>
  );

  const renderPrivacyFooter = () => (
      <div className="mt-auto p-8 border-t border-slate-100 bg-white">
          <div className="flex gap-4 items-start mb-2">
              <div className="mt-1">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                  <h3 className="text-[20px] font-bold text-slate-800 mb-2 font-bangla">আপনার ডাটা নিরাপদ</h3>
                  <p className="text-slate-500 text-[14px] leading-[1.6] font-bangla">একুশে বাংলা কিবোর্ড আপনার লেখা কোনো কিছু সংগ্রহ করে না। আপনি যে ওয়ার্নিংটি দেখতে পান তা এন্ড্রয়েড সিস্টেম থেকে সব থার্ড-পার্টি কিবোর্ড এর ক্ষেত্রে দেখানো হয়।</p>
              </div>
          </div>
          <button className="text-teal-600 font-bold text-[15px] ml-12 font-bangla">আরো জানুন</button>
      </div>
  );

  const renderSetupDialogs = () => {
    if (!setupDialog) return null;
    if (setupDialog === 'system_alert') return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/40 p-6 animate-in fade-in duration-200">
            <div className="bg-white rounded-[1rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 font-bangla">
                <div className="flex items-center gap-3 text-orange-500 mb-6">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
                    <h4 className="text-xl font-bold">এন্ড্রয়েড সিস্টেম সতর্কতা</h4>
                </div>
                <p className="text-slate-600 text-[15px] leading-relaxed mb-10">কীবোর্ডটি চালু করার সময় এন্ড্রয়েড থেকে একটি সতর্কতা (Attention) দেখতে পাবেন। এটি সকল থার্ড-পার্টি কীবোর্ড এর ক্ষেত্রে এন্ড্রয়েড সিস্টেম থেকে অটোমেটিক দেখানো হয়। ঘাবড়ানোর কিছু নেই, একুশে কীবোর্ড আপনার কোনো তথ্য সংগ্রহ করে না।</p>
                <div className="flex justify-end gap-10 font-bold tracking-wider text-teal-700">
                    <button onClick={() => setSetupDialog(null)}>CANCEL</button>
                    <button onClick={() => { setSetupDialog(null); nextStep(); }}>OK</button>
                </div>
            </div>
        </div>
    );
    if (setupDialog === 'input_method') return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/30 p-4 font-inter">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
                <h4 className="text-xl font-bold mb-6">Choose input method</h4>
                <div className="space-y-6 mb-8">
                    {[
                      { id: 'en_ek', label: 'English', sub: 'Ekushey Keyboard' },
                      { id: 'ms_sk', label: 'Microsoft SwiftKey Keyboard', sub: '' },
                      { id: 'ri_kb', label: 'Ridmik Keyboard', sub: '' },
                      { id: 'sa_kb', label: 'Samsung Keyboard', sub: '', selected: true }
                    ].map((kb, i) => (
                        <div key={i} className="flex items-center gap-4 cursor-pointer" onClick={() => { if(kb.id === 'en_ek') { setSetupDialog(null); nextStep(); } }}>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${kb.selected ? 'border-blue-500' : 'border-slate-300'}`}>{kb.selected && <div className="w-3 h-3 bg-blue-500 rounded-full" />}</div>
                            <div className="flex flex-col">
                                <span className="text-lg font-medium">{kb.label}</span>
                                {kb.sub && <span className="text-xs text-slate-400">{kb.sub}</span>}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="pt-4 border-t border-slate-100">
                   <div className="flex justify-between items-center">
                       <div className="flex flex-col"><span className="font-bold text-sm">Show Keyboard button</span><span className="text-[10px] text-slate-400">Show keyboard button on the navigation bar.</span></div>
                       <div className="w-10 h-5 bg-slate-200 rounded-full"></div>
                   </div>
                </div>
            </div>
        </div>
    );
    if (setupDialog === 'audio_perm') return (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/30 p-4">
            <div className="bg-white rounded-[2rem] w-full max-w-xs shadow-2xl p-8 flex flex-col items-center animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 rounded-full border-2 border-blue-500 flex items-center justify-center mb-6"><div className="w-4 h-6 bg-blue-500 rounded-full relative"><div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-0.5 bg-blue-500"></div></div></div>
                <p className="text-center font-bold text-slate-800 mb-8 leading-tight">Allow Ekushey Keyboard to record audio?</p>
                <div className="w-full flex flex-col gap-4">
                    <button onClick={() => { setSetupDialog(null); nextStep(); }} className="font-bold text-slate-800 text-[15px]">While using the app</button>
                    <button onClick={() => { setSetupDialog(null); nextStep(); }} className="font-bold text-slate-800 text-[15px]">Only this time</button>
                    <button onClick={() => setSetupDialog(null)} className="font-bold text-slate-800 text-[15px]">Don't allow</button>
                </div>
            </div>
        </div>
    );
    return null;
  };

  if (!isSetupComplete) {
      return (
          <div className="fixed inset-0 z-[500] flex flex-col bg-[#fcfcfc] select-none">
              <div className="flex-1 flex flex-col overflow-y-auto">
                {renderSetupHeader()}
                <div className="px-6 flex-1 flex flex-col gap-6">
                    {currentStep === 0 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">সেট আপ শুরু করুন</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8]">একুশে বাংলা কিবোর্ড ব্যবহার করতে হলে আপনাকে কয়েকটি ধাপ সম্পন্ন করতে হবে।</p>
                            </div>
                            <button onClick={nextStep} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors active:bg-slate-100">
                                সেট আপ শুরু করুন
                            </button>
                        </div>
                    )}
                    {currentStep === 1 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">কীবোর্ড অন করুন</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8]">অনুগ্রহ করে আপনার ভাষা ও ইনপুট সেটিংসে একুশে কিবোর্ড অন করুন। এর ফলে এটি আপনার ডিভাইসে চলার জন্য অনুমোদন পাবে।</p>
                            </div>
                            <button onClick={() => setSetupDialog('system_alert')} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] flex items-center gap-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
                                <span className="p-2 rounded-full bg-teal-50 text-teal-600">🌐</span>
                                সেটিংস অন করুন
                            </button>
                        </div>
                    )}
                    {currentStep === 2 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">কী-বোর্ড সুইচ করুন</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8]">আপনার কিবোর্ড পরিবর্তন করুন এবং একুশে বাংলা কিবোর্ড নির্বাচন করুন।</p>
                            </div>
                            <button onClick={() => setSetupDialog('input_method')} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] flex items-center gap-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
                                <span className="p-2 rounded-full bg-teal-50 text-teal-600">🌐</span>
                                কিবোর্ড পরিবর্তন করুন
                            </button>
                        </div>
                    )}
                    {currentStep === 3 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">বাংলা লেখার পদ্ধতি পছন্দ করুন</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8] mb-8">আপনার পছন্দের বাংলা লে-আউট নির্বাচন করুন (পরবর্তীতে পরিবর্তন করা যাবে)।</p>
                                <div className="space-y-4">
                                    {[
                                        { id: KeyboardLayout.BANGLA_AVRO, label: 'অভ্র' },
                                        { id: KeyboardLayout.BANGLA_JATIYO, label: 'জাতীয়' },
                                        { id: KeyboardLayout.BANGLA_PROVHAT, label: 'প্রভাত' }
                                    ].map(item => (
                                        <div key={item.id} className="flex items-center gap-4" onClick={() => {
                                            const isEnabled = settings.enabledLayouts.includes(item.id);
                                            setSettings(prev => ({...prev, enabledLayouts: isEnabled ? prev.enabledLayouts.filter(l => l !== item.id) : [...prev.enabledLayouts, item.id]}));
                                        }}>
                                            <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${settings.enabledLayouts.includes(item.id) ? 'bg-teal-600' : 'border-2 border-slate-200'}`}>
                                                {settings.enabledLayouts.includes(item.id) && <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <span className="text-[17px] font-medium">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={nextStep} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors active:bg-slate-100">
                                পরের ধাপে যান
                            </button>
                        </div>
                    )}
                    {currentStep === 4 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[22px] font-bold text-slate-700 mb-6 leading-tight">ভাষা পরিবর্তনের জন্য অতিরিক্ত বাটন</h2>
                                <p className="text-slate-500 text-[15px] leading-[1.7] mb-8">আপনি স্পেস বারে সোয়াইপ করে অথবা গ্লোব আইকনে ক্লিক করে ভাষা পরিবর্তন করতে পারবেন।</p>
                                <div className="flex justify-between items-center mb-6">
                                    <span className="font-bold text-slate-800 text-[17px]">অতিরিক্ত বাটন ব্যবহার করুন</span>
                                    <div onClick={() => setSettings(prev => ({...prev, showGlobeKey: !prev.showGlobeKey}))} className={`w-11 h-6 rounded-full p-1 transition-colors ${settings.showGlobeKey ? 'bg-teal-600' : 'bg-slate-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.showGlobeKey ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>
                                <p className="text-emerald-700 text-[13px] font-medium leading-[1.6]">টিপস: স্পেস বারে ১ সেকেন্ড চেপে ধরে ডানে-বামে সোয়াইপ করে কার্সর নাড়াচাড়া করা যায়।</p>
                            </div>
                            <button onClick={() => setSetupDialog('audio_perm')} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors active:bg-slate-100">
                                পরের ধাপে যান
                            </button>
                        </div>
                    )}
                    {currentStep === 5 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">কিবোর্ডের উচ্চতা</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8] mb-10">কিবোর্ডের উচ্চতা ঠিক করুন</p>
                                <div className="space-y-4">
                                    <span className="font-bold text-slate-800 text-[15px]">উচ্চতা:</span>
                                    <input type="range" min="70" max="150" value={settings.heightPortrait} onChange={(e) => setSettings(prev => ({...prev, heightPortrait: parseInt(e.target.value)}))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600" />
                                    <div className="flex justify-between text-[13px] text-slate-400 font-bold pt-2">
                                        <span>স্বাভাবিক</span>
                                        <span>সম্প্রসারিত</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={nextStep} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors active:bg-slate-100">
                                পরের ধাপে যান
                            </button>
                        </div>
                    )}
                    {currentStep === 6 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">নম্বর সারি</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8] mb-10">নম্বর সারিটি কিবোর্ডে একটি অতিরিক্ত সারি যুক্ত করবে</p>
                                <div className="flex justify-between items-center mb-6">
                                    <span className="font-bold text-slate-800 text-[17px]">নম্বর সারি যুক্ত করুন</span>
                                    <div onClick={() => setSettings(prev => ({...prev, enableNumberRow: !prev.enableNumberRow}))} className={`w-11 h-6 rounded-full p-1 transition-colors ${settings.enableNumberRow ? 'bg-teal-600' : 'bg-slate-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.enableNumberRow ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={nextStep} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors active:bg-slate-100">
                                পরের ধাপে যান
                            </button>
                        </div>
                    )}
                    {currentStep === 7 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[24px] font-bold text-slate-700 mb-6">আপডেট থাকুন</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8] mb-10">জরুরি আপডেট বা অন্যান্য বিষয়ে অবগত থাকতে নোটিফিকেশনের অনুমতি দিন</p>
                            </div>
                            <div className="flex flex-col">
                                <button className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] border-b border-slate-50 hover:bg-slate-50 transition-colors">অনুমতি দিন</button>
                                <button onClick={nextStep} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors">সেটিংস ঠিক করুন</button>
                            </div>
                        </div>
                    )}
                    {currentStep === 8 && (
                        <div className="bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden font-bangla animate-in fade-in duration-300">
                            <div className="p-10 pb-6 border-b border-slate-50">
                                <h2 className="text-[26px] font-bold text-orange-500 mb-6 leading-tight">অভিনন্দন আপনি পুরোপুরি প্রস্তুত</h2>
                                <p className="text-slate-500 text-[16px] leading-[1.8] mb-4">আপনার কীবোর্ড সেটআপ সম্পন্ন হয়েছে।</p>
                                <p className="text-slate-500 text-[16px] leading-[1.8]">আপনি চাইলে সেটিংস ঠিক করতে পারেন।</p>
                            </div>
                            <div className="flex flex-col">
                                <button onClick={() => { setIsSettingsOpen(true); setIsSetupComplete(true); setShowDashboard(true); }} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] border-b border-slate-50 hover:bg-slate-50 transition-colors">সেটিংস ঠিক করুন</button>
                                <button onClick={finishSetup} className="w-full py-6 px-10 text-left text-teal-600 font-bold text-[18px] hover:bg-slate-50 transition-colors">সেট আপ শেষ করুন</button>
                            </div>
                        </div>
                    )}
                </div>
                {renderPrivacyFooter()}
              </div>
              {renderSetupDialogs()}
          </div>
      );
  }

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
                <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar font-inter space-y-6">
                    <section><h3 className="font-bold text-blue-500 mb-2">Vowels (স্বরবর্ণ)</h3><p className="text-sm opacity-60">a=া, A=আ, i=ি, I=ঈ, u=ু, U=ঊ</p></section>
                    <section><h3 className="font-bold text-blue-500 mb-2">Consonants (ব্যঞ্জনবর্ণ)</h3><p className="text-sm opacity-60">k=ক, kh=খ, g=গ, gh=ঘ, c=চ, ch=ছ</p></section>
                    <section><h3 className="font-bold text-orange-500 mb-2">Complex (যুক্তাক্ষর)</h3><p className="text-sm opacity-60">kkh=ক্ষ, jGY=জ্ঞ, nc=ঞ্চ, ShN=ষ্ণ</p></section>
                </div>
            </div>
        </div>
      )}

      {/* Clipboard UI */}
      {isClipboardOpen && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-1/2 rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black font-bangla">ক্লিপবোর্ড</h3>
              <button onClick={() => setIsClipboardOpen(false)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
               {clipboardItems.length === 0 ? <p className="text-slate-400 text-center mt-10">কোনো তথ্য নেই</p> : 
               clipboardItems.map((item, i) => (
                 <div key={i} onClick={() => { insertChar(item); setIsClipboardOpen(false); }} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl cursor-pointer hover:bg-slate-100">{item}</div>
               ))}
            </div>
          </div>
        </div>
      )}

      {/* Smart Actions AI Menu */}
      {isSmartMenuOpen && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black font-bangla text-blue-600">AI স্মার্ট অ্যাকশন</h3>
              <button onClick={() => setIsSmartMenuOpen(false)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'grammar', label: 'ব্যাকরণ ঠিক করুন', icon: '✍️' },
                { id: 'translate', label: 'অনুবাদ করুন', icon: '🌍' },
                { id: 'style', label: 'স্টাইল পরিবর্তন', icon: '✨' },
                { id: 'dictionary', label: 'অভিধান', icon: '📖' },
                { id: 'emojiSearch', label: 'ইমোজি খুঁজুন', icon: '🎭' }
              ].map(action => (
                <button key={action.id} onClick={() => handleAISmartAction(action.id as AITask)} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <span className="text-2xl">{action.icon}</span>
                  <span className="font-bold font-bangla">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emoji Panel */}
      {isEmojiOpen && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-2/3 rounded-t-[3rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black font-bangla">ইমোজি</h3>
              <button onClick={() => setIsEmojiOpen(false)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"/></svg></button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-6 gap-2 p-2 scrollbar-hide">
               {COMMON_EMOJIS.map(emoji => (
                 <button key={emoji} onClick={() => insertChar(emoji)} className="text-3xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">{emoji}</button>
               ))}
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl h-full flex flex-col p-6 gap-6">
        <div className={`glass-panel rounded-[2.5rem] shadow-2xl border-t-2 border-blue-500/30 p-8 transition-all relative ${showDashboard ? 'flex-1' : 'h-40'}`}>
            <textarea ref={textareaRef} value={text} onFocus={() => setShowDashboard(false)} onChange={(e) => updateTextWithHistory(e.target.value)} placeholder="টাইপ করা শুরু করুন..." style={{ fontSize: `${settings.fontSize}px` }} className={`w-full h-full bg-transparent border-none focus:ring-0 resize-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 font-medium ${getScriptClass(layout)}`} dir={layout.includes('Arabic') ? 'rtl' : 'ltr'} />
            {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/20 backdrop-blur-sm rounded-[2.5rem] z-20"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div></div>}
        </div>

        {showDashboard ? (
          <div className="flex-1 flex flex-col justify-center animate-in zoom-in-95 duration-500 font-bangla">
             <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'সেটিংস', icon: '⚙️', onClick: () => setIsSettingsOpen(true) },
                  { label: 'অনুশীলন', icon: '⌨️', onClick: () => { setShowDashboard(false); setTimeout(() => textareaRef.current?.focus(), 100); } },
                  { label: 'কী-ম্যাপ', icon: '🗺️', onClick: () => setIsHelpOpen(true) },
                  { label: 'টিপস', icon: '📖', onClick: () => setIsHelpOpen(true) }
                ].map(card => (
                  <button key={card.label} onClick={card.onClick} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl flex flex-col items-center gap-4 active:scale-95 transition-all border border-slate-50 dark:border-white/5">
                      <span className="text-4xl">{card.icon}</span>
                      <span className="font-black text-lg">{card.label}</span>
                  </button>
                ))}
                <button onClick={() => alert('Ekushey Keyboard Master v2.0 - Developed for modern typing experiences.')} className="bg-white dark:bg-slate-800 p-8 rounded-[3rem] shadow-xl flex flex-col items-center gap-4 active:scale-95 transition-all border border-slate-50 dark:border-white/5">
                      <span className="text-4xl">ℹ️</span>
                      <span className="font-black text-lg">সম্পর্কে</span>
                  </button>
                  <button onClick={() => setShowDashboard(false)} className="bg-[#1e293b] text-white p-8 rounded-[3rem] shadow-xl flex flex-col items-center gap-4 active:scale-95 transition-all border border-white/10">
                      <span className="text-4xl">🚪</span>
                      <span className="font-black text-lg">বের হোন</span>
                  </button>
             </div>
          </div>
        ) : (
          <div 
            style={{ 
              transform: `scale(${settings.kbSize / 100})`, 
              backgroundImage: settings.theme === 'custom' && settings.customThemeImage ? `url(${settings.customThemeImage})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              height: `${(settings.heightPortrait / 100) * 340}px` 
            }}
            className={`glass-panel rounded-t-[3rem] p-6 pt-2 shadow-2xl ${activeTheme.bg} overflow-hidden relative flex flex-col animate-in slide-in-from-bottom duration-400`}
          >
              {settings.theme === 'custom' && settings.customThemeImage && (
                  <div className="absolute inset-0 bg-black pointer-events-none z-0" style={{ opacity: 1 - (settings.customThemeBrightness || 70) / 100 }}></div>
              )}
              
              {/* Toolbar with requested icons */}
              <div className="flex items-center h-14 px-2 relative z-10 overflow-x-auto no-scrollbar gap-1 border-b dark:border-white/10 mb-2">
                  <button onClick={() => setShowDashboard(true)} className="p-3 opacity-50 hover:opacity-100 flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1 flex-shrink-0"></div>
                  
                  <button onClick={() => setIsClipboardOpen(true)} className="p-3 opacity-60 flex-shrink-0" title="Clipboard">📋</button>
                  
                  <div className="flex gap-0.5 flex-shrink-0">
                    <button onClick={() => {setLayout(KeyboardLayout.BANGLA_AVRO); setIsNumericMode(false);}} className={`p-3 text-[14px] font-bold ${layout === KeyboardLayout.BANGLA_AVRO ? 'text-teal-500' : 'opacity-60'} font-bangla`}>অ</button>
                    <button onClick={() => {setLayout(KeyboardLayout.ARABIC); setIsNumericMode(false);}} className={`p-3 text-[14px] font-bold ${layout === KeyboardLayout.ARABIC ? 'text-teal-500' : 'opacity-60'} font-arabic`}>ع</button>
                    <button onClick={() => {setLayout(KeyboardLayout.ENGLISH); setIsNumericMode(false);}} className={`p-3 text-[14px] font-bold ${layout === KeyboardLayout.ENGLISH ? 'text-teal-500' : 'opacity-60'} font-inter`}>EN</button>
                  </div>

                  <button onClick={() => setIsNumericMode(!isNumericMode)} className={`p-3 text-[14px] font-black ${isNumericMode ? 'text-teal-500' : 'opacity-60'} flex-shrink-0`}>🔢</button>
                  
                  <button onClick={speakText} className="p-3 opacity-60 flex-shrink-0" title="Speak Sentence">🔊</button>
                  
                  <button onClick={() => hwInputRef.current?.click()} className="p-3 opacity-60 flex-shrink-0" title="Handwriting">✍️</button>
                  <input type="file" ref={hwInputRef} className="hidden" accept="image/*" onChange={handleHandwriting} />
                  
                  <button onClick={handleTranslate} className="p-3 opacity-60 flex-shrink-0" title="Translate">🌐</button>
                  
                  <div className="flex-1"></div>
                  <button onClick={() => setIsEmojiOpen(!isEmojiOpen)} className="p-3 opacity-50 flex-shrink-0"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button>
                  <button onClick={() => toggleVoiceInput()} className={`p-3 flex-shrink-0 ${isRecording ? 'text-red-500 animate-pulse' : 'opacity-50'}`}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg></button>
              </div>

              <div className="flex flex-col gap-1.5 relative z-10 flex-grow justify-end pb-4">
                  {currentRows.map((row, i) => (
                    <div key={i} className="flex justify-center gap-1.5">
                        {i === 3 && <button onMouseDown={(e) => { e.preventDefault(); setIsShifted(!isShifted); }} className={`h-11 w-14 rounded-2xl font-black text-[10px] flex items-center justify-center transition-all ${isShifted ? activeTheme.accent + ' ' + activeTheme.accentText : activeTheme.keyBg + ' ' + activeTheme.keyText + ' border-white/10'}`}>{isShifted ? '▲' : '△'}</button>}
                        {row.map((key) => (<button key={key} onMouseDown={(e) => { e.preventDefault(); insertChar(key); }} className={`h-11 ${!isNumericMode ? 'flex-1 min-w-0' : 'w-16'} rounded-2xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-lg active:scale-90 transition-all ${getScriptClass(layout)}`}>{getMappedChar(key)}</button>))}
                        {i === 2 && !isNumericMode && <button onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }} className={`h-11 w-14 rounded-2xl border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/10 flex items-center justify-center text-lg active:scale-95`}>⌫</button>}
                    </div>
                  ))}
                  <div className="flex justify-center gap-2 mt-1">
                      <button onClick={() => { setIsSymbolMode(!isSymbolMode); setIsNumericMode(false); }} className={`h-12 w-16 rounded-[1.5rem] border font-black text-xs ${activeTheme.keyBg} ${activeTheme.keyText} border-white/10`}>{isSymbolMode ? 'ABC' : '?123'}</button>
                      <button onPointerDown={(e) => { swipeStartX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId); }} onPointerUp={(e) => { if (swipeStartX.current !== null) { const diffX = e.clientX - swipeStartX.current; if (Math.abs(diffX) > 40) switchLayout(diffX > 0 ? 'prev' : 'next'); else insertChar(' '); swipeStartX.current = null; } }} className={`h-12 flex-[4] rounded-[1.5rem] border shadow-md font-black text-xs uppercase active:scale-[0.98] ${activeTheme.keyBg} ${activeTheme.keyText} border-white/10 ${layout !== KeyboardLayout.ENGLISH ? 'font-bangla' : ''}`}>{spacebarLabel}</button>
                      <button onMouseDown={(e) => { e.preventDefault(); insertChar('\n'); }} className={`h-12 w-24 rounded-[1.5rem] ${activeTheme.accent} ${activeTheme.accentText} text-xs font-black uppercase shadow-lg active:scale-95`}>ENTER</button>
                  </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
