
import React, { useEffect, useState, useMemo } from 'react';
import { Message } from '../types';
import { subscribeToAllMessages, deleteAllAppMessages } from '../services/firebase';

interface Props {
  onBack: () => void;
}

const MessagesViewer: React.FC<Props> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string>('All');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToAllMessages((data) => {
      setMessages(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const uniquePackages = useMemo(() => {
    const pkgs = new Set<string>();
    messages.forEach(m => { if (m.package) pkgs.add(m.package); });
    return Array.from(pkgs).sort();
  }, [messages]);

  const filteredMessages = useMemo(() => {
    let result = messages;
    if (selectedPackage !== 'All') {
      result = result.filter(m => m.package === selectedPackage);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(m => 
        (m.title || '').toLowerCase().includes(lower) || 
        (m.text || '').toLowerCase().includes(lower) || 
        (m.subText || '').toLowerCase().includes(lower) ||
        (m.package || '').toLowerCase().includes(lower)
      );
    }
    return result;
  }, [messages, selectedPackage, searchTerm]);

  const groupedMessages = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    filteredMessages.forEach(m => {
      if (!groups[m.deviceId]) groups[m.deviceId] = [];
      groups[m.deviceId].push(m);
    });
    return groups;
  }, [filteredMessages]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllAppMessages();
      setMessages([]);
      setShowConfirmDelete(false);
    } catch (e) {
      console.error("Delete failed", e);
      alert("Failed to delete messages");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">App Messages</h1>
            <p className="text-xs text-gray-500 font-medium">{filteredMessages.length} Messages Displayed</p>
          </div>
          <button 
            onClick={() => setShowConfirmDelete(true)} 
            disabled={messages.length === 0 || deleting}
            className="p-3 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Delete All Messages"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <div className="relative group min-w-[140px] flex-1 md:flex-none">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-app-green/20 focus:border-app-green transition-all text-sm"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
             <select
               value={selectedPackage}
               onChange={(e) => setSelectedPackage(e.target.value)}
               className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-app-green/20 cursor-pointer shadow-sm hover:border-gray-300 transition-colors"
             >
               <option value="All">All Packages</option>
               {uniquePackages.map(pkg => (
                 <option key={pkg} value={pkg}>{pkg}</option>
               ))}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
               <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-10 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green mb-3"></div>
            <span className="text-sm">Loading Messages...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
             <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
             <p className="font-medium">No messages found matching criteria</p>
          </div>
        ) : (
          (Object.entries(groupedMessages) as [string, Message[]][]).map(([deviceId, msgs]) => (
            <div key={deviceId} className="space-y-4">
              <div className="flex items-center space-x-3 border-b border-gray-200 pb-3">
                <div className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-widest font-bold">DEVICE</div>
                <h2 className="text-sm font-bold text-gray-700 font-mono tracking-tight flex items-center space-x-2">
                   <span>{deviceId}</span>
                   <button onClick={() => copyToClipboard(deviceId)} className="text-gray-300 hover:text-gray-600 transition-colors focus:outline-none" title="Copy ID">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                   </button>
                </h2>
                <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-full">{msgs.length}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {msgs.map((m) => (
                  <div key={m.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md hover:border-blue-100 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 truncate max-w-full inline-block" title={m.package}>
                          {m.package}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded whitespace-nowrap ml-2">
                        {m.formattedTime || (m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--')}
                      </span>
                    </div>
                    
                    <div className="flex-1 space-y-1.5">
                       <h3 className="font-bold text-gray-900 text-sm truncate" title={m.title}>
                          {m.title || 'Notification'}
                       </h3>
                       <p className="text-gray-600 text-xs leading-relaxed break-words line-clamp-4">
                          {m.text || <span className="italic text-gray-400">Empty notification text</span>}
                       </p>
                    </div>

                    {m.subText && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <p className="text-[10px] text-gray-400 font-medium italic flex items-center">
                           <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                           {m.subText}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete All App Messages?</h3>
            <p className="text-gray-600 mb-6 text-sm">Are you sure you want to clear all notification history? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setShowConfirmDelete(false)} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteAll} 
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center space-x-2"
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

export default MessagesViewer;
