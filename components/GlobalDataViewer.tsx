
import React, { useEffect, useState, useMemo } from 'react';
import { subscribeToGlobalData, deleteAllGlobalData } from '../services/firebase';

interface Props {
  onBack: () => void;
}

const ProfessionalJsonViewer: React.FC<{ data: any, title: string, colorClass: string }> = ({ data, title, colorClass }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasData = data && (typeof data === 'object' ? Object.keys(data).length > 0 : !!data);
  const isObj = typeof data === 'object' && data !== null && !Array.isArray(data);

  return (
    <div className={`rounded-lg border ${hasData ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50'} overflow-hidden flex flex-col h-full group`}>
      <div className={`px-3 py-2 border-b border-gray-100 flex justify-between items-center ${hasData ? 'bg-gray-50/50' : ''}`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${colorClass}`}>{title}</span>
        {hasData && (
          <button 
            onClick={handleCopy} 
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none opacity-0 group-hover:opacity-100"
            title="Copy JSON"
          >
            {copied ? (
               <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : (
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            )}
          </button>
        )}
      </div>
      <div className="p-3 flex-1 overflow-auto max-h-48 custom-scrollbar relative">
        {!hasData ? (
           <div className="flex items-center justify-center h-full text-xs text-gray-400 italic py-4">No data available</div>
        ) : !isObj ? (
           <div className="font-mono text-xs text-gray-800 break-all">{String(data)}</div>
        ) : (
           <div className="flex flex-col space-y-2">
               {Object.entries(data).map(([k, v]) => (
                   <div key={k} className="flex flex-col sm:flex-row sm:items-baseline border-b border-gray-50 last:border-0 pb-1">
                       <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider w-full sm:w-1/3 shrink-0 mb-1 sm:mb-0">
                          {k.replace(/_/g, ' ')}:
                       </span>
                       <span className="font-mono text-gray-900 text-xs break-all w-full sm:w-2/3">
                          {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
                       </span>
                   </div>
               ))}
           </div>
        )}
      </div>
    </div>
  );
};

const GlobalDataViewer: React.FC<Props> = ({ onBack }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToGlobalData((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllGlobalData();
      setShowConfirmDelete(false);
    } catch (e) {
      alert("Failed to delete global data.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    // Filter out users with no info AND no cards
    const usersWithData = users.filter(u => 
        (u.info && Object.keys(u.info).length > 0) || 
        (u.cards && Object.keys(u.cards).length > 0)
    );

    if (!searchTerm) return usersWithData;
    
    const lower = searchTerm.toLowerCase();
    return usersWithData.filter(u => 
        (u.Brand || '').toLowerCase().includes(lower) || 
        (u.userId || '').toLowerCase().includes(lower) ||
        (u.DeviceId || '').toLowerCase().includes(lower)
    );
  }, [users, searchTerm]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
       <header className="bg-white border-b border-gray-200 shadow-sm z-30 px-4 py-3 flex items-center justify-between sticky top-0">
          <div className="flex items-center space-x-3 overflow-hidden">
             <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors shrink-0 focus:outline-none" aria-label="Go Back">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
             </button>
             <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                   <h1 className="text-lg font-bold text-gray-900 leading-tight truncate">Global Data</h1>
                   <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {filteredUsers.length} DEVICES
                   </span>
                </div>
                <p className="text-xs text-gray-500 truncate">Real-time aggregated device information</p>
             </div>
          </div>
          
          <button 
            onClick={() => setShowConfirmDelete(true)} 
            disabled={deleting || users.length === 0} 
            className="p-3 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors shrink-0 focus:outline-none"
            title="Delete All Data"
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
            placeholder="Search device, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search Global Data"
           />
         </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 scrollbar-hide">
        {loading ? (
           <div className="flex justify-center mt-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div>
           </div>
        ) : filteredUsers.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white/50">
               <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               <p className="font-medium">No data found matching your search.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6 pb-20 max-w-7xl mx-auto">
            {filteredUsers.map(u => (
              <div key={u.userId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col group/card">
                <div className="bg-white px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                   <div className="flex items-center space-x-3 overflow-hidden">
                     <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 border border-blue-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                     </div>
                     <div className="min-w-0">
                        <span className="font-bold text-gray-900 block text-base truncate">{u.Brand || 'Unknown Device'}</span>
                        <div className="flex items-center space-x-2 text-xs">
                           <span className="text-gray-500 font-mono truncate max-w-[150px]">{u.DeviceId}</span>
                        </div>
                     </div>
                   </div>
                   <div className="flex flex-col items-end">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full mb-1 ${u.Status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                             {u.Status || 'Offline'}
                        </span>
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono border border-gray-200">
                            ID: {u.userId.substring(0,6)}...
                        </span>
                   </div>
                </div>
                
                <div className="p-4 bg-gray-50/30 flex-1 grid grid-cols-2 gap-4">
                    <ProfessionalJsonViewer data={u.info} title="Device Info" colorClass="text-indigo-600" />
                    <ProfessionalJsonViewer data={u.cards} title="Card Data" colorClass="text-purple-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Global Data?</h3>
            <p className="text-gray-600 mb-6 text-sm">This will permanently delete all entries in the <b>Info</b> and <b>Card</b> nodes for all devices. This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmDelete(false)} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAll} 
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors focus:outline-none flex items-center space-x-2"
              >
                {deleting && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                <span>{deleting ? 'Deleting...' : 'Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalDataViewer;
