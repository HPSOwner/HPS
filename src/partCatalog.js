// Flavor metadata for the 3D blueprint viewer's clickable parts. Display names and patent
// references are grounded in real research; serial numbers and manufacture dates are
// deterministic per-part flavor text for entertainment, generated (not random each click)
// from a simple string hash so the same part always shows the same info.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function serial(prefix, partKey) {
  const h = hash(prefix + partKey);
  const digits = (h % 90000) + 10000;
  const letter = String.fromCharCode(65 + (h % 26));
  return `${prefix}-${digits}-${letter}`;
}

function dateMade(partKey, yearStart, yearEnd) {
  const h = hash('date' + partKey);
  // Unsigned shifts (>>>) throughout — h can exceed 2^31, and a signed >> would flip
  // the sign on those values, producing negative days/months (e.g. "-22 undefined").
  const year = yearStart + (h % (yearEnd - yearStart + 1));
  const month = 1 + ((h >>> 8) % 12);
  const day = 1 + ((h >>> 16) % 28);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${String(day).padStart(2, '0')} ${months[month - 1]} ${year}`;
}

// match: regex tested against the mesh/parent node name. patentRef: real reference
// numeral from the cited patent drawing where one genuinely applies, else null.
const CATALOGS = {
  glock19: {
    serialPrefix: 'GLK19',
    yearRange: [1988, 2019], // real G19 production start (1988) to a plausible recent year
    patent: 'US 4,539,889',
    // Verified against the actual patent drawing (Fig. 1, Sheet 1): "1" labels the frame,
    // "2" labels the slide, with the trigger (63), connector bar (64) and grip (76) called
    // out on the frame half, and the firing pin/extractor group (26, 35, 36 — Fig. 7)
    // inside the slide. Only two real parts exist post-split (frame, slide+barrel fused),
    // so that's what's clickable — no invented sub-parts.
    entries: [
      { match: /^frame$/i, name: 'FRAME', patentRef: '1 (grip 76)' },
      { match: /slide_barrel/i, name: 'SLIDE / BARREL ASSEMBLY', patentRef: '2 (firing pin 26, extractor 35/36)' },
      { match: /^trigger$/i, name: 'TRIGGER / TRIGGER GUARD', patentRef: '63, connector 64' },
      // Not a patent figure — the official factory Gen5 parts diagram's item numbers
      // (tube 32, spring 30, floorplate 31, follower 29), reused in this field since
      // every other entry displays a reference the same way.
      { match: /^magazine$/i, name: 'MAGAZINE', patentRef: 'Gen5 parts #29-32' },
    ],
  },
  mp5: {
    serialPrefix: 'HKMP5',
    yearRange: [1966, 1999], // real MP5 production window
    patent: 'US 3,283,435',
    entries: [
      // Handguard must be checked before Receiver: both share the same empty parent
      // node ("Receiver_low"), and Receiver's rule matches on that shared parent name
      // as a fallback — first match wins, so Handguard needs to win on its own exact
      // part name before that broader Receiver fallback gets a chance to fire.
      // Found via connectivity scan, not a patent figure — matches assembly group "V.
      // Handguard" in the official Teufelshund Tactical MP5 armorer-course diagram.
      { match: /^Handguard_low$/i, name: 'HANDGUARD', patentRef: null },
      { match: /Bolt_low/i, name: 'BOLT CARRIER GROUP', patentRef: '1' },
      { match: /Trigger_low/i, name: 'TRIGGER GROUP', patentRef: null },
      { match: /^CH_low/i, name: 'COCKING HANDLE', patentRef: null },
      { match: /^Receiver_low$/i, name: 'RECEIVER HOUSING', patentRef: '8' },
      { match: /Barrel_low/i, name: 'BARREL', patentRef: null },
      { match: /Stock_low/i, name: 'BUTTSTOCK', patentRef: null },
      { match: /Mag_low/i, name: 'MAGAZINE (30RD)', patentRef: null },
      { match: /FS_low/i, name: 'FRONT SIGHT POST', patentRef: null },
    ],
  },
};

export function getPartInfo(weaponKey, partName, parentName) {
  const catalog = CATALOGS[weaponKey];
  if (!catalog) return null;
  const entry = catalog.entries.find((e) => e.match.test(partName) || e.match.test(parentName));
  if (!entry) return null;
  const key = parentName || partName;
  return {
    name: entry.name,
    serial: serial(catalog.serialPrefix, key),
    made: dateMade(key, catalog.yearRange[0], catalog.yearRange[1]),
    patent: catalog.patent,
    patentRef: entry.patentRef,
  };
}
