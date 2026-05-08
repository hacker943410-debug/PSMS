const CREDENTIAL_TOKEN_QUERY_PATTERN = /([?&]token=)[^&#\s"'<>]+/gi;
const CREDENTIAL_TOKEN_COOKIE_PATTERN =
  /\b(psms_(?:staff_activation|password_reset)_token=)[^;\s]+/g;
const CREDENTIAL_COMPLETION_COOKIE_PATTERN =
  /\b(psms_(?:staff_activation|password_reset)_completed=)[^;\s]+/g;
const JSON_SENSITIVE_FIELD_PATTERN =
  /("(?:authorization|confirmPassword|newPassword|password|passwordHash|rawToken|token|tokenHash)"\s*:\s*")[^"]+(")/gi;
const FORM_SENSITIVE_FIELD_PATTERN =
  /(\b(?:confirmPassword|newPassword|password|token)=)[^&\s]+/gi;
const AUTHORIZATION_BEARER_PATTERN = /(\bauthorization:\s*Bearer\s+)[^\s]+/gi;

export const CREDENTIAL_LOG_REDACTION_VALUE = "[REDACTED]";

export function redactCredentialSecretsFromLog(value) {
  return String(value)
    .replace(
      CREDENTIAL_TOKEN_QUERY_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}`
    )
    .replace(
      CREDENTIAL_TOKEN_COOKIE_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}`
    )
    .replace(
      CREDENTIAL_COMPLETION_COOKIE_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}`
    )
    .replace(
      JSON_SENSITIVE_FIELD_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}$2`
    )
    .replace(
      FORM_SENSITIVE_FIELD_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}`
    )
    .replace(
      AUTHORIZATION_BEARER_PATTERN,
      `$1${CREDENTIAL_LOG_REDACTION_VALUE}`
    );
}

export function createCredentialLogRedactor() {
  let pending = "";

  return {
    write(value) {
      pending += String(value);
      const lastLineBreak = Math.max(
        pending.lastIndexOf("\n"),
        pending.lastIndexOf("\r")
      );

      if (lastLineBreak < 0) {
        return "";
      }

      const safeText = pending.slice(0, lastLineBreak + 1);

      pending = pending.slice(lastLineBreak + 1);

      return redactCredentialSecretsFromLog(safeText);
    },
    flush() {
      const redacted = redactCredentialSecretsFromLog(pending);

      pending = "";

      return redacted;
    },
  };
}
