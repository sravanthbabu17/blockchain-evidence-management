/**
 * Blockchain verification service (frontend)
 * 
 * Routes queries through the local backend (/api/verify/:cid)
 * instead of connecting directly to Sepolia RPC from the browser.
 * This avoids CORS issues with public RPC endpoints.
 */

const BACKEND_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

/**
 * Find an on-chain record by its IPFS CID.
 * Calls GET /api/verify/:cid on the backend, which uses Alchemy.
 *
 * @param {string} cid - The IPFS CID to search for
 * @param {function} onProgress - Optional progress callback (unused, kept for API compat)
 * @returns {object|null} - The matching on-chain record or null
 */
export async function findByCID(cid, onProgress) {
    const encoded = encodeURIComponent(cid.trim());
    const res = await fetch(`${BACKEND_URL}/api/verify/${encoded}`);

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Server error ${res.status}`);
    }

    const data = await res.json();

    if (!data.success) {
        throw new Error(data.message || 'Verification failed');
    }

    if (!data.found) {
        return null;  // CID not found on blockchain
    }

    return data.record;  // { index, cid, jsonHash, vehicleId, timestamp, uploadedBy }
}
