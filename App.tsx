
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { KeyboardLayout, AppSettings, ThemeConfig, KeyboardMode } from './types';
import { KEYBOARD_ROWS, SYMBOLS_ROWS, ARABIC_MAP, ARABIC_PHONETIC_MAP, JATIYO_MAP, UNIBIJOY_MAP, PHONETIC_MAP, PHONETIC_VOWEL_FULL, NUMERIC_ROWS, NUMERALS, PROVHAT_MAP } from './constants/layouts';
import { KEYBOARD_THEMES } from './constants/themes';

const STORAGE_KEY = 'ekushey_kb_v3_settings';

const ALL_LAYOUTS = [
  KeyboardLayout.BANGLA_AVRO, 
  KeyboardLayout.ENGLISH, 
  KeyboardLayout.BANGLA_JATIYO, 
  KeyboardLayout.BANGLA_UNIBIJOY,
  KeyboardLayout.BANGLA_PROVHAT,
  KeyboardLayout.ARABIC
];

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
  enableBanglaInNumberPad: true,
  oldStyleReph: false,
  autoVowelForming: true,
  enabledLayouts: ALL_LAYOUTS
};

interface ExtendedAppSettings extends AppSettings {
  enabledLayouts: KeyboardLayout[];
}

type SettingsView = 'main' | 'appearance' | 'preference' | 'layout' | 'mode' | 'smart' | 'advance';

const App: React.FC = () => {
  const [setupStep, setSetupStep] = useState<number>(1);
  const [showDashboard, setShowDashboard] = useState<boolean>(true);
  const [text, setText] = useState<string>('');
  const [layout, setLayout] = useState<KeyboardLayout>(KeyboardLayout.BANGLA_AVRO);
  const [isShifted, setIsShifted] = useState<boolean>(false);
  const [isCapsLock, setIsCapsLock] = useState<boolean>(false);
  const [isNumericMode, setIsNumericMode] = useState<boolean>(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsView, setSettingsView] = useState<SettingsView>('main');
  
  const phoneticBuffer = useRef<string>('');
  const lastInsertedLen = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Refined Swipe Logic Refs
  const spaceRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);
  const hasMovedSignificant = useRef<boolean>(false);

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
    if (navigator.vibrate) navigator.vibrate(25);
  }, [layout, settings.enabledLayouts]);

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

  const insertChar = (char: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    let currentText = text.substring(0, start) + text.substring(end);
    let insertionIndex = start;

    if (layout === KeyboardLayout.BANGLA_AVRO && !isNumericMode && char.match(/[a-zA-Z\^`':]/)) {
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

    const charToInsert = getMappedChar(char);
    updateTextAndCursor(currentText.substring(0, insertionIndex) + charToInsert + currentText.substring(insertionIndex), insertionIndex + charToInsert.length);
    phoneticBuffer.current = ''; lastInsertedLen.current = 0;
  };

  // --- NATIVE SWIPE LOGIC ATTACHMENT ---
  useEffect(() => {
    const el = spaceRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      hasMovedSignificant.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const currentX = e.touches[0].clientX;
      const diffX = Math.abs(currentX - touchStartX.current);
      
      if (diffX > 10) {
        hasMovedSignificant.current = true;
        // CRITICAL: Block browser swipe-to-back behavior
        if (e.cancelable) e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diffX = touchEndX - touchStartX.current;
      const swipeThreshold = 50;

      if (Math.abs(diffX) > swipeThreshold) {
        cycleLayout(diffX > 0 ? 'prev' : 'next');
      } else if (!hasMovedSignificant.current) {
        insertChar(' ');
      }

      touchStartX.current = null;
      hasMovedSignificant.current = false;
    };

    // Attach native listeners with passive: false to allow preventDefault()
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [cycleLayout, insertChar]);

  const renderSetupWizard = () => {
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

        <div className="max-w-xl mx-auto w-full space-y-4">
          {settingsView === 'main' && (
            <div className="grid gap-3">
              <button onClick={() => setSettingsView('appearance')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">🎨</span><span className="font-black">চেহারা ও থিম</span></div>
                <span>➔</span>
              </button>
              <button onClick={() => setSettingsView('advance')} className="w-full flex items-center justify-between p-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm">
                <div className="flex items-center gap-4"><span className="text-2xl">🛠️</span><span className="font-black">অ্যাডভান্সড (অভ্র)</span></div>
                <span>➔</span>
              </button>
            </div>
          )}

          {settingsView === 'appearance' && (
            <div className="space-y-4">
               <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl">
                 <label className="font-black text-xs text-slate-400 block mb-4">থিম নির্বাচন করুন</label>
                 <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                   {KEYBOARD_THEMES.map(t => (
                     <button key={t.id} onClick={() => setSettings({...settings, theme: t.id})} className={`p-3 rounded-2xl border-2 ${settings.theme === t.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-slate-100 dark:border-white/5'}`}>
                       <div className="flex gap-1 mb-2">
                         <div className={`w-4 h-4 rounded-full ${t.bg}`}></div>
                         <div className={`w-4 h-4 rounded-full ${t.keyBg}`}></div>
                       </div>
                       <span className="text-[10px] font-black uppercase truncate">{t.name}</span>
                     </button>
                   ))}
                 </div>
               </div>
               <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl">
                 <label className="font-black text-xs text-slate-400 block mb-4">ফন্ট সাইজ ({settings.fontSize}px)</label>
                 <input type="range" min="12" max="32" value={settings.fontSize} onChange={e => setSettings({...settings, fontSize: parseInt(e.target.value)})} className="w-full accent-teal-500" />
               </div>
               <Toggle label="কী-বর্ডার দেখান" value={settings.showKeyBorder} onChange={v => setSettings({...settings, showKeyBorder: v})} />
            </div>
          )}

          {settingsView === 'advance' && (
            <div className="space-y-3">
               <div className="p-5 bg-teal-50 rounded-3xl space-y-3 border border-teal-100">
                  <h3 className="font-black text-teal-600 text-[10px] uppercase mb-4">অভ্র সেটিংস</h3>
                  <Toggle label="পুরাতন নিয়মে রেফ" value={settings.oldStyleReph} onChange={v => setSettings({...settings, oldStyleReph: v})} />
                  <Toggle label="স্বয়ংক্রিয় স্বরবর্ণ গঠন" value={settings.autoVowelForming} onChange={v => setSettings({...settings, autoVowelForming: v})} />
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!settings.isSetupComplete) return renderSetupWizard();

  const isRTL = layout === KeyboardLayout.ARABIC;

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
          <div className={`rounded-[2rem] p-4 shadow-2xl ${activeTheme.bg} animate-in slide-in-from-bottom w-full`}>
              <div className={`flex items-center h-12 px-2 gap-2 border-b ${activeTheme.isDark ? 'border-white/10' : 'border-black/5'} mb-2`}>
                  <button onClick={() => setShowDashboard(true)} className="p-2 opacity-60 text-white">🏠</button>
                  <button onClick={() => setIsNumericMode(!isNumericMode)} className="p-2 font-black opacity-60 text-white">123</button>
                  <button onClick={() => cycleLayout('next')} className="p-2 opacity-60 text-white">🌐</button>
                  <button onClick={() => { setSettingsView('main'); setIsSettingsOpen(true); }} className="p-2 opacity-60 ml-auto text-white">⚙️</button>
              </div>
              <div className="flex flex-col gap-1.5 pb-2">
                  {(isNumericMode ? NUMERIC_ROWS : KEYBOARD_ROWS).map((row, i) => (
                    <div key={i} className="flex justify-center gap-1">
                        {row.map(key => (
                           <button key={key} onMouseDown={e => {e.preventDefault(); insertChar(key)}} className={`h-11 flex-1 rounded-xl shadow-sm border ${activeTheme.keyBg} ${activeTheme.keyText} border-white/5 text-lg active:scale-95 font-medium`}>{getMappedChar(key)}</button>
                        ))}
                    </div>
                  ))}
                  <div className="flex justify-center gap-1 mt-1">
                      <button 
                        ref={spaceRef}
                        className={`h-16 flex-[4] rounded-xl bg-white/10 text-lg font-bold uppercase text-white transition-all active:bg-white/20 select-none overflow-hidden touch-none relative`}
                        style={{ touchAction: 'none' }}
                      >
                        <div key={layout} className="absolute inset-0 flex items-center justify-center animate-in fade-in slide-in-from-left-4 duration-300 pointer-events-none">
                           {layout === KeyboardLayout.BANGLA_AVRO ? 'অভ্র' : 
                            layout === KeyboardLayout.BANGLA_JATIYO ? 'জাতীয়' : 
                            layout === KeyboardLayout.BANGLA_UNIBIJOY ? 'ইউনিবিজয়' :
                            layout === KeyboardLayout.ARABIC ? 'العربية' : 
                            layout === KeyboardLayout.BANGLA_PROVHAT ? 'প্রভাত' : layout}
                        </div>
                        <div className="absolute bottom-2 w-full flex justify-center gap-1.5 opacity-30 pointer-events-none">
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        </div>
                      </button>
                      <button onMouseDown={e => {e.preventDefault(); const s = textareaRef.current?.selectionStart || 0; updateTextAndCursor(text.substring(0, s-1) + text.substring(s), s-1)}} className={`h-16 w-16 rounded-xl bg-white/10 flex items-center justify-center text-white`}>⌫</button>
                  </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
