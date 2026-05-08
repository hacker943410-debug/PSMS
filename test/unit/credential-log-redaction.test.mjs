import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CREDENTIAL_LOG_REDACTION_VALUE,
  createCredentialLogRedactor,
  redactCredentialSecretsFromLog,
} from "../e2e/support/credential-log-redaction.mjs";

const RAW_TOKEN = "A".repeat(43);
const COMPLETION_MARKER =
  "v1.1790000000000.abcdefghijklmnopqrstuv.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi12345678";

function redactChunks(chunks) {
  const redactor = createCredentialLogRedactor();

  return (
    chunks.map((chunk) => redactor.write(chunk)).join("") + redactor.flush()
  );
}

describe("credential log redaction", () => {
  it("redacts credential token query values from URL logs", () => {
    const redacted = redactCredentialSecretsFromLog(
      `GET /staff-activation?token=${RAW_TOKEN}&from=email 307`
    );

    assert.equal(
      redacted,
      `GET /staff-activation?token=${CREDENTIAL_LOG_REDACTION_VALUE}&from=email 307`
    );
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
  });

  it("redacts credential token and completion cookie values", () => {
    const redacted = redactCredentialSecretsFromLog(
      [
        `Cookie: psms_staff_activation_token=${RAW_TOKEN};`,
        `psms_password_reset_token=${RAW_TOKEN};`,
        `psms_staff_activation_completed=${COMPLETION_MARKER};`,
        `psms_password_reset_completed=${COMPLETION_MARKER}`,
      ].join(" ")
    );

    assert.match(redacted, /psms_staff_activation_token=\[REDACTED\];/);
    assert.match(redacted, /psms_password_reset_token=\[REDACTED\];/);
    assert.match(redacted, /psms_staff_activation_completed=\[REDACTED\];/);
    assert.match(redacted, /psms_password_reset_completed=\[REDACTED\]/);
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
    assert.doesNotMatch(redacted, new RegExp(COMPLETION_MARKER));
  });

  it("redacts JSON and form sensitive fields if request bodies are logged", () => {
    const redacted = redactCredentialSecretsFromLog(
      `body={"token":"${RAW_TOKEN}","password":"PlainPassword123!"} token=${RAW_TOKEN}&password=keep-local`
    );

    assert.equal(
      redacted,
      `body={"token":"${CREDENTIAL_LOG_REDACTION_VALUE}","password":"${CREDENTIAL_LOG_REDACTION_VALUE}"} token=${CREDENTIAL_LOG_REDACTION_VALUE}&password=${CREDENTIAL_LOG_REDACTION_VALUE}`
    );
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
    assert.doesNotMatch(redacted, /PlainPassword123!|keep-local/);
  });

  it("redacts action arguments and bearer authorization values", () => {
    const redacted = redactCredentialSecretsFromLog(
      `loginAction({"loginId":"admin1001","password":"LocalAdmin123!"}) authorization: Bearer ${RAW_TOKEN}`
    );

    assert.equal(
      redacted,
      `loginAction({"loginId":"admin1001","password":"${CREDENTIAL_LOG_REDACTION_VALUE}"}) authorization: Bearer ${CREDENTIAL_LOG_REDACTION_VALUE}`
    );
    assert.doesNotMatch(redacted, /LocalAdmin123!/);
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
  });

  it("redacts secrets split across stream chunks", () => {
    const redacted = redactChunks([
      "GET /password-reset?to",
      `ken=${RAW_TOKEN} 307 Cookie: psms_staff_activation_to`,
      `ken=${RAW_TOKEN}; body={"to`,
      `ken":"${RAW_TOKEN}"}`,
    ]);

    assert.match(redacted, /\?token=\[REDACTED\]/);
    assert.match(redacted, /psms_staff_activation_token=\[REDACTED\];/);
    assert.match(redacted, /"token":"\[REDACTED\]"/);
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
  });

  it("waits for full log lines before redacting stream output", () => {
    const redacted = redactChunks([
      `loginAction({"loginId":"admin1001","password":"Lo`,
      `calAdmin123!"})\nGET /password-reset?to`,
      `ken=${RAW_TOKEN} 307\n`,
    ]);

    assert.match(redacted, /"password":"\[REDACTED\]"/);
    assert.match(redacted, /\?token=\[REDACTED\]/);
    assert.doesNotMatch(redacted, /LocalAdmin123!/);
    assert.doesNotMatch(redacted, new RegExp(RAW_TOKEN));
  });

  it("preserves non-credential log content", () => {
    const input = "ready on http://127.0.0.1:5273/login";

    assert.equal(redactCredentialSecretsFromLog(input), input);
  });
});
