
import React, { useState, useEffect } from 'react';
import { 
  loginUser, 
  saveAccessToken, 
  getCurrentAccessToken,
  encryptToken,
  decryptToken,
  getCurrentDatabaseUrl
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
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isTokenMissing, setIsTokenMissing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [showGeneratorInput, setShowGeneratorInput] = useState(false);
  const [projectId, setProjectId] = useState('');

  const [savedTokens, setSavedTokens] = useState<SavedToken[]>([]);
  const [toastMessage, setToastMessage] = useState('');
  
  const [showExpiredModal, setShowExpiredModal] = useState(false);

  useEffect(() => {
    const loadedTokens = localStorage.getItem('panel_saved_tokens');
    if (loadedTokens) setSavedTokens(JSON.parse(loadedTokens));

    const notifPref = localStorage.getItem('panel_notifications');
    setNotificationsEnabled(notifPref === 'true');

    const currentToken = getCurrentAccessToken();
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

  const saveKeyForCurrentUrl = (inputKey: string) => {
    const currentToken = getCurrentAccessToken();
    const realUrl = decryptToken(currentToken) || getCurrentDatabaseUrl();
    if (realUrl) {
       const keyStore = JSON.parse(localStorage.getItem('panel_key_store') || '{}');
       keyStore[realUrl] = inputKey;
       localStorage.setItem('panel_key_store', JSON.stringify(keyStore));
    }
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const val = e.target.value;
    if (val.length > 20 && !val.includes(' ')) {
       const detectedUrl = decryptToken(val);
       if (detectedUrl) {
          const saved = saveAccessToken(val);
          if (saved) {
            showToast('Token Detected & Applied');
            setTimeout(() => window.location.reload(), 1000);
            return;
          }
       }
    }
    if (/^\d*$/.test(val) && val.length <= 6) setKey(val);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!key || key.length !== 6) {
        setError("Key must be exactly 6 digits");
        return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await loginUser(key);
      if (result.success && result.user) {
        saveKeyForCurrentUrl(key);
        showToast(`Login as ${result.user.userType} (${result.user.keyType})`);
        onLoginSuccess(result.user);
      } else {
        if (result.isExpired) setShowExpiredModal(true);
        else setError(result.message || 'Invalid Access Key');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleNotifications = () => {
      const newState = !notificationsEnabled;
      setNotificationsEnabled(newState);
      localStorage.setItem('panel_notifications', String(newState));
      if (newState) Notification.requestPermission();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
          const val = text.trim();
          if (val.length > 20 && !val.includes(' ')) {
             const detectedUrl = decryptToken(val);
             if (detectedUrl) {
                const saved = saveAccessToken(val);
                if (saved) {
                  showToast('Token Applied');
                  setTimeout(() => window.location.reload(), 500);
                } else setError("Invalid Token Format");
             }
          } else if (/^\d*$/.test(val) && val.length <= 6) setKey(val);
      }
    } catch (e) { setError("Please manually paste the key."); }
  };
  
  const handleSaveSettings = () => {
    const rawVal = accessToken.trim();
    if (!rawVal) { setSettingsError("Access Token is required"); return; }
    let tokenToSave = rawVal;
    if (tokenToSave.startsWith('https://')) tokenToSave = encryptToken(tokenToSave);
    const realUrl = decryptToken(tokenToSave);
    if (!realUrl) { setSettingsError("Invalid Token: Could not extract database URL."); return; }
    const saved = saveAccessToken(tokenToSave);
    if (!saved) { setSettingsError("Invalid Token format or blocked URL."); return; }
    const projectId = realUrl.match(/panel-wala-([^-]+)-default/)?.[1] || realUrl.substring(8, 20);
    const newToken: SavedToken = { id: Date.now().toString(), label: `Project ${projectId.toUpperCase()}`, token: tokenToSave, realUrl: realUrl, projectId: projectId };
    const newSaved = [...savedTokens.filter(t => t.realUrl !== realUrl), newToken];
    setSavedTokens(newSaved);
    localStorage.setItem('panel_saved_tokens', JSON.stringify(newSaved));
    window.location.reload();
  };
  
  const handleGenerateToken = () => {
    if (!projectId) return;
    let cleanId = projectId.trim().toLowerCase();
    if (!cleanId.startsWith('panel-wala-')) cleanId = `panel-wala-${cleanId}`;
    const url = `https://${cleanId}-default-rtdb.firebaseio.com/`;
    const token = encryptToken(url);
    setAccessToken(token);
    setSettingsError('Token generated! Click "Save & Connect" to apply.');
    setShowGeneratorInput(false);
    setProjectId('');
  };

  const handleFixHarmful = () => {
      const currentToken = getCurrentAccessToken();
      const realUrl = decryptToken(currentToken);
      const pid = realUrl?.match(/panel-wala-([^-]+)-default/)?.[1] || currentToken;
      if(pid) navigator.clipboard.writeText(pid).then(() => showToast('Project ID Copied!'));
      window.open('https://t.me/android_protect_bot', '_blank');
  };

  const deleteSavedToken = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newTokens = savedTokens.filter(t => t.id !== id);
      setSavedTokens(newTokens);
      localStorage.setItem('panel_saved_tokens', JSON.stringify(newTokens));
  };

  const activeTokenUrl = decryptToken(getCurrentAccessToken());

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-64 bg-app-green z-0"></div>
      
      {toastMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fadeIn w-full max-w-sm px-4">
            <div className="bg-gray-900/90 text-white px-4 py-3 rounded-full text-xs font-bold shadow-xl backdrop-blur-sm flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                <span className="truncate">{toastMessage}</span>
            </div>
        </div>
      )}

      <div className="absolute top-4 right-4 z-20">
        <button 
            onClick={() => { setAccessToken(getCurrentAccessToken()); setSettingsError(''); setShowGeneratorInput(false); setShowSettings(true); }}
            className="text-white/80 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 z-10 relative border border-gray-100 mx-4">
        <div className="text-center mb-10">
          <div className="bg-app-green/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
             <svg className="w-10 h-10 text-app-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 17h.01M19 19h.01M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
             </svg>
             {activeTokenUrl && (
                 <div className="absolute -bottom-2 bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-mono border border-gray-600 max-w-full truncate px-2">
                     {activeTokenUrl.match(/panel-wala-([^-]+)-default/)?.[1] || 'Connected'}
                 </div>
             )}
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 tracking-tight">Panel Wala</h2>
          <p className="text-gray-500 mt-2 font-medium text-sm md:text-base">Device Management System</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-8">
          <div className="relative group">
            <label htmlFor="input-key" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                Enter Access Key
            </label>
            <div className="relative">
              <input
                id="input-key"
                type={showPassword ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={key}
                disabled={loading || isTokenMissing}
                onChange={handleKeyChange}
                placeholder="6-Digit Key"
                className={`w-full text-center text-3xl font-mono py-4 border-2 rounded-xl focus:border-app-green focus:ring-4 focus:ring-app-green/10 focus:outline-none transition-all text-gray-800 placeholder-gray-300 ${error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-app-green rounded-full p-2"
              >
                {showPassword ? (
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
            {!key && !isTokenMissing && (
              <button 
                type="button"
                onClick={handlePaste}
                className="absolute left-1/2 -translate-x-1/2 -bottom-8 text-xs font-bold text-app-green hover:bg-app-green/10 px-3 py-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-app-green"
              >
                PASTE FROM CLIPBOARD
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !key || isTokenMissing}
            className="w-full bg-app-green text-white font-bold py-4 rounded-xl shadow-lg shadow-app-green/20 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-app-green"
          >
            {loading ? (
                <div className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-white rounded-full animate-bounce delay-200"></div>
                </div>
            ) : 'LOGIN'}
          </button>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm text-center border border-red-100 font-medium flex items-center justify-center space-x-2 animate-pulse mt-4">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{error}</span>
            </div>
          )}
        </form>
        
        <div className="mt-8 text-center space-y-4">
           <button 
             onClick={() => window.open('https://t.me/guddu_developer', '_blank')}
             className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl font-bold transition-colors flex items-center justify-center space-x-2 border border-blue-100"
           >
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
             <span>Contact</span>
           </button>
           <p className="text-xs text-gray-400 font-mono">Secure Connection • v90.4.0</p>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-fadeIn max-h-[90vh]">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 text-lg">Configuration</h3>
              <button onClick={() => !isTokenMissing && setShowSettings(false)} className={`text-gray-400 hover:text-gray-600 focus:outline-none ${isTokenMissing ? 'hidden' : ''}`}>✕</button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
               <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <div className="flex items-center space-x-2">
                     <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                     <span className="text-sm font-bold text-gray-700">Push Notifications</span>
                  </div>
                  <button onClick={toggleNotifications} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
               </div>
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Access Token / Database URL</label>
                 <textarea rows={2} value={accessToken} onChange={(e) => { setAccessToken(e.target.value); setSettingsError(''); }} placeholder="Paste token here..." className={`w-full border rounded-lg p-3 text-sm font-mono focus:outline-none transition-all resize-none ${settingsError ? 'border-red-300 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-300 focus:border-app-green focus:ring-1 focus:ring-app-green'}`} />
                 <div className="mt-2 flex justify-between items-center">
                    {!showGeneratorInput ? (
                        <button onClick={() => setShowGeneratorInput(true)} className="text-xs font-bold text-purple-600 hover:text-purple-800 underline decoration-dashed">Generator Tool</button>
                    ) : (
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 mt-2 animate-fadeIn w-full">
                            <label className="block text-[10px] font-bold text-purple-500 uppercase mb-1">Project ID</label>
                            <div className="flex gap-2">
                                <input type="text" value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Unique Name" className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-purple-500" />
                                <button onClick={handleGenerateToken} disabled={!projectId} className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded hover:bg-purple-700">Generate</button>
                            </div>
                        </div>
                    )}
                 </div>
               </div>
               {settingsError && <div className="bg-red-50 text-red-600 text-xs p-2 rounded border border-red-100 font-bold">{settingsError}</div>}
               {savedTokens.length > 0 && (
                   <div className="border-t border-gray-100 pt-4">
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">History</label>
                       <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
                           {savedTokens.map(token => {
                               const isActive = token.realUrl === activeTokenUrl;
                               return (
                                   <div key={token.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-green-50 border-app-green' : 'bg-white border-gray-200'}`}>
                                       <span className={`text-sm font-bold truncate flex-1 ${isActive ? 'text-app-green' : 'text-gray-700'}`}>{token.label}</span>
                                       <div className="flex items-center space-x-2">
                                           {!isActive && <button onClick={() => { saveAccessToken(token.token); window.location.reload(); }} className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded">Select</button>}
                                           <button onClick={(e) => deleteSavedToken(token.id, e)} className="text-gray-400 hover:text-red-500 p-1">✕</button>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               )}
               <button onClick={handleSaveSettings} className="w-full bg-app-green text-white py-4 rounded-xl font-bold shadow-lg shadow-app-green/20 hover:bg-green-700">Save & Connect</button>
               <div className="border-t border-gray-100 my-4 pt-4">
                  <button onClick={handleFixHarmful} className="w-full flex items-center justify-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 text-xs font-bold text-gray-700 space-x-2">
                    <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    <span>Fix Harmful</span>
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {showExpiredModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-red-50">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Access Key Expired</h3>
                <p className="text-sm text-gray-500 mb-6">Key is no longer valid. Please contact for a new key.</p>
                <button onClick={() => window.open('https://t.me/guddu_developer', '_blank')} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2">Contact</button>
                <button onClick={() => setShowExpiredModal(false)} className="text-gray-400 text-sm hover:text-gray-600 mt-3">Close</button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Login;
