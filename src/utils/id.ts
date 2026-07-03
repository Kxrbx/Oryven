import { customAlphabet } from "nanoid";

// URL-safe, no ambiguous chars (no 0/O, 1/I)
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
const nano = customAlphabet(alphabet, 10);

export function newId(prefix?: string): string {
  return prefix ? `${prefix}_${nano()}` : nano();
}
