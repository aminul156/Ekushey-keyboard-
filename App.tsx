
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

const DEFAULT_SETTINGS: ExtendedAppSettings = {
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
  enabledLayouts: [KeyboardLayout.ENGLISH, KeyboardLayout.BANGLA_AVRO, KeyboardLayout.ARABIC]
};

const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦵', '🦿', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁', '👅', '👄', '💋', '🩸', '💖', '✨', '🔥', '🌈', '🌍', '🚀', '⭐', '🎈', '🎉', '💻', '📱', '🎮', '🎧', '📸', '🎵', '⚽', '🍕', '☕', '🍦'
];

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
}

const App: React.FC = () => {
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
  const [isClipboardOpen, setIsClipboardOpen] = useState<boolean>(false);
  const [clipboardItems, setClipboardItems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Resize/Move interaction states
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
    if (!settings.showKeyBorder) {
        return { ...theme, keyBg: 'bg-transparent', border: 'border-transparent' };
    }
    return theme;
  }, [settings.theme, settings.showKeyBorder]);

  const spacebarLabel = useMemo(() => {
    switch (layout) {
      case KeyboardLayout.ENGLISH: return 'English';
      case KeyboardLayout.ARABIC: return 'العربية';
      case KeyboardLayout.ARABIC_PHONETIC: return 'عربي (صوتی)';
      case KeyboardLayout.BANGLA_AVRO: return 'অভ্র';
      case KeyboardLayout.BANGLA_JATIYO: return 'জাতীয়';
      case KeyboardLayout.BANGLA_UNIBIJOY: return 'ইউনিবিজয়';
      case KeyboardLayout.BANGLA_PROVHAT: return 'প্রভাত';
      default: return 'Space';
    }
  }, [layout]);

  const getScriptClass = useCallback((l: KeyboardLayout) => {
    if (l === KeyboardLayout.BANGLA_AVRO || l === KeyboardLayout.BANGLA_JATIYO || l === KeyboardLayout.BANGLA_UNIBIJOY || l === KeyboardLayout.BANGLA_PROVHAT) return 'font-bangla';
    if (l === KeyboardLayout.ARABIC || l === KeyboardLayout.ARABIC_PHONETIC) return 'font-arabic';
    return 'font-inter';
  }, []);

  useEffect(() => {
    if (layout === KeyboardLayout.ENGLISH) setNumericSubLang('en');
    else if (layout === KeyboardLayout.ARABIC || layout === KeyboardLayout.ARABIC_PHONETIC) setNumericSubLang('ar');
    else setNumericSubLang('bn');
  }, [layout]);

  const currentRows = useMemo(() => {
    if (isNumericMode) return NUMERIC_ROWS;
    if (isSymbolMode) return SYMBOLS_ROWS;
    const rows = [...KEYBOARD_ROWS];
    if (settings.enableNumberRow) rows.unshift(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    return rows;
  }, [isSymbolMode, isNumericMode, settings.enableNumberRow]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    if (activeTheme.isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings, activeTheme]);

  const resetAllSettings = () => {
    if (window.confirm("আপনি কি সব সেটিংস রিসেট করতে চান?")) {
        setSettings(DEFAULT_SETTINGS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    }
  };

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
    } catch (e) { console.error("TTS Error", e); }
    finally { setIsLoading(false); }
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

  const handleInteractionStart = (mode: 'height' | 'width' | 'move', e: React.PointerEvent) => {
    if (!settings.enableResizing) return;
    setResizeMode(mode);
    interactionRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startVal: mode === 'height' ? settings.heightPortrait : mode === 'width' ? settings.kbWidth : settings.posX,
        startVal2: mode === 'move' ? settings.posY : 0
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleInteractionMove = (e: React.PointerEvent) => {
    if (resizeMode === 'none') return;
    const diffX = e.clientX - interactionRef.current.startX;
    const diffY = interactionRef.current.startY - e.clientY;

    if (resizeMode === 'height') {
        const newVal = Math.max(50, Math.min(200, interactionRef.current.startVal + (diffY / 2)));
        setSettings(s => ({ ...s, heightPortrait: newVal }));
    } else if (resizeMode === 'width') {
        const newVal = Math.max(40, Math.min(100, interactionRef.current.startVal + (diffX / 5)));
        setSettings(s => ({ ...s, kbWidth: newVal }));
    } else if (resizeMode === 'move') {
        setSettings(s => ({ 
            ...s, 
            posX: interactionRef.current.startVal + diffX,
            posY: interactionRef.current.startVal2 - diffY 
        }));
    }
  };

  const handleInteractionEnd = () => setResizeMode('none');

  const renderSettingsPage = () => {
    const renderHeader = (title: string, backToMain = false) => (
      <header className="sticky top-0 z-10 bg-white dark:bg-slate-900 p-6 border-b dark:border-slate-800 flex items-center gap-4">
        <button onClick={() => {
            setSettingsSubPage(backToMain ? null : null);
            if (!backToMain) setIsSettingsOpen(false);
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

    const subPageTitle = {
        'preferences': 'পছন্দসমূহ',
        'appearance': 'আকার ও উচ্চতা',
        'themes': 'থিমসমূহ',
        'layout-management': 'ভাষা ও লে-আউট',
        'smart-typing': 'স্মার্ট টাইপিং',
        'advanced': 'অ্যাডভান্সড'
    }[settingsSubPage] || 'Settings';

    return (
      <div className="flex flex-col min-h-screen font-bangla">
        {renderHeader(subPageTitle, true)}
        <div className="p-6 space-y-4">
          {settingsSubPage === 'preferences' && (
            <div className="space-y-4">
              {toggle('অটো ক্যাপিটালাইজেশন', settings.autoCapitalization, (v) => setSettings({...settings, autoCapitalization: v}))}
              {toggle('ডাবল স্পেস পিরিয়ড (. )', settings.doubleSpacePeriod, (v) => setSettings({...settings, doubleSpacePeriod: v}))}
              {toggle('ভয়েস টাইপিং বাটন', settings.voiceInputKey, (v) => setSettings({...settings, voiceInputKey: v}))}
              {toggle('ভাইব্রেশন', settings.vibrateOnKeypress, (v) => setSettings({...settings, vibrateOnKeypress: v}))}
              {toggle('সাউন্ড', settings.soundOnKeypress, (v) => setSettings({...settings, soundOnKeypress: v}))}
            </div>
          )}

          {settingsSubPage === 'appearance' && (
            <div className="space-y-6">
              <div className="p-5 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-800/30 rounded-3xl">
                  <p className="text-sm text-teal-800 dark:text-teal-200 mb-4">কিবোর্ডের উপর সরাসরি টাচ করে আকার পরিবর্তন করতে "ইন্টারেক্টিভ রিসাইজিং" ব্যবহার করুন।</p>
                  {toggle('ইন্টারেক্টিভ রিসাইজিং', settings.enableResizing, (v) => setSettings({...settings, enableResizing: v}))}
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>স্বচ্ছতা (Transparency)</span><span>{settings.kbTransparency}%</span></div>
                <input type="range" min="30" max="100" value={settings.kbTransparency} onChange={(e) => setSettings({...settings, kbTransparency: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              <div className="space-y-4">
                <div className="flex justify-between font-bold"><span>কিবোর্ড প্রস্থ (Width)</span><span>{settings.kbWidth}%</span></div>
                <input type="range" min="40" max="100" value={settings.kbWidth} onChange={(e) => setSettings({...settings, kbWidth: parseInt(e.target.value)})} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600" />
              </div>
              {toggle('কী বর্ডার দেখান', settings.showKeyBorder, (v) => setSettings({...settings, showKeyBorder: v}))}
              {toggle('নাম্বার রো দেখান', settings.enableNumberRow, (v) => setSettings({...settings, enableNumberRow: v}))}
            </div>
          )}

          {settingsSubPage === 'themes' && (
            <div className="grid grid-cols-2 gap-4">
               {KEYBOARD_THEMES.map(t => (
                 <button key={t.id} onClick={() => setSettings({...settings, theme: t.id})} className={`p-4 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${settings.theme === t.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800'}`}>
                    <div className={`w-full h-20 rounded-2xl ${t.bg} border ${t.border || 'border-transparent'} relative shadow-sm overflow-hidden`}>
                       <div className="absolute top-2 left-2 flex gap-1">
                          <div className={`w-4 h-4 rounded-full ${t.keyBg}`}></div>
                          <div className={`w-4 h-4 rounded-full ${t.keyBg}`}></div>
                       </div>
                       <div className={`absolute bottom-2 right-2 w-8 h-4 rounded-full ${t.accent}`}></div>
                    </div>
                    <span className="text-sm font-bold">{t.name}</span>
                 </button>
               ))}
            </div>
          )}

          {settingsSubPage === 'layout-management' && (
            <div className="space-y-4">
               {[KeyboardLayout.ENGLISH, KeyboardLayout.BANGLA_AVRO, KeyboardLayout.BANGLA_JATIYO, KeyboardLayout.BANGLA_UNIBIJOY, KeyboardLayout.BANGLA_PROVHAT, KeyboardLayout.ARABIC].map(l => (
                  <div key={l} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                     <span className="font-bold">{l}</span>
                     <button onClick={() => {
                        const exists = settings.enabledLayouts.includes(l);
                        if (exists && settings.enabledLayouts.length > 1) {
                           setSettings({...settings, enabledLayouts: settings.enabledLayouts.filter(item => item !== l)});
                        } else if (!exists) {
                           setSettings({...settings, enabledLayouts: [...settings.enabledLayouts, l]});
                        }
                     }} className={`px-5 py-2 rounded-full font-bold text-xs transition-all ${settings.enabledLayouts.includes(l) ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                        {settings.enabledLayouts.includes(l) ? 'অ্যাক্টিভ' : 'চালু করুন'}
                     </button>
                  </div>
               ))}
            </div>
          )}

          {settingsSubPage === 'smart-typing' && (
            <div className="space-y-4">
               {toggle('AI স্মার্ট টাইপিং', settings.enableSmartTyping, (v) => setSettings({...settings, enableSmartTyping: v}))}
               {toggle('স্মার্ট গ্রামার চেক', settings.smartGrammar, (v) => setSettings({...settings, smartGrammar: v}))}
               {toggle('স্মার্ট কম্পোজ', settings.smartCompose, (v) => setSettings({...settings, smartCompose: v}))}
               {toggle('স্মার্ট ট্রান্সলেট', settings.smartTranslate, (v) => setSettings({...settings, smartTranslate: v}))}
            </div>
          )}

          {settingsSubPage === 'advanced' && (
            <div className="space-y-6">
               <button onClick={resetAllSettings} className="w-full p-6 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-3xl font-bold flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                  সেটিংস রিসেট করুন
               </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const keyboardStyles = useMemo(() => {
    return {
        width: `${settings.kbWidth}%`,
        transform: `translate(${settings.posX}px, ${settings.posY}px)`,
        height: `${(settings.heightPortrait / 100) * 320}px`,
        opacity: settings.kbTransparency / 100,
        transition: resizeMode !== 'none' ? 'none' : 'all 0.3s cubic-bezier(0.2, 0, 0, 1)'
    };
  }, [settings.kbWidth, settings.posX, settings.posY, settings.heightPortrait, settings.kbTransparency, resizeMode]);

  return (
    <div className={`min-h-screen transition-all duration-700 ${activeTheme.bg} ${activeTheme.isDark ? 'text-white' : 'text-slate-900'} flex flex-col items-center overflow-hidden relative`}>
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[1000] bg-white dark:bg-slate-900 overflow-y-auto">
          {renderSettingsPage()}
        </div>
      )}

      {isEmojiOpen && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setIsEmojiOpen(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-2/3 rounded-t-[3rem] p-8 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black font-bangla">ইমোজি</h3>
                <button onClick={() => setIsEmojiOpen(false)} className="p-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
             <div className="flex-1 overflow-y-auto grid grid-cols-6 gap-2">
                {COMMON_EMOJIS.map(e => <button key={e} onClick={() => insertChar(e)} className="text-3xl p-2 hover:bg-slate-100 rounded-xl">{e}</button>)}
             </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl h-full flex flex-col p-6 gap-6 z-10">
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
          <div 
            style={keyboardStyles}
            className={`glass-panel rounded-[2rem] p-4 shadow-2xl ${activeTheme.bg} relative flex flex-col animate-in slide-in-from-bottom duration-400 mx-auto touch-none border ${resizeMode !== 'none' ? 'border-teal-400 border-dashed scale-[1.02]' : 'border-transparent'}`}
          >
              {settings.enableResizing && (
                  <>
                      <div onPointerDown={e => handleInteractionStart('height', e)} onPointerMove={handleInteractionMove} onPointerUp={handleInteractionEnd} className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-6 cursor-ns-resize flex items-center justify-center group z-[100]">
                          <div className="w-12 h-1.5 bg-slate-300 group-hover:bg-teal-500 rounded-full transition-colors"></div>
                      </div>
                      <div onPointerDown={e => handleInteractionStart('width', e)} onPointerMove={handleInteractionMove} onPointerUp={handleInteractionEnd} className="absolute top-1/2 -right-1 -translate-y-1/2 w-6 h-20 cursor-ew-resize flex items-center justify-center group z-[100]">
                          <div className="w-1.5 h-12 bg-slate-300 group-hover:bg-teal-500 rounded-full transition-colors"></div>
                      </div>
                      <div onPointerDown={e => handleInteractionStart('move', e)} onPointerMove={handleInteractionMove} onPointerUp={handleInteractionEnd} className="absolute -top-10 left-1/2 -translate-x-1/2 w-10 h-10 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-200 dark:border-white/10 flex items-center justify-center cursor-move active:scale-110 transition-transform z-[100]">
                          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                      </div>
                  </>
              )}

              <div className="flex items-center h-12 px-2 gap-1 border-b dark:border-white/10 mb-2 no-scrollbar overflow-x-auto">
                  <button onClick={() => setShowDashboard(true)} className="p-2.5 opacity-60"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16"/></svg></button>
                  <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 opacity-60">⚙️</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className={`p-2.5 text-sm font-black ${isNumericMode ? 'text-teal-500' : 'opacity-60'}`}>🔢</button>
                  <button onClick={speakText} className="p-2.5 opacity-60">🔊</button>
                  <button onClick={() => setIsEmojiOpen(true)} className="p-2.5 opacity-60">😊</button>
                  {settings.voiceInputKey && (
                    <button onClick={toggleVoiceInput} className={`p-2.5 ${isRecording ? 'text-red-500 animate-pulse' : 'opacity-50'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                    </button>
                  )}
              </div>

              <div className="flex flex-col gap-1 flex-grow justify-end pb-2">
                  {currentRows.map((row, i) => (
                    <div key={i} className="flex justify-center gap-1">
                        {((settings.enableNumberRow && i === 3) || (!settings.enableNumberRow && i === 2)) && (
                           <button onMouseDown={e => {e.preventDefault(); setIsShifted(!isShifted)}} className={`h-10 w-12 rounded-xl font-black text-xs transition-all ${isShifted ? activeTheme.accent + ' ' + activeTheme.accentText : 'bg-white/10 ' + activeTheme.keyText}`}>{isShifted ? '▲' : '△'}</button>
                        )}
                        {row.map(key => (
                           <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-10 flex-1 rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-[15px] active:scale-95 transition-all ${getScriptClass(layout)}`}>{getMappedChar(key)}</button>
                        ))}
                        {((settings.enableNumberRow && i === 2) || (!settings.enableNumberRow && i === 1)) && !isNumericMode && (
                          <button onMouseDown={e => {e.preventDefault(); handleBackspace()}} className="h-10 w-12 rounded-xl bg-white/10 flex items-center justify-center opacity-70"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM19 15.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/></svg></button>
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
