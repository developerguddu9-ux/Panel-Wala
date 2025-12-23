import React, { useState } from 'react';
import { BankStats } from '../types';

interface BankChipsProps {
  stats: BankStats[];
  selectedBank: string | null;
  onSelectBank: (bank: string | null) => void;
}

const BankChips: React.FC<BankChipsProps> = ({ stats, selectedBank, onSelectBank }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (stats.length === 0) return null;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm transition-all duration-300">
      <button 
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-app-green"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        aria-controls="bank-filter-chips"
      >
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Detected Banks ({stats.length})</span>
        <svg 
          className={`w-4 h-4 text-gray-500 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div 
        id="bank-filter-chips"
        className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="overflow-x-auto whitespace-nowrap p-3 scrollbar-hide flex gap-2">
          <button
            onClick={() => onSelectBank(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-app-green ${
              selectedBank === null 
                ? 'bg-app-green text-white border-app-green shadow-sm' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
            aria-pressed={selectedBank === null}
          >
            All
          </button>
          {stats.map((stat) => (
            <button
              key={stat.name}
              onClick={() => onSelectBank(selectedBank === stat.name ? null : stat.name)}
              className={`flex-shrink-0 flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-app-green ${
                selectedBank === stat.name 
                  ? 'bg-app-green text-white border-app-green shadow-sm' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              aria-pressed={selectedBank === stat.name}
            >
              <span>{stat.name}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                 selectedBank === stat.name ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {stat.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BankChips;