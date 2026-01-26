import CryptoJS from 'crypto-js';
// IMPORTANT: Deep fix for "Native crypto module could not be used" in environments without window.crypto (like WeChat)
// Only patch if we are strictly in an environment without native crypto to avoid downgrading security in Browsers/Node.
try {
    const hasNativeCrypto = (typeof window !== 'undefined' && (window.crypto || window.msCrypto))
        || (typeof globalThis !== 'undefined' && globalThis.crypto);
    if (!hasNativeCrypto) {
        const lib = CryptoJS.lib;
        if (lib && lib.WordArray) {
            lib.WordArray.random = function (nBytes) {
                const words = [];
                for (let i = 0; i < nBytes; i += 4) {
                    words.push(Math.floor(Math.random() * 0x100000000));
                }
                return lib.WordArray.create(words, nBytes);
            };
            console.warn('NexQuery: CryptoJS.lib.WordArray.random has been patched (Insecure Fallback for Non-Standard Env)');
        }
    }
}
catch {
    console.error('NexQuery: Failed to patch CryptoJS');
}
export class CryptoService {
    constructor(key) {
        if (!key) {
            throw new Error('Encryption key is required');
        }
        this.key = key;
    }
    /**
     * Encrypts data (object or string) into a ciphertext string.
     * Uses AES-256 (via crypto-js default string passphrase handling).
     */
    encrypt(data) {
        const json = JSON.stringify(data);
        return CryptoJS.AES.encrypt(json, this.key).toString();
    }
    /**
     * Decrypts ciphertext string back to raw string.
     */
    decryptRaw(ciphertext) {
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, this.key);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            return originalText || null;
        }
        catch {
            console.error('Decryption failed');
            return null;
        }
    }
    /**
     * Decrypts ciphertext string back to original data (object or string).
     */
    decrypt(ciphertext) {
        const raw = this.decryptRaw(ciphertext);
        if (raw === null)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            // If it's not JSON, return as is (raw string)
            return raw;
        }
    }
    /**
     * Generates an MD5 signature of the encrypted payload signed with the key.
     * Format: MD5(encryptedPayload + key)
     */
    sign(encryptedBody) {
        return CryptoJS.MD5(encryptedBody + this.key).toString();
    }
}
