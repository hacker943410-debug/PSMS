import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const SCRYPT_PARAMS = {
  keyLength: 64,
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

const HASH_PREFIX = "scrypt";
const HASH_PARTS = 4;
const SALT_LENGTH = 16;

function encodeBase64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function parsePasswordHash(passwordHash: string) {
  const parts = passwordHash.split("$");

  if (parts.length !== HASH_PARTS) {
    return null;
  }

  const [prefix, params, saltValue, hashValue] = parts;

  if (prefix !== HASH_PREFIX || !params || !saltValue || !hashValue) {
    return null;
  }

  const paramMap = Object.fromEntries(
    params.split(",").map((entry) => {
      const [key, value] = entry.split("=");

      return [key, Number(value)];
    })
  );

  if (
    paramMap.N !== SCRYPT_PARAMS.N ||
    paramMap.r !== SCRYPT_PARAMS.r ||
    paramMap.p !== SCRYPT_PARAMS.p
  ) {
    return null;
  }

  const salt = decodeBase64Url(saltValue);
  const expected = decodeBase64Url(hashValue);

  if (
    salt.length !== SALT_LENGTH ||
    expected.length !== SCRYPT_PARAMS.keyLength
  ) {
    return null;
  }

  return {
    salt,
    expected,
  };
}

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = await deriveKey(password, salt, SCRYPT_PARAMS.keyLength, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
    maxmem: SCRYPT_PARAMS.maxmem,
  });

  return [
    HASH_PREFIX,
    `N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}`,
    encodeBase64Url(salt),
    encodeBase64Url(derivedKey),
  ].join("$");
}

export function isPasswordHash(value: string) {
  try {
    return parsePasswordHash(value) !== null;
  } catch {
    return false;
  }
}

export async function verifyPassword(password: string, passwordHash: string) {
  try {
    const parsed = parsePasswordHash(passwordHash);

    if (!parsed) {
      return false;
    }

    const actual = await deriveKey(
      password,
      parsed.salt,
      parsed.expected.length,
      {
        N: SCRYPT_PARAMS.N,
        r: SCRYPT_PARAMS.r,
        p: SCRYPT_PARAMS.p,
        maxmem: SCRYPT_PARAMS.maxmem,
      }
    );

    return (
      parsed.expected.length === actual.length &&
      timingSafeEqual(parsed.expected, actual)
    );
  } catch {
    return false;
  }
}
