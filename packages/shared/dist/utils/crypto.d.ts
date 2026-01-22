export declare class CryptoService {
    private key;
    constructor(key: string);
    /**
     * Encrypts data (object or string) into a ciphertext string.
     * Uses AES-256 (via crypto-js default string passphrase handling).
     */
    encrypt(data: any): string;
    /**
     * Decrypts ciphertext string back to original data.
     */
    decrypt(ciphertext: string): any;
    /**
     * Generates an MD5 signature of the encrypted payload signed with the key.
     * Format: MD5(encryptedPayload + key)
     */
    sign(encryptedBody: string): string;
}
