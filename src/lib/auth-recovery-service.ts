// ============================================================
// SADA OS — SUPABASE PASSWORD RECOVERY SERVICE
// Canonical helper for requesting password resets, normalizing emails,
// validating redirect URLs, and updating passwords via Supabase Auth.
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export interface RecoveryRequestResult {
  success: boolean;
  errorType?: "empty_email" | "invalid_format" | "rate_limited" | "api_error";
  message: string;
  diagnosticError?: any;
}

export interface PasswordUpdateResult {
  success: boolean;
  message: string;
  error?: any;
}

/**
 * Normalizes an email address (trims whitespace, converts to lowercase)
 */
export function normalizeEmail(email: string): string {
  return email ? email.trim().toLowerCase() : "";
}

/**
 * Validates email format according to standard RFC-compliant pattern
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const pattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return pattern.test(email.trim());
}

/**
 * Returns the exact canonical reset-password redirect URL for Supabase Auth
 */
export function getResetPasswordRedirectUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/reset-password`;
  }
  const envUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_APP_URL);
  return `${envUrl || "https://sada.agency"}/reset-password`;
}

/**
 * Submits a password recovery request to Supabase Auth.
 * Does not expose account enumeration vulnerabilities to the end user.
 */
export async function requestPasswordRecovery(
  rawEmail: string,
  isAr = false
): Promise<RecoveryRequestResult> {
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return {
      success: false,
      errorType: "empty_email",
      message: isAr
        ? "يرجى إدخال البريد الإلكتروني."
        : "Please enter your email address.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      success: false,
      errorType: "invalid_format",
      message: isAr
        ? "صيغة البريد الإلكتروني غير صحيحة. يرجى التحقق وإعادة المحاولة."
        : "Invalid email format. Please check and try again.",
    };
  }

  const redirectTo = getResetPasswordRedirectUrl();

  try {
    const { data: _data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[PasswordRecovery] Supabase resetPasswordForEmail error:", {
        email,
        redirectTo,
        errorStatus: (error as any).status,
        errorCode: (error as any).code,
        errorMessage: error.message,
      });

      // Handle Supabase default email provider rate limiting
      if (
        (error as any).status === 429 ||
        (error as any).code === "over_email_send_rate_limit" ||
        error.message?.toLowerCase().includes("rate limit")
      ) {
        return {
          success: false,
          errorType: "rate_limited",
          message: isAr
            ? "تم تجاوز الحد المسموح لإرسال رسائل الاستعادة مؤقتاً. يرجى الانتظار بضع دقائق قبل المحاولة مرة أخرى."
            : "Email sending rate limit reached. Please wait a few minutes before requesting another link.",
          diagnosticError: error,
        };
      }

      return {
        success: false,
        errorType: "api_error",
        message: isAr
          ? "تعذر إرسال رسالة الاستعادة في الوقت الحالي. يرجى المحاولة لاحقاً أو الاتصال بالدعم."
          : "Unable to send recovery email at this time. Please try again later or contact your administrator.",
        diagnosticError: error,
      };
    }

    // Success response: generic for security against account enumeration
    return {
      success: true,
      message: isAr
        ? `إذا كان الحساب (${email}) مسجلاً في النظام، فقد تم إرسال تعليمات الاستعادة. تحقق من صندوق الوارد ومجلد الرسائل غير المرغوب فيها (Spam).`
        : `If an account exists for (${email}), recovery instructions have been sent. Check your inbox and spam folder.`,
    };
  } catch (err: any) {
    console.error("[PasswordRecovery] Unexpected exception during resetPasswordForEmail:", err);
    return {
      success: false,
      errorType: "api_error",
      message: isAr
        ? "حدث خطأ غير متوقع أثناء معالجة الطلب."
        : "An unexpected error occurred while processing your request.",
      diagnosticError: err,
    };
  }
}

/**
 * Updates the user's password using an active Supabase recovery session.
 */
export async function updateUserPassword(
  newPassword: string,
  isAr = false
): Promise<PasswordUpdateResult> {
  if (!newPassword || newPassword.length < 8) {
    return {
      success: false,
      message: isAr
        ? "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."
        : "Password must be at least 8 characters long.",
    };
  }

  try {
    const { data: _data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error("[PasswordRecovery] updateUser error:", error);
      return {
        success: false,
        message: error.message || (isAr ? "فشل تحديث كلمة المرور." : "Failed to update password."),
        error,
      };
    }

    return {
      success: true,
      message: isAr
        ? "تم تحديث كلمة المرور بنجاح!"
        : "Password updated successfully!",
    };
  } catch (err: any) {
    console.error("[PasswordRecovery] Unexpected updateUser exception:", err);
    return {
      success: false,
      message: isAr ? "حدث خطأ أثناء حفظ كلمة المرور." : "An error occurred while saving the new password.",
      error: err,
    };
  }
}
