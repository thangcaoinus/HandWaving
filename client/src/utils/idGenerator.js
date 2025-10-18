/**
 * Unique ID generator with collision protection
 * Handles rapid generation and multi-user scenarios
 */

let idCounter = 0;

/**
 * Generate a unique ID with collision protection
 * Format: prefix_timestamp_random_counter
 * 
 * @param {string} prefix - ID prefix (e.g., 'stroke', 'op', 'imported')
 * @param {string} userId - Optional user ID for multi-user uniqueness
 * @returns {string} Unique ID
 */
export function generateUniqueId(prefix = 'id', userId = null) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9); // 7 chars
  const counter = (idCounter++).toString(36);
  
  // Reset counter at a high number to prevent overflow
  if (idCounter > 100000) {
    idCounter = 0;
  }
  
  if (userId) {
    // Include first 8 chars of userId for multi-user uniqueness
    const userPrefix = userId.substring(0, 8);
    return `${prefix}_${userPrefix}_${timestamp}_${random}_${counter}`;
  }
  
  return `${prefix}_${timestamp}_${random}_${counter}`;
}

/**
 * Generate a batch of unique IDs efficiently
 * All IDs share timestamp/random, differ only by counter
 * 
 * @param {number} count - Number of IDs to generate
 * @param {string} prefix - ID prefix
 * @param {string} userId - Optional user ID
 * @returns {string[]} Array of unique IDs
 */
export function generateUniqueIdBatch(count, prefix = 'id', userId = null) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  const ids = [];
  
  for (let i = 0; i < count; i++) {
    const counter = (idCounter++).toString(36);
    
    if (idCounter > 100000) {
      idCounter = 0;
    }
    
    if (userId) {
      const userPrefix = userId.substring(0, 8);
      ids.push(`${prefix}_${userPrefix}_${timestamp}_${random}_${counter}`);
    } else {
      ids.push(`${prefix}_${timestamp}_${random}_${counter}`);
    }
  }
  
  return ids;
}

/**
 * Legacy ID generator for backward compatibility
 * Less collision-safe than generateUniqueId
 */
export function generateLegacyId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
