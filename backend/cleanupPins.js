const axios = require("axios");
require('dotenv').config();

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

if (!PINATA_API_KEY || !PINATA_SECRET) {
  console.error("❌ Error: Pinata API keys missing in .env");
  process.exit(1);
}

const headers = {
  pinata_api_key: PINATA_API_KEY,
  pinata_secret_api_key: PINATA_SECRET,
};

// Get all pinned items (with pagination)
async function getAllPins() {
  let allPins = [];
  let pageOffset = 0;
  const pageLimit = 1000;

  try {
    while (true) {
      // 🔍 Filter by status=pinned to only get active pins
      const res = await axios.get(
        `https://api.pinata.cloud/data/pinList?pageLimit=${pageLimit}&pageOffset=${pageOffset}&status=pinned`,
        { headers }
      );

      const pins = res.data.rows;
      if (!pins || pins.length === 0) break;

      allPins.push(...pins);
      pageOffset += pageLimit;

      console.log(`Fetched ${allPins.length} pins...`);
    }

    return allPins;
  } catch (err) {
    console.error("❌ Error fetching pins:", err.response?.data || err.message);
    return [];
  }
}

// Unpin one CID
async function unpinCID(cid) {
  await axios.delete(
    `https://api.pinata.cloud/pinning/unpin/${cid}`,
    { headers }
  );
}

// Delete all pins (with deduplication and better error handling)
async function deleteAllPins() {
  console.log("🔍 Fetching active pins from Pinata...");
  const rawPins = await getAllPins();

  if (rawPins.length === 0) {
    console.log("✨ No active pins found to delete.");
    return;
  }

  // 🧩 Deduplicate CIDs (Some pins might be duplicates)
  const uniqueCIDs = [...new Set(rawPins.map(p => p.ipfs_pin_hash))];
  console.log(`🗑️ Total unique CIDs to unpin: ${uniqueCIDs.length}`);

  for (let i = 0; i < uniqueCIDs.length; i++) {
    const cid = uniqueCIDs[i];

    try {
      await unpinCID(cid);
      console.log(`[${i + 1}/${uniqueCIDs.length}] Unpinned: ${cid}`);
    } catch (err) {
      // ⚠️ Handle cases where CID is already gone
      if (err.response?.status === 404 || err.response?.status === 400) {
        console.warn(`[${i + 1}/${uniqueCIDs.length}] CID ${cid} already unpinned/not found.`);
      } else {
        console.error(`[${i + 1}/${uniqueCIDs.length}] ❌ Error unpinning ${cid}:`, err.response?.data || err.message);
      }
    }

    // ⏱️ delay to avoid rate limit (strict limit is usually 30 req/min for some plans)
    // Using 500ms for extra safety
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("✅ Forensic storage cleanup complete.");
}

deleteAllPins();
