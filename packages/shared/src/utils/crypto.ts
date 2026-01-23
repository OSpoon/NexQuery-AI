import CryptoJS from 'crypto-js';

// IMPORTANT: Deep fix for "Native crypto module could not be used" in environments without window.crypto (like WeChat)
try {
    const lib = (CryptoJS as any).lib;
    if (lib && lib.WordArray) {
        lib.WordArray.random = function (nBytes: number) {
            const words = [];
            for (let i = 0; i < nBytes; i += 4) {
                words.push(Math.floor(Math.random() * 0x100000000));
            }
            return lib.WordArray.create(words, nBytes);
        };
        console.log('NexQuery: CryptoJS.lib.WordArray.random has been patched');
    }
} catch (e) {
    console.error('NexQuery: Failed to patch CryptoJS', e);
}

export class CryptoService {
    private key: string;

    constructor(key: string) {
        if (!key) {
            throw new Error('Encryption key is required');
        }
        this.key = key;
    }

    /**
     * Encrypts data (object or string) into a ciphertext string.
     * Uses AES-256 (via crypto-js default string passphrase handling).
     */
    encrypt(data: any): string {
        const json = JSON.stringify(data);
        return CryptoJS.AES.encrypt(json, this.key).toString();
    }

    /**
     * Decrypts ciphertext string back to original data.
     */
    decrypt(ciphertext: string): any {
        try {
            const bytes = CryptoJS.AES.decrypt(ciphertext, this.key);
            const originalText = bytes.toString(CryptoJS.enc.Utf8);
            if (!originalText) {
                return null;
            }
            return JSON.parse(originalText);
        } catch (e) {
            console.error('Decryption failed', e);
            return null;
        }
    }

    /**
     * Generates an MD5 signature of the encrypted payload signed with the key.
     * Format: MD5(encryptedPayload + key)
     */
    sign(encryptedBody: string): string {
        return CryptoJS.MD5(encryptedBody + this.key).toString();
    }
}
