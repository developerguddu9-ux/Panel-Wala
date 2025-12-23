import React from 'react';
import { SMS } from '../types';
import { detectBanks } from '../services/bankUtils';

interface SmsModalProps {
  sms: SMS | null;
  onClose: () => void;
}

const SmsModal: React.FC<SmsModalProps> = ({ sms, onClose }) => {
  if (!sms) return null;

  const detectedBanks = detectBanks(sms.body + " " + sms.sender);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100" 
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-app-green px-4 py-3 flex justify-between items-center text-white">
          <h3 className="font-semibold text-lg truncate pr-2">{sms.sender}</h3>
          <button onClick={onClose} className="hover:bg-green-700 p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Message Body</label>
            <p className="text-gray-800 text-sm whitespace-pre-wrap mt-1 bg-gray-50 p-3 rounded border border-gray-100">
              {sms.body}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Received Date</label>
              <p className="text-sm text-gray-700">{sms.receivedDate}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Timestamp</label>
              <p className="text-sm text-gray-700">{new Date(sms.timestamp).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="text-xs font-bold text-gray-500 uppercase">User ID</label>
              <p className="text-xs text-gray-600 font-mono bg-gray-100 p-1 rounded truncate">{sms.userId}</p>
            </div>
             <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Android ID</label>
              <p className="text-xs text-gray-600 font-mono bg-gray-100 p-1 rounded truncate">{sms.androidId || 'N/A'}</p>
            </div>
          </div>

          {detectedBanks.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Detected Banks</label>
              <div className="flex flex-wrap gap-2">
                {detectedBanks.map(bank => (
                  <span key={bank} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
                    {bank}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-4 py-3 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmsModal;