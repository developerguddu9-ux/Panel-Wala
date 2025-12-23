
import React, { useState, useEffect, useMemo } from 'react';
import { DeviceInfo } from '../types';
import { subscribeToUsers } from '../services/firebase';

interface Props {
  onBack: () => void;
  onSelectUserForSMS: (user: DeviceInfo) => void;
  onSelectUserForData: (user: DeviceInfo) => void;
}

const FavoritesList: React.FC<Props> = ({ onBack, onSelectUserForSMS, onSelectUserForData }) => {
  const [users, setUsers] = useState<DeviceInfo[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedFavs = localStorage.getItem('panel_favorites');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    const unsubscribe = subscribeToUsers((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const favoriteUsers = useMemo(() => {
    return users.filter(u => favorites.includes(u.userId));
  }, [users, favorites]);

  const toggleFavorite = (userId: string) => {
    const newFavs = favorites.filter(id => id !== userId);
    setFavorites(newFavs);
    localStorage.setItem('panel_favorites', JSON.stringify(newFavs));
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center sticky top-0 z-20 shadow-sm">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h1 className="font-bold text-xl text-gray-900">Favorites</h1>
          <p className="text-xs text-gray-500">{favoriteUsers.length} saved devices</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div></div>
        ) : favoriteUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed rounded-xl">
             <svg className="w-12 h-12 mb-3 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
             <p className="font-medium">No favorites added yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {favoriteUsers.map(user => (
              <div key={user.userId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                <div className={`h-1.5 w-full ${user.Status === 'Online' ? 'bg-green-500' : 'bg-gray-200'}`}></div>
                <div className="p-4 flex-1 flex flex-col">
                   <div className="flex justify-between items-start mb-3">
                     <div className="flex-1 pr-2 min-w-0">
                       <div className="flex items-center space-x-1.5 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{user.Brand || 'Unknown'}</h3>
                          {user.checked && <svg className="w-5 h-5 text-blue-500 fill-current flex-shrink-0" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                       </div>
                       <p className="text-xs text-gray-500 font-mono mt-1 truncate">{user.DeviceId}</p>
                     </div>
                     <button onClick={() => toggleFavorite(user.userId)} className="p-1.5 text-yellow-400 hover:text-gray-300">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                     </button>
                   </div>
                   <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
                      <button onClick={() => onSelectUserForSMS(user)} className="py-2 bg-gray-50 hover:bg-app-green hover:text-white text-gray-600 rounded-lg text-sm font-semibold transition-colors">SMS</button>
                      <button onClick={() => onSelectUserForData(user)} className="py-2 bg-gray-50 hover:bg-blue-600 hover:text-white text-gray-600 rounded-lg text-sm font-semibold transition-colors">Data</button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FavoritesList;
