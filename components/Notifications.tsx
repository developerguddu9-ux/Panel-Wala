import React, { useEffect, useState } from 'react';
import { subscribeToSystemNotifications, markNotificationAsRead } from '../services/firebase';
import { Notification } from '../types';

interface Props {
  onBack: () => void;
  user?: any; 
}

const Notifications: React.FC<Props> = ({ onBack }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [favNotifications, setFavNotifications] = useState<string[]>([]);

  useEffect(() => {
    const savedFavs = localStorage.getItem('panel_fav_notifications');
    if (savedFavs) setFavNotifications(JSON.parse(savedFavs));

    const unsub = subscribeToSystemNotifications((data) => {
        setNotifications(data);
        setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleMarkRead = (id: string) => {
      markNotificationAsRead(id);
  };

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    let newFavs;
    if (favNotifications.includes(id)) {
      newFavs = favNotifications.filter(favId => favId !== id);
    } else {
      newFavs = [...favNotifications, id];
    }
    setFavNotifications(newFavs);
    localStorage.setItem('panel_fav_notifications', JSON.stringify(newFavs));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex items-center sticky top-0 z-20 flex-none">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
           <h1 className="font-bold text-xl text-gray-900">Notifications</h1>
           <p className="text-xs text-gray-500">History and system updates</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        {loading ? (
           <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div></div>
        ) : notifications.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed rounded-xl bg-white/50">
             <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
             <p className="font-medium">No notifications yet</p>
           </div>
        ) : (
           <div className="space-y-4 max-w-3xl mx-auto">
              {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-5 rounded-xl border transition-all cursor-pointer relative ${n.read ? 'bg-white border-gray-200 opacity-80' : 'bg-white border-l-4 border-l-app-green border-y-gray-200 border-r-gray-200 shadow-md transform hover:-translate-y-0.5'}`} 
                    onClick={() => !n.read && handleMarkRead(n.id)}
                  >
                      <button 
                        onClick={(e) => toggleFavorite(e, n.id)}
                        className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
                      >
                         <svg className={`w-5 h-5 ${favNotifications.includes(n.id) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.518 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.921-.755 1.688-1.54 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.784.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                         </svg>
                      </button>

                      <div className="flex justify-between items-start mb-2 pr-10">
                          <h4 className={`font-bold text-base ${n.read ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</h4>
                          <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap bg-gray-50 px-1.5 py-0.5 rounded">{new Date(n.timestamp).toLocaleString()}</span>
                      </div>
                      
                      <div className={`mt-1 text-sm leading-relaxed whitespace-pre-wrap ${n.read ? 'text-gray-500' : 'text-gray-700'}`}>
                          {n.text || n.message || "No message content."}
                      </div>
                      
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-50">
                          <div className="flex items-center space-x-2">
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${n.type === 'KEY_CHANGE' ? 'bg-purple-100 text-purple-700' : n.type === 'EXPIRY_WARNING' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                {(n.type || 'INFO').replace(/_/g, ' ')}
                              </span>
                              {n.priority === 'high' && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">High Priority</span>}
                          </div>
                          {!n.read && <div className="flex items-center space-x-1"><span className="text-[10px] font-bold text-app-green">NEW</span><span className="w-2 h-2 bg-app-green rounded-full animate-pulse"></span></div>}
                      </div>
                      {n.action_link && <a href={n.action_link} target="_blank" rel="noopener noreferrer" className="block mt-3 text-xs text-blue-600 font-bold hover:underline" onClick={e=>e.stopPropagation()}>{n.action || 'View Details'} &rarr;</a>}
                  </div>
              ))}
           </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
