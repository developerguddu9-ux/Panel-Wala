
import React, { useState, useEffect } from 'react';
import { updateAdminNumber, getAdminNumber } from '../services/firebase';

interface Props {
  onClose: () => void;
}

const AdminNumberModal: React.FC<Props> = ({ onClose }) => {
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SAVING' | 'SUCCESS' | 'ERROR'>('LOADING');

  useEffect(() => {
    const fetchNumber = async () => {
      const current = await getAdminNumber();
      setNumber(current);
      setStatus('IDLE');
    };
    fetchNumber();
  }, []);

  const handleSave = async () => {
    if (!number) return;
    setStatus('SAVING');
    try {
      await updateAdminNumber(number);
      setStatus('SUCCESS');
      setTimeout(onClose, 1000);
    } catch (e) {
      setStatus('ERROR');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Update Admin Number</h3>
        
        <input 
          type="tel" 
          value={number}
          onChange={e => setNumber(e.target.value)}
          placeholder={status === 'LOADING' ? "Loading..." : "Enter new admin number"}
          disabled={status === 'LOADING'}
          className="w-full border border-gray-300 rounded p-2 mb-4 focus:border-app-green focus:outline-none disabled:bg-gray-100"
        />

        {status === 'SUCCESS' && <p className="text-green-600 text-sm mb-4">Number updated successfully!</p>}
        {status === 'ERROR' && <p className="text-red-600 text-sm mb-4">Failed to update.</p>}

        <div className="flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={status === 'SAVING' || status === 'LOADING'}
            className="px-4 py-2 bg-app-green text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {status === 'SAVING' ? 'Saving...' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminNumberModal;