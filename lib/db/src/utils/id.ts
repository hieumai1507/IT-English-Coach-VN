import { customAlphabet } from "nanoid";

export const ID_LENGTH = 16;
export const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Generate a custom NanoID for database primary keys.
 * Format: 16 characters, uppercase alphanumeric.
 */
export const generateId = customAlphabet(ALPHABET, ID_LENGTH);
