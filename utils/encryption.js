const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your_32_byte_encryption_key_here_1234567890123456';

const encrypt = (text) => {
  if (!text) return null;
  try {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
};

const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || ciphertext;
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext;
  }
};

const encryptedField = {
  type: String,
  set: encrypt,
  get: decrypt,
  default: null
};

module.exports = { encrypt, decrypt, encryptedField };