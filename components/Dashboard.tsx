
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DeviceInfo, SMS } from '../types';
import { fetchOlderSMS, deleteSMS, deleteAllSMS, fetchGlobalSMS, subscribeToSMS, deleteAllGlobalSMS, deleteBatchSMS, getSmsCount } from '../services/firebase';
import { detectBanks } from '../services/bankUtils';
import SmsModal from './SmsModal';
import BankChips from './BankChips';

interface SmsViewerProps {
  targetUser: DeviceInfo | null;
  onBack: () => void;
}

const SmsViewer: React.FC<SmsViewerProps> = ({ targetUser, onBack }) => {
  const [smsList, setSmsList] = useState<SMS[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [visibleCount, setVisibleCount] = useState(50);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [selectedSms, setSelectedSms] = useState<SMS | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  
  const [autoDeleteSms, setAutoDeleteSms] = useState<SMS[]>([]);
  const [showSmsCleanupModal, setShowSmsCleanupModal] = useState(false);
  const hasCheckedSmsCleanup = useRef(false);
  const [dontShowSmsCleanup, setDontShowSmsCleanup] = useState(false);
  
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isGlobal = !targetUser;

  const checkForOldMessages = (messages: SMS[]) => {
      if (hasCheckedSmsCleanup.current) return;
      
      const suppressedUntil = localStorage.getItem('suppress_sms_cleanup_until');
      if (suppressedUntil && Date.now() < parseInt(suppressedUntil)) return;

      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const candidates = messages.filter(m => {
          if (!m.timestamp) return false;
          return (now - m.timestamp > oneHour);
      });
      
      if (candidates.length > 0) {
          setAutoDeleteSms(candidates);
          setShowSmsCleanupModal(true);
      }
      hasCheckedSmsCleanup.current = true;
  };

  useEffect(() => {
    // Fetch initial total count
    const fetchCount = async () => {
       const count = await getSmsCount(targetUser?.userId);
       setTotalCount(count);
    };
    fetchCount();

    if (!isGlobal && targetUser) {
      setLoading(true);
      const unsubscribe = subscribeToSMS(targetUser.userId, (realtimeMessages) => {
         setSmsList(currentList => {
             const newKeys = new Set(realtimeMessages.map(m => m.key));
             const keptOld = currentList.filter(m => !newKeys.has(m.key));
             const combined = [...realtimeMessages, ...keptOld].sort((a,b) => b.timestamp - a.timestamp);
             
             if (!hasCheckedSmsCleanup.current && realtimeMessages.length > 0) checkForOldMessages(realtimeMessages);
             
             // Initial load: if we got less than 50, there's no more to load
             if (combined.length >= totalCount && totalCount > 0) setHasMore(false);
             else setHasMore(true);

             return combined;
         });
         setLoading(false);
      });
      return () => unsubscribe();
    } else if (isGlobal) {
       loadSMS(true);
    }
  }, [targetUser, isGlobal]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const loadSMS = async (isInitial: boolean) => {
    if (!isGlobal) return;
    setLoading(true);
    try {
      if (isInitial) {
           const all = await fetchGlobalSMS();
           setSmsList(all);
           if (!hasCheckedSmsCleanup.current) checkForOldMessages(all);
           if (all.length <= visibleCount) setHasMore(false);
      } else {
           setVisibleCount(prev => prev + 50);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const loadMoreOlder = async () => {
      if (isGlobal || !targetUser || loading || !hasMore || smsList.length === 0) return;
      setLoading(true);
      try {
          const lastTimestamp = smsList[smsList.length - 1].timestamp;
          const older = await fetchOlderSMS(targetUser.userId, lastTimestamp);
          
          if (older.length < 50) setHasMore(false);

          setSmsList(prev => {
              const existingKeys = new Set(prev.map(p => p.key));
              const uniqueOlder = older.filter(o => !existingKeys.has(o.key));
              const combined = [...prev, ...uniqueOlder];
              if (combined.length >= totalCount) setHasMore(false);
              return combined;
          });
      } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  
  const handleAutoDeleteSms = async () => {
      if (dontShowSmsCleanup) {
         // Suppress for 72 hours
         const expiry = Date.now() + (72 * 60 * 60 * 1000);
         localStorage.setItem('suppress_sms_cleanup_until', expiry.toString());
      }

      if (autoDeleteSms.length === 0) {
        setShowSmsCleanupModal(false);
        return;
      }
      setDeleting(true);
      try {
          await deleteBatchSMS(autoDeleteSms);
          const deletedKeys = new Set(autoDeleteSms.map(s => s.key));
          setSmsList(prev => prev.filter(s => !deletedKeys.has(s.key)));
          setTotalCount(prev => Math.max(0, prev - autoDeleteSms.length));
          setShowSmsCleanupModal(false);
      } catch (e) { alert("Failed to delete old messages."); } finally { setDeleting(false); }
  };

  const handleDelete = (sms: SMS, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmation({
      isOpen: true,
      title: 'Delete Message',
      message: 'Are you sure you want to delete this message?',
      onConfirm: async () => {
        try {
          await deleteSMS(sms.userId, sms.key);
          setSmsList(prev => prev.filter(item => item.key !== sms.key));
          setTotalCount(prev => Math.max(0, prev - 1));
        } catch (err) { alert("Failed to delete"); }
        setConfirmation(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteAll = () => {
    const isGlobalMode = isGlobal;
    const msg = isGlobalMode 
       ? "This will delete ALL SMS messages for ALL users. Irreversible!" 
       : `This will delete ALL SMS for user: ${targetUser?.Brand}.`;

    setConfirmation({
      isOpen: true,
      title: 'Delete All Messages',
      message: msg,
      onConfirm: async () => {
         setDeleting(true);
         try {
            if (isGlobalMode) await deleteAllGlobalSMS();
            else if (targetUser) await deleteAllSMS(targetUser.userId);
            setSmsList([]);
            setTotalCount(0);
         } catch (err) { alert("Failed to delete."); } 
         finally {
           setDeleting(false);
           setConfirmation(prev => ({ ...prev, isOpen: false }));
         }
      }
    });
  };

  const filteredList = useMemo(() => {
    let result = smsList;
    if (debouncedSearch) {
      const lowerQ = debouncedSearch.toLowerCase();
      result = result.filter(sms => 
        sms.body.toLowerCase().includes(lowerQ) || 
        sms.sender.toLowerCase().includes(lowerQ)
      );
    }
    if (selectedBank) {
      result = result.filter(sms => detectBanks(sms.sender + " " + sms.body).includes(selectedBank));
    }
    return result;
  }, [smsList, debouncedSearch, selectedBank]);

  const displayedList = isGlobal ? filteredList.slice(0, visibleCount) : filteredList;

  // Update hasMore for global search view
  useEffect(() => {
      if (isGlobal && filteredList.length <= visibleCount) setHasMore(false);
      else if (isGlobal) setHasMore(true);
  }, [isGlobal, filteredList.length, visibleCount]);

  const bankStats = useMemo(() => {
    const stats = new Map<string, number>();
    smsList.forEach(sms => {
      detectBanks(sms.sender + " " + sms.body).forEach(bank => stats.set(bank, (stats.get(bank) || 0) + 1));
    });
    return Array.from(stats.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
  }, [smsList]);

  useEffect(() => {
    if (loading || !hasMore) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (isGlobal) setVisibleCount(c => c + 50);
        else loadMoreOlder();
      }
    });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loading, isGlobal, smsList, hasMore]);

  const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
    if (!highlight) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? <span key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{part}</span> : <span key={i}>{part}</span>)}</span>
    );
  };

  const copyId = (id: string) => navigator.clipboard.writeText(id);

  return (
    <div className="flex flex-col h-screen bg-app-bg">
      <header className="bg-white border-b border-gray-200 shadow-sm z-30 px-4 py-3 flex items-center justify-between sticky top-0">
          <div className="flex items-center space-x-3 overflow-hidden">
             <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-300" aria-label="Go Back">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                   <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">{isGlobal ? "Global Messages" : targetUser?.Brand}</h1>
                   <span className="bg-app-green/10 text-app-green text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {totalCount.toLocaleString()} TOTAL
                   </span>
                </div>
                <div className="flex items-center space-x-1">
                  <p className="text-xs text-gray-500 truncate">{isGlobal ? "All Users" : `${targetUser?.Status} • ${targetUser?.DeviceId}`}</p>
                  {!isGlobal && targetUser?.DeviceId && (
                      <button onClick={()=>copyId(targetUser.DeviceId)} className="text-gray-400 hover:text-gray-600 focus:outline-none focus:underline">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                  )}
                </div>
             </div>
          </div>
          
          <button 
            onClick={handleDeleteAll} 
            disabled={deleting || smsList.length === 0} 
            className="p-3 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Delete All"
            aria-label="Delete All Messages"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
      </header>
      
      <div className="bg-white px-4 py-2 border-b border-gray-100">
         <div className="relative">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
             <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           </div>
           <input
            type="text"
            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg leading-5 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-app-green focus:border-app-green sm:text-sm transition-all"
            placeholder="Search in conversation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search Messages"
           />
         </div>
      </div>

      <BankChips stats={bankStats} selectedBank={selectedBank} onSelectBank={setSelectedBank} />

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3" id="sms-container">
        {displayedList.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
             <p className="font-medium">No messages found</p>
          </div>
        )}

        {displayedList.map((sms) => (
          <button 
            key={sms.key + sms.userId} 
            className="w-full text-left bg-white rounded-lg shadow-sm p-3 sm:p-4 relative cursor-pointer hover:shadow-md transition-all border border-transparent hover:border-gray-200 group active:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-app-green"
            onClick={() => setSelectedSms(sms)}
          >
             <div 
               onClick={(e) => handleDelete(sms, e)} 
               className="absolute top-1 right-1 p-3 text-gray-300 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 focus:outline-none"
               role="button"
               aria-label="Delete Message"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </div>

             <div className="flex justify-between items-baseline mb-1 pr-8">
                <h3 className="font-bold text-gray-800 text-sm truncate max-w-[70%]">
                  <HighlightedText text={sms.sender} highlight={debouncedSearch} />
                </h3>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                   {new Date(sms.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
             </div>
             
             {isGlobal && (
               <div className="mb-1">
                 <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">User: {sms.userId.substring(0,8)}</span>
               </div>
             )}

             <p className="text-gray-600 text-xs sm:text-sm line-clamp-3 leading-relaxed">
               <HighlightedText text={sms.body} highlight={debouncedSearch} />
             </p>

             <div className="flex flex-wrap gap-1 mt-2">
                {detectBanks(sms.sender + " " + sms.body).map(b => (
                  <span key={b} className="text-[9px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">{b}</span>
                ))}
             </div>
          </button>
        ))}
        
        {/* Progress Bar (Spinner) - Only show if hasMore is true */}
        <div ref={loadMoreRef} className="h-12 flex justify-center items-center">
           {(loading && hasMore) && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-app-green"></div>}
           {!hasMore && displayedList.length > 0 && (
             <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">End of data</p>
           )}
        </div>
      </div>

      <SmsModal sms={selectedSms} onClose={() => setSelectedSms(null)} />

      {confirmation.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmation.title}</h3>
            <p className="text-gray-600 mb-6 text-sm">{confirmation.message}</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setConfirmation({ ...confirmation, isOpen: false })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">Cancel</button>
              <button onClick={confirmation.onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showSmsCleanupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
             <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </div>
             <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Clean Old Messages</h3>
             <p className="text-sm text-gray-500 text-center mb-6">Found <span className="font-bold text-gray-800">{autoDeleteSms.length}</span> messages older than 1 hour.</p>
             
             <div className="flex items-center justify-center mb-4">
               <label className="flex items-center space-x-2 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={dontShowSmsCleanup} 
                   onChange={(e) => setDontShowSmsCleanup(e.target.checked)}
                   className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                 />
                 <span className="text-sm text-gray-600">Don't show again for 72h</span>
               </label>
             </div>

             <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    if (dontShowSmsCleanup) {
                        const expiry = Date.now() + (72 * 60 * 60 * 1000);
                        localStorage.setItem('suppress_sms_cleanup_until', expiry.toString());
                    }
                    setShowSmsCleanupModal(false);
                  }} 
                  className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  Keep
                </button>
                <button onClick={handleAutoDeleteSms} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">Clean Now</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsViewer;
