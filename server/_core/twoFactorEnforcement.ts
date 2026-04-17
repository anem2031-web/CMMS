/**
 * Two-Factor Authentication Enforcement System
 * Handles mandatory 2FA for administrative roles with grace period
 */

import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";


// Roles that require 2FA
export const MANDATORY_2FA_ROLES = ["admin", "maintenance_manager", "supervisor", "senior_management"] as const;

// Grace period in milliseconds (3 days)
export const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Check if a user role requires 2FA
 */
export function requiresTwoFactor(role: string): boolean {
  return MANDATORY_2FA_ROLES.includes(role as any);
}

/**
 * Check if user is within grace period
 */
export function isWithinGracePeriod(user: User): boolean {
  if (!requiresTwoFactor(user.role)) {
    return false; // Grace period doesn't apply
  }

  // If user was created within grace period, they're within it
  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const timeSinceCreation = now - createdAt;

  return timeSinceCreation < GRACE_PERIOD_MS;
}

/**
 * Check if user needs to setup 2FA
 * Returns true if user requires 2FA but hasn't set it up
 */
export function needsTwoFactorSetup(user: User, twoFactorEnabled: boolean): boolean {
  if (!requiresTwoFactor(user.role)) {
    return false; // User doesn't require 2FA
  }

  if (twoFactorEnabled) {
    return false; // User already has 2FA enabled
  }

  // User requires 2FA but hasn't enabled it
  return true;
}

/**
 * Get enforcement status for a user
 */
export interface TwoFactorEnforcementStatus {
  required: boolean;
  enabled: boolean;
  withinGracePeriod: boolean;
  daysUntilEnforcement: number;
  isEnforced: boolean;
}

export function getTwoFactorEnforcementStatus(
  user: User,
  twoFactorEnabled: boolean
): TwoFactorEnforcementStatus {
  const required = requiresTwoFactor(user.role);
  const withinGracePeriod = isWithinGracePeriod(user);

  const createdAt = new Date(user.createdAt).getTime();
  const now = Date.now();
  const timeSinceCreation = now - createdAt;
  const timeUntilEnforcement = Math.max(0, GRACE_PERIOD_MS - timeSinceCreation);
  const daysUntilEnforcement = Math.ceil(timeUntilEnforcement / (24 * 60 * 60 * 1000));

  return {
    required,
    enabled: twoFactorEnabled,
    withinGracePeriod,
    daysUntilEnforcement,
    isEnforced: required && !withinGracePeriod && !twoFactorEnabled,
  };
}

/**
 * Enforce 2FA requirement
 * Throws error if user requires 2FA but hasn't enabled it and grace period expired
 */
export function enforceTwoFactor(user: User, twoFactorEnabled: boolean): void {
  const status = getTwoFactorEnforcementStatus(user, twoFactorEnabled);

  if (status.isEnforced) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Two-Factor Authentication is mandatory for ${user.role} accounts. Please enable 2FA to continue.`,
    });
  }
}

/**
 * Get 2FA enforcement message for user
 */
export function getTwoFactorEnforcementMessage(status: TwoFactorEnforcementStatus): string | null {
  if (!status.required) {
    return null;
  }

  if (status.enabled) {
    return null; // 2FA already enabled
  }

  if (status.withinGracePeriod) {
    return `⏰ Grace Period: You have ${status.daysUntilEnforcement} days to enable Two-Factor Authentication before it becomes mandatory.`;
  }

  return "🔒 Two-Factor Authentication is now mandatory for your role. Please enable it immediately.";
}
