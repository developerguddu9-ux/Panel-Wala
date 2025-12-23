import React, { useState, useEffect } from 'react';
import { 
  loginUser, 
  saveAccessToken, 
  getCurrentAccessToken,
  encryptToken,
  decryptToken,
  getKeyExpiry
} from '../services/firebase';
import { User } from '../types';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

interface SavedToken {
  id: string;
  label: string;
  token: string;
  realUrl: string;
  projectId: string;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [key, setKey] = useState('');
  const [expiryText, setExpiryText] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isTokenMissing, setIsTokenMissing] = useState(false);

  const [showGeneratorInput, setShowGeneratorInput] = useState(false);
  const [projectId, setProjectId] = useState('');

  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const loadedTokens = localStorage.getItem('panel_saved_tokens');
    if (loadedTokens) setSavedTokens(JSON.parse(loadedTokens));

    const currentToken = getCurrentAccessToken();
    if (currentToken) setAccessToken(currentToken); // Persistent token in UI

    const realUrl = decryptToken(currentToken);
    if (!realUrl) {
        setIsTokenMissing(true);
        setShowSettings(true);
        setSettingsError("Configuration Required: Please enter a Token.");
    } else {
         const keyStore = JSON.parse(localStorage.getItem('panel_key_store') || '{}');
         const lastKey = keyStore[realUrl];
         if (lastKey) setKey(lastKey);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const checkExpiry = async (val: string) => {
      if (val.length === 6) {
          try {
              const result = await getKeyExpiry(val);
              if (result.success) {
                  if (result.isBlocked) setError("Key Blocked");
                  else if (result.expiry === 'never') setExpiryText("Expiry: Lifetime Access");
                  else if (result.expiry) {
                      const d = new Date(result.expiry);
                      setExpiryText(`Expiry: ${isNaN(d.getTime()) ? result.expiry : d.toLocaleDateString()}`);
                  }
              } else {
                  setError("Key not found");
              }
          } catch (e) {
              setError("Connection Error");
          }
      } else {
          setExpiryText('');
          setError('');
      }
  };

  const handleKeyChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length > 20 && !val.includes(' ')) {
       const detectedUrl = decryptToken(val);
       if (detectedUrl) {
          saveAccessToken(val);
          showToast('Token Detected & Applied');
          setTimeout(() => window.location.reload(), 500);
          return;
       }
    }
    if (/^\d*$/.test(val) && val.length <= 6) {
        setKey(val);
        checkExpiry(val);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Check if token is configured
    const currentToken = getCurrentAccessToken();
    if (!currentToken || !decryptToken(currentToken)) {
        setSettingsError("TOKEN NOT CONFIGURED!");
        setShowSettings(true);
        return;
    }

    if (key.length !== 6) return setError("Enter 6 digits");
    setLoading(true);
    setError('');
    try {
      const result = await loginUser(key);
      if (result.success && result.user) {
        const url = decryptToken(getCurrentAccessToken());
        if (url) {
            const keyStore = JSON.parse(localStorage.getItem('panel_key_store') || '{}');
            keyStore[url] = key;
            localStorage.setItem('panel_key_store', JSON.stringify(keyStore));
        }
        onLoginSuccess(result.user);
      } else {
        setError(result.message || 'Invalid Access Key');
      }
    } catch (err: any) {
      setError("Login failed: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = () => {
    const rawVal = accessToken.trim();
    if (!rawVal) return setSettingsError("Required");
    
    if (rawVal.startsWith('https://')) {
        return setSettingsError("Enter TOKEN string only, not URL");
    }

    const realUrl = decryptToken(rawVal);
    if (!realUrl) return setSettingsError("Invalid Token Format");
    
    saveAccessToken(rawVal);
    const pId = realUrl.match(/panel-wala-([^-]+)-default/)?.[1] || realUrl.substring(8, 20);
    const newToken = { id: Date.now().toString(), label: pId.toUpperCase(), token: rawVal, realUrl, projectId: pId };
    const newSaved = [newToken, ...savedTokens.filter(t => t.realUrl !== realUrl)].slice(0, 8);
    setSavedTokens(newSaved);
    localStorage.setItem('panel_saved_tokens', JSON.stringify(newSaved));
    
    showToast("Instance Updated");
    setTimeout(() => window.location.reload(), 500);
  };
  
  const handleGenerateToken = () => {
    if (!projectId) return;
    const cleanId = projectId.trim().toLowerCase().replace('panel-wala-', '');
    const url = `https://panel-wala-${cleanId}-default-rtdb.firebaseio.com/`;
    const newToken = encryptToken(url);
    
    // 1. Update State
    setAccessToken(newToken);
    
    // 2. Save to Storage IMMEDIATELY
    saveAccessToken(newToken);
    
    // 3. Update History
    const pId = cleanId.toUpperCase();
    const historyEntry = { id: Date.now().toString(), label: pId, token: newToken, realUrl: url, projectId: cleanId };
    const newSaved = [historyEntry, ...savedTokens.filter(t => t.realUrl !== url)].slice(0, 8);
    localStorage.setItem('panel_saved_tokens', JSON.stringify(newSaved));
    
    showToast(`Token for ${pId} Generated!`);
    // 4. Reload to initialize new Firebase instance
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0f2f5] relative overflow-hidden px-4">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-app-green to-[#00a884e0] z-0"></div>
      
      {toastMessage && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] animate-fadeIn bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center border border-white/10">
          <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {toastMessage}
        </div>
      )}

      <div className="w-full max-w-[420px] bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-10 z-10 relative border border-white/20">
        <div className="text-center mb-8">
          <div className="bg-app-green/10 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 transition-transform duration-300">
             <svg className="w-12 h-12 text-app-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Panel Wala</h2>
          <p className="text-gray-400 mt-2 font-bold text-xs uppercase tracking-widest">Premium Standalone Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              inputMode="numeric"
              maxLength={6}
              value={key}
              disabled={loading}
              onChange={handleKeyChange}
              placeholder="••••••"
              className={`w-full text-center text-4xl font-mono py-6 border-2 rounded-[1.5rem] focus:border-app-green focus:ring-8 focus:ring-app-green/5 outline-none transition-all placeholder-gray-200 tracking-[0.2em] ${error ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-gray-50/50'}`}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 p-2">
              {showPassword ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>}
            </button>
          </div>

          {expiryText && !error && <div className="bg-app-green/5 text-app-green font-bold text-[10px] py-2 px-4 rounded-full text-center uppercase tracking-widest animate-fadeIn border border-app-green/10">{expiryText}</div>}
          {error && <p className="text-red-500 text-[11px] font-black text-center animate-pulse uppercase tracking-tight bg-red-50 py-2 rounded-full border border-red-100">{error}</p>}

          <button type="submit" disabled={loading || key.length !== 6} className="w-full bg-app-green text-white font-black py-5 rounded-[1.5rem] shadow-xl hover:bg-app-green-dark active:scale-[0.98] transition-all disabled:opacity-50 uppercase tracking-widest">
            {loading ? 'CONNECTING...' : 'LOGIN'}
          </button>
        </form>
        
        <div className="mt-10 flex justify-between items-center border-t border-gray-100 pt-8">
           <button onClick={() => setShowSettings(true)} className="px-5 py-2.5 bg-purple-50 text-purple-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-purple-100 transition-colors">
              Instance
           </button>
           <button onClick={() => window.open('https://t.me/guddu_developer')} className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-colors">
              Support
           </button>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-gray-100">
            <div className="bg-gray-50/80 px-8 py-6 flex justify-between items-center">
              <h3 className="font-black text-gray-900 text-xl tracking-tight">Configuration</h3>
              <button onClick={() => !isTokenMissing && setShowSettings(false)} className={`text-gray-400 p-2 hover:bg-gray-100 rounded-full ${isTokenMissing ? 'hidden' : ''}`}>✕</button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto scrollbar-hide">
               <div className="space-y-4">
                 <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Connect Token</label>
                 <textarea 
                    rows={3} 
                    value={accessToken} 
                    onChange={(e) => setAccessToken(e.target.value)} 
                    placeholder="ENTER ACCESS TOKEN" 
                    className="w-full border-2 border-gray-100 rounded-2xl p-5 text-sm font-mono focus:border-app-green outline-none transition-all resize-none bg-gray-50" 
                 />
                 {!showGeneratorInput ? <button onClick={() => setShowGeneratorInput(true)} className="text-[11px] font-black text-app-green uppercase tracking-widest">+ Generator</button> : (
                    <div className="bg-app-green/5 p-5 rounded-2xl border border-app-green/10">
                        <label className="block text-[10px] font-black text-app-green uppercase mb-3">Project ID</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={projectId} 
                                onChange={(e) => setProjectId(e.target.value)} 
                                placeholder="Enter Unique Number e.g v107" 
                                className="flex-1 text-sm border-2 border-app-green/10 rounded-xl px-4 py-3 outline-none" 
                            />
                            <button onClick={handleGenerateToken} className="bg-app-green text-white text-[10px] font-black px-6 rounded-xl hover:bg-app-green-dark transition-colors">GENERATE</button>
                        </div>
                    </div>
                 )}
               </div>
               {settingsError && <div className="text-[11px] font-bold text-blue-600 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-pulse uppercase tracking-tight">{settingsError}</div>}
               {savedTokens.length > 0 && (
                   <div className="space-y-4">
                       <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Saved History</label>
                       <div className="space-y-2">
                           {savedTokens.map(token => (
                               <div key={token.id} className="flex items-center justify-between p-4 rounded-2xl border border-gray-50 bg-gray-50/30 hover:bg-white hover:border-app-green/20 transition-all">
                                   <div className="min-w-0 pr-4">
                                       <span className="text-sm font-black text-gray-900 block truncate uppercase">{token.label}</span>
                                       <span className="text-[10px] font-mono text-gray-400 block truncate">{token.token.substring(0, 16)}...</span>
                                   </div>
                                   <button onClick={() => { saveAccessToken(token.token); window.location.reload(); }} className="text-[10px] font-black text-app-green border border-app-green/20 px-4 py-2 rounded-xl hover:bg-app-green hover:text-white transition-all">CONNECT</button>
                               </div>
                           ))}
                       </div>
                   </div>
               )}
               <button onClick={handleSaveSettings} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-black transition-all">SAVE & RELOAD</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;