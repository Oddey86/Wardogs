// Curated Season 3 facts; no third-party artwork or scraped databases are bundled.
// Exact anchors were cross-checked against the cited public Season 3 review.
export const sources = {
  official: 'https://store.steampowered.com/news/app/1867240/view/688648135317127221',
  review: 'https://wdstats.co.uk/season-3',
};

export const roles = ['Assault', 'Medic', 'Support', 'Recon', 'Driver', 'Pilot'];
export const anchors = [[0, 0], [10, 36750], [20, 275000], [28, 530750], [50, 1950000], [100, 6600000]];

// Linear interpolation between *verified cumulative thresholds* is an explicit
// planning estimate, never represented as an exact in-game level requirement.
export function threshold(level) {
  const safe = Math.max(0, Math.min(100, Math.floor(Number(level) || 0)));
  const exact = anchors.find(([n]) => n === safe);
  if (exact) return { xp: exact[1], exact: true };
  const upper = anchors.findIndex(([n]) => n > safe);
  const [lo, loXP] = anchors[upper - 1];
  const [hi, hiXP] = anchors[upper];
  return { xp: Math.round(loXP + (hiXP - loXP) * (safe - lo) / (hi - lo)), exact: false };
}

// Explicitly verified Season 3 unlock routes, not a complete item database.
// Alternative shared-item routes may exist, so one entry is not an exclusive route.
const records = [
  ['Assault','C4 Charge',5,'Attachment'], ['Assault','Remote Detonator',5,'Equipment'], ['Assault','Molotov Cocktail',8,'Equipment'],
  ['Medic','Holographic Sight',7,'Attachment'], ['Medic','Stim Pen',17,'Equipment'], ['Medic','Super-45 Flash Hider',37,'Attachment'],
  ['Recon','Compound Bow',15,'Weapon'], ['Recon','AMR 50',41,'Weapon'], ['Recon','Deadeye Flash Hider',8,'Attachment'], ['Recon','Ghillie Suit (Dead)',50,'Equipment'], ['Recon','Ghillie Headwear (Dead)',50,'Equipment'],
  ['Support','RPG-7',5,'Weapon'], ['Support','9K333 Verba',8,'Weapon'], ['Support','Large Hammer',14,'Equipment'], ['Support','M249 Bipod',23,'Attachment'],
  ['Pilot','Ride of the Valkyries',33,'Equipment'],
  ['Wardog','Level 1 Armor',8,'Equipment'], ['Wardog','Field Backpack',10,'Equipment'], ['Wardog','Medium Backpack',25,'Equipment'],
  ['Wardog','Parachute',45,'Equipment'], ['Wardog','Level 2 Armor',50,'Equipment'], ['Wardog','Level 3 Armor',150,'Equipment'],
  ['Wardog','Level 4 Armor',180,'Equipment'], ['Wardog','GGX 17',20,'Weapon'], ['Wardog','GGX 18',110,'Weapon'],
];
export const unlocks = records.map(([role, name, level, type], i) => ({ id: i, role, name, level, type }));

// Customizable user assumptions, not publisher-confirmed Season 3 rewards.
export const actions = [
  { id: 'combat', name: 'Combat / objectives', role: 'Assault', xp: 600 },
  { id: 'heal', name: 'Healing / revives', role: 'Medic', xp: 450 },
  { id: 'logistics', name: 'Supplies / construction', role: 'Support', xp: 750 },
  { id: 'spot', name: 'Spotting / long-range', role: 'Recon', xp: 350 },
  { id: 'ground', name: 'Ground transport', role: 'Driver', xp: 650 },
  { id: 'air', name: 'Air transport', role: 'Pilot', xp: 500 },
];
