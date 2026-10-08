export interface BankInfo {
  name: string;
  code: string;
  category?: 'Commercial' | 'Fintech' | 'Non-Interest' | 'Microfinance' | 'Merchant';
}

export const NIGERIAN_BANKS: BankInfo[] = [
  // Commercial Banks
  { name: 'Access Bank', code: '044', category: 'Commercial' },
  { name: 'Citibank Nigeria', code: '023', category: 'Commercial' },
  { name: 'Ecobank Nigeria', code: '050', category: 'Commercial' },
  { name: 'Fidelity Bank', code: '070', category: 'Commercial' },
  { name: 'First Bank of Nigeria (FBN)', code: '011', category: 'Commercial' },
  { name: 'First City Monument Bank (FCMB)', code: '214', category: 'Commercial' },
  { name: 'Globus Bank', code: '00103', category: 'Commercial' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', category: 'Commercial' },
  { name: 'Heritage Bank', code: '030', category: 'Commercial' },
  { name: 'Keystone Bank', code: '082', category: 'Commercial' },
  { name: 'Optimus Bank', code: '00107', category: 'Commercial' },
  { name: 'Parallex Bank', code: '526', category: 'Commercial' },
  { name: 'Polaris Bank', code: '076', category: 'Commercial' },
  { name: 'Premium Trust Bank', code: '00031', category: 'Commercial' },
  { name: 'Providus Bank', code: '101', category: 'Commercial' },
  { name: 'Signature Bank', code: '00034', category: 'Commercial' },
  { name: 'Stanbic IBTC Bank', code: '221', category: 'Commercial' },
  { name: 'Standard Chartered Bank', code: '068', category: 'Commercial' },
  { name: 'Sterling Bank', code: '232', category: 'Commercial' },
  { name: 'SunTrust Bank', code: '100', category: 'Commercial' },
  { name: 'Titan Trust Bank', code: '102', category: 'Commercial' },
  { name: 'Union Bank of Nigeria', code: '032', category: 'Commercial' },
  { name: 'United Bank for Africa (UBA)', code: '033', category: 'Commercial' },
  { name: 'Unity Bank', code: '215', category: 'Commercial' },
  { name: 'Wema Bank', code: '035', category: 'Commercial' },
  { name: 'Zenith Bank', code: '057', category: 'Commercial' },

  // Non-Interest / Islamic Banks
  { name: 'Jaiz Bank', code: '301', category: 'Non-Interest' },
  { name: 'Lotus Bank', code: '303', category: 'Non-Interest' },
  { name: 'TAJBank', code: '302', category: 'Non-Interest' },
  { name: 'Alternative Bank', code: '305', category: 'Non-Interest' },

  // Fintech / Digital Banks / Neobanks
  { name: 'Kuda Microfinance Bank', code: '50211', category: 'Fintech' },
  { name: 'Moniepoint Microfinance Bank', code: '50515', category: 'Fintech' },
  { name: 'OPay Digital Services (Paycom)', code: '999992', category: 'Fintech' },
  { name: 'PalmPay', code: '999991', category: 'Fintech' },
  { name: 'FairMoney Microfinance Bank', code: '51318', category: 'Fintech' },
  { name: 'Carbon (One Finance)', code: '565', category: 'Fintech' },
  { name: 'VFD Microfinance Bank', code: '566', category: 'Fintech' },
  { name: 'Rubies Bank (Highstreet MFB)', code: '125', category: 'Fintech' },
  { name: 'Dot Microfinance Bank', code: '50163', category: 'Fintech' },

  // Merchant Banks
  { name: 'Coronation Merchant Bank', code: '559', category: 'Merchant' },
  { name: 'FBNQuest Merchant Bank', code: '560', category: 'Merchant' },
  { name: 'FSDH Merchant Bank', code: '501', category: 'Merchant' },
  { name: 'Greenwich Merchant Bank', code: '562', category: 'Merchant' },
  { name: 'Nova Merchant Bank', code: '561', category: 'Merchant' },
  { name: 'Rand Merchant Bank', code: '502', category: 'Merchant' },
];

/**
 * Validates whether a Nigerian NUBAN account number format is valid (10 digits)
 */
export function isValidNuban(accountNumber: string): boolean {
  if (!accountNumber) return false;
  const cleaned = accountNumber.trim().replace(/\D/g, '');
  return cleaned.length === 10;
}

/**
 * Standardize and clean account number to digits only
 */
export function sanitizeAccountNumber(accountNumber: string): string {
  if (!accountNumber) return '';
  return accountNumber.replace(/\D/g, '').slice(0, 10);
}
