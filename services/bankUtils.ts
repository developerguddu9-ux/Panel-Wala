
export const BANK_KEYWORDS = [
  "HDFC", "SBI", "AXIS", "ICICI", "KOTAK", "YESBANK", "YES", 
  "CANARA", "BOB", "INDUSIND", "PAYTM", "PHONEPE", "AMEX", 
  "GOOGLEPAY", "AMAZONPAY", "PNB", "UNION", "IDFC", "RBL", 
  "CITI", "HSBC", "SC", "FEDERAL", "DBS"
];

export const detectBanks = (text: string): string[] => {
  if (!text || typeof text !== 'string') return [];
  const upperText = text.toUpperCase();
  const found = new Set<string>();
  
  BANK_KEYWORDS.forEach(bank => {
    if (upperText.includes(bank)) {
      found.add(bank);
    }
  });

  return Array.from(found);
};

export const extractBalance = (body: string): string | null => {
  if (!body || typeof body !== 'string') return null;
  // Regex to capture various balance formats
  // Matches: "Avail Bal Rs 1000", "Balance: 500.00", "A/c Balance INR 5,000", "Wallet Balance is 500"
  // Keywords: Avail, Avl, A/c, Acct, Net, Clg, Closing, Ledger, Wallet, Main + Bal/Balance/Val/Value
  const regex = /(?:(?:Avail|Avl|A\/c|Acct|Net|Clg|Closing|Ledger|Wallet|Main)\.?\s*(?:Bal(?:ance)?|Val(?:ue)?)|Balance)\s*(?:is|:|: |-| -)?\s*(?:Rs\.?|INR)?\s*([0-9,]+\.?[0-9]*)/i;
  
  const match = body.match(regex);
  if (match && match[1]) {
    return match[1]; // Returns the amount string (e.g., "5,000.00")
  }
  return null;
};

export const parseCustomDate = (dateStr: string): Date | null => {
  // Expected format: "HH:mm:ss dd/MM/yyyy"
  try {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split(' ');
    if (parts.length !== 2) return null;
    
    const timeParts = parts[0].split(':');
    const dateParts = parts[1].split('/');

    if (timeParts.length !== 3 || dateParts.length !== 3) return null;

    const h = parseInt(timeParts[0], 10);
    const m = parseInt(timeParts[1], 10);
    const s = parseInt(timeParts[2], 10);
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(dateParts[2], 10);

    return new Date(year, month, day, h, m, s);
  } catch (e) {
    console.error("Date parse error", e);
    return null;
  }
};