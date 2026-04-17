import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * 2FA (Two-Factor Authentication) Utility
 * Supports Google Authenticator, Microsoft Authenticator, and other TOTP apps
 */

export interface TwoFactorSecret {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  manualEntryKey: string;
}

export interface VerifyTwoFactorResult {
  valid: boolean;
  message: string;
}

/**
 * Generate a new 2FA secret with QR code
 * @param userEmail - User email for the authenticator label
 * @param appName - Application name (default: "CMMS")
 * @returns TwoFactorSecret with QR code and backup codes
 */
export async function generateTwoFactorSecret(
  userEmail: string,
  appName: string = 'CMMS'
): Promise<TwoFactorSecret> {
  // Generate secret using speakeasy
  const secret = speakeasy.generateSecret({
    name: `${appName} (${userEmail})`,
    issuer: appName,
    length: 32, // 256-bit secret for maximum security
  });

  if (!secret.base32 || !secret.otpauth_url) {
    throw new Error('Failed to generate 2FA secret');
  }

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = generateBackupCodes(10);

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
    manualEntryKey: secret.base32, // For manual entry if QR code fails
  };
}

/**
 * Verify a TOTP token
 * @param secret - The user's 2FA secret
 * @param token - The 6-digit token from authenticator app
 * @param window - Time window for verification (default: 2, allows ±2 time steps)
 * @returns VerifyTwoFactorResult
 */
export function verifyTwoFactorToken(
  secret: string,
  token: string,
  window: number = 2
): VerifyTwoFactorResult {
  try {
    // Remove any spaces from token
    const cleanToken = token.replace(/\s/g, '');

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: cleanToken,
      window,
    });

    if (verified) {
      return {
        valid: true,
        message: 'Token verified successfully',
      };
    }

    return {
      valid: false,
      message: 'Invalid or expired token',
    };
  } catch (error) {
    return {
      valid: false,
      message: `Token verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Verify a backup code
 * @param backupCode - The backup code to verify
 * @param storedBackupCodes - Array of stored backup codes (hashed)
 * @returns true if backup code is valid
 */
export function verifyBackupCode(
  backupCode: string,
  storedBackupCodes: string[]
): boolean {
  const cleanCode = backupCode.replace(/\s/g, '').toUpperCase();
  const hashedCode = hashBackupCode(cleanCode);

  return storedBackupCodes.includes(hashedCode);
}

/**
 * Hash a backup code for secure storage
 * @param code - The backup code to hash
 * @returns Hashed backup code
 */
export function hashBackupCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code)
    .digest('hex');
}

/**
 * Generate backup codes
 * @param count - Number of codes to generate (default: 10)
 * @returns Array of backup codes
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()
      .substring(0, 8);
    codes.push(code);
  }

  return codes;
}

/**
 * Hash backup codes for storage
 * @param codes - Array of backup codes
 * @returns Array of hashed backup codes
 */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => hashBackupCode(code));
}

/**
 * Remove a used backup code from the list
 * @param usedCode - The backup code that was used
 * @param storedBackupCodes - Array of stored backup codes (hashed)
 * @returns Updated array of backup codes
 */
export function removeUsedBackupCode(
  usedCode: string,
  storedBackupCodes: string[]
): string[] {
  const cleanCode = usedCode.replace(/\s/g, '').toUpperCase();
  const hashedCode = hashBackupCode(cleanCode);

  return storedBackupCodes.filter(code => code !== hashedCode);
}

/**
 * Get remaining backup codes count
 * @param storedBackupCodes - Array of stored backup codes
 * @returns Number of remaining backup codes
 */
export function getRemainingBackupCodesCount(storedBackupCodes: string[]): number {
  return storedBackupCodes.length;
}

/**
 * Check if user should be warned about low backup codes
 * @param storedBackupCodes - Array of stored backup codes
 * @returns true if remaining codes <= 3
 */
export function shouldWarnAboutLowBackupCodes(storedBackupCodes: string[]): boolean {
  return storedBackupCodes.length <= 3;
}
