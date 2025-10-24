// team_gen.js
// Helpers for loading and selecting sets from sets.json
const path = require('path');

// Load pokemon-showdown
const PS = require('pokemon-showdown');
const {Dex} = PS;

// Load the JSON file. Using require will cache and parse it as an object.
const sets = require(path.join(__dirname, 'sets.json'));
const sets_easy = require(path.join(__dirname, 'sets_easy.json'));
const trainers = require(path.join(__dirname, 'trainers.json'));


// Looks up a species entry by name (case-insensitive).
// 
// Input:
// speciesName: string - species name to look up
// Output:
// returns the object { species, sets } or null if not found.
function findSpecies(speciesName, pkmnListName) {
	if (!speciesName) return null;
	const id = String(speciesName).toLowerCase();

    let pkmnSets = [];
    switch (pkmnListName) {
        case "sets_easy":
            pkmnSets = sets_easy;
            break;
        default:
            pkmnSets = sets;
            break;
    }

	const out = pkmnSets.find((entry) => String(entry.species).toLowerCase() === id) || null;
    if (!out) {
        console.log(`Species ${speciesName} not found in list ${pkmnListName}`);
    }
    return out;
}

// Parses strings of format "(n,n...) name1, name2, ...", "name1, name2, ...", "name1"
//
// Input: formatted string
// Output: 
// Returns an array of { item: string, weight: number }
function parseWeightedList(input) {
  if (!input && input !== '') return [];
  if (Array.isArray(input)) {
    // already an array: treat each entry as weight 1
    return input.map(it => ({ item: String(it).trim(), weight: 1 }));
  }
  input = String(input).trim();

  // regex: capture leading parenthesized list of integers, then the rest
  const regex = input.match(/^\s*\((\s*\d+\s*(?:,\s*\d+\s*)*)\)\s*(.+)$/);
  if (regex) {
    const weights = regex[1].split(/\s*,\s*/).map(s => {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
    const rest = regex[2];
    const items = rest.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);

    // If the weight array is shorter than items, missing weights default to 1.
    // If longer, extra weights are ignored.
    const parsed = items.map((it, idx) => {
      const w = Number.isFinite(weights[idx]) ? weights[idx] : 1;
      return { item: it, weight: Math.max(0, Number(w) || 0) };
    });

    // If all weights are 0, fall back to equal weights.
    const total = parsed.reduce((s, x) => s + x.weight, 0);
    if (!total) {
      return parsed.map(x => ({ item: x.item, weight: 1 }));
    }
    return parsed;
  }

  // No explicit weights: split by commas and give equal weight (1) to each.
  const items = input.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean);
  if (items.length === 0) return [];
  return items.map(it => ({ item: it, weight: 1 }));
}

// Weighted random pick from parsed list [{item, weight}, ...]
function weightedPick(parsedList) {
  if (!parsedList || !parsedList.length) return null;       // return null if empty
  if (parsedList.length === 1) return parsedList[0].item;   // return the only item
  const total = parsedList.reduce((s, i) => s + (Number(i.weight) || 0), 0);
  if (total <= 0) {
    // fallback to uniform random
    const idx = Math.floor(Math.random() * parsedList.length);
    return parsedList[idx].item;
  }
  let r = Math.random() * total;
  for (const p of parsedList) {
    if (r < p.weight) return p.item;
    r -= p.weight;
  }
  return parsedList[parsedList.length - 1].item; // fallback
}

// Get a specific set object for a species by set id (numeric index or id field).
// If setId is omitted, returns a random set for the species.
function getSetForSpecies(speciesName, pkmnListName, setId) {
	const entry = findSpecies(speciesName, pkmnListName);
	if (!entry) return null;
    // Select the set (by random, index, or id) and attach the species once.
    let out = null;
    if (setId === undefined || setId === null) {
        // random set
        const idx = Math.floor(Math.random() * entry.sets.length);
        out = entry.sets[idx] || null;
    } else {
        // try numeric index first, then fall back to searching by set.id
        out = entry.sets[Number(setId)] || entry.sets.find((s) => String(s.id) === String(setId)) || null;
    }
    if (out) out.species = entry.species;
    return out;
}

// return some metadata about a Pokemon's moveset to determine EVs/IVs/nature better
// Input: Pokemon moves array
// Output:
// usesAtkStat: true if any move uses Atk stat (any physical moves not Foul Play)
// usesSpAStat: true if any move uses SpA stat (any special moves)
// onlyWeakPhysicalMoves: true if all physical moves are "weak" (<= 60 power)
// onlyWeakSpecialMoves: true if all special moves are "weak" (<= 60 power)
// ^ makes sure sets like Sylveon with only Quick Attack as its physical move use Atk reducing nature
function getMovesetMetadata(moves) {
    let usesAtkStat = false;
    let usesSpAStat = false;
    let onlyWeakPhysicalMoves = true;
    let onlyWeakSpecialMoves = true;

    for (const moveName of moves) {
        const psMove = Dex.moves.get(moveName);
        if (psMove && psMove.category === 'Physical' && psMove.id !== 'foulplay') {
            usesAtkStat = true;
            if (psMove.basePower > 60) {
                onlyWeakPhysicalMoves = false;
            }
        } else if (psMove.category === 'Special') {
            usesSpAStat = true;
            if (psMove.basePower > 60) {
                onlyWeakSpecialMoves = false;
            }
        }
    }
    return {
        usesAtkStat,
        usesSpAStat,
        onlyWeakPhysicalMoves,
        onlyWeakSpecialMoves
    }
}

// Return pokemon-showdown EV spread and nature from string
// H,A,B,C,D,S represent HP, Atk, Def, SpA, SpD, Spe respectively.
// 252 EVs go into the stat of each character in the string.
// remaining 4 EVs will try to go into the order of HP, Spe, Def

// Nature is determined by the following...
// 1. Boost the stat according to the first non-H character in the string
// "HC" --> boost SpA, "AS" -> boost Atk
// 2. Decrease the stat according to the following critera
// a. Moveset has no moves using Atk stat --> Decrease Atk
// b. Moveset has no moves using SpA stat --> Decrease SpA
// c. Moveset only has "weak" physical moves --> Decrease Atk
// d. Moveset only has "weak" special moves --> Decrease SpA
// e. --> Decrease SpD
function parseSpread(spreadStr, moves) {
  if (!spreadStr) {
    return { nature: 'Hardy', evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 } };
  }
  const chars = Array.from(String(spreadStr));
    let nature = 'Hardy';
    const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

    let increasedStat = '';
    let decreasedStat = '';

    for (const ch of chars) {
        switch (ch.toUpperCase()) {
            case 'H':
                evs.hp = 252;
                break;
            case 'A':
                evs.atk = 252;
                increasedStat = increasedStat === '' ? 'A' : increasedStat;
                break;
            case 'B':
                evs.def = 252;
                increasedStat = increasedStat === '' ? 'B' : increasedStat;
                break;
            case 'C':
                evs.spa = 252;
                increasedStat = increasedStat === '' ? 'C' : increasedStat;
                break;
            case 'D':
                evs.spd = 252;
                increasedStat = increasedStat === '' ? 'D' : increasedStat;
                break;
            case 'S':
                evs.spe = 252;
                increasedStat = increasedStat === '' ? 'S' : increasedStat;
                break;
        }
    }

    // Determine decreased stat using moveset metadata and rules described above
    const meta = getMovesetMetadata(moves || []);
    const usesAtkStat = meta.usesAtkStat;
    const usesSpAStat = meta.usesSpAStat;
    const onlyWeakPhysical = meta.onlyWeakPhysicalMoves;
    const onlyWeakSpecial = meta.onlyWeakSpecialMoves;

    if (!usesAtkStat) {
        decreasedStat = 'A';
    } else if (!usesSpAStat) {
        decreasedStat = 'C';
    } else if (onlyWeakPhysical && !onlyWeakSpecial) {
        decreasedStat = 'A';
    } else if (onlyWeakSpecial && !onlyWeakPhysical) {
        decreasedStat = 'C';
    } else {
        // default to lowering SpD for mixed or unclear cases
        decreasedStat = 'D';
    }

    // Map increased/decreased letter codes to PS stat keys
    const codeToStat = { H: 'hp', A: 'atk', B: 'def', C: 'spa', D: 'spd', S: 'spe' };
    const incStatKey = codeToStat[increasedStat] || null;
    const decStatKey = codeToStat[decreasedStat] || null;

    // Attempt to find a matching nature name via Dex if available
    function findNatureName(incKey, decKey) {
        try {
            const data = Dex && Dex.data ? Dex.data : Dex;
            if (data && data.Natures) {
                for (const [name, val] of Object.entries(data.Natures)) {
                    if (val.plus === incKey && val.minus === decKey) return name;
                }
            } else if (Dex && Dex.natures) {
                for (const [name, val] of Object.entries(Dex.natures)) {
                    if (val.plus === incKey && val.minus === decKey) return name;
                }
            }
        } catch (e) {
            // ignore
        }
        return null;
    }

    const foundNature = findNatureName(incStatKey, decStatKey);
    if (foundNature) {
        nature = foundNature;
    } else if (incStatKey && decStatKey) {
        // fallback: map some common combos to names using a minimal table
        const fallback = {
            'atk:spd': 'Adamant',
            'spa:spd': 'Modest',
            'spa:atk': 'Modest',
            'atk:spa': 'Adamant',
            'spd:atk': 'Calm',
            'spd:spa': 'Careful',
        };
        const key = `${incStatKey}:${decStatKey}`;
        if (fallback[key]) nature = fallback[key];
    }



    // distribute remaining 4 EVs into preferred order: HP, Spe, Def (per file header)
    const remainingOrder = ['hp', 'spe', 'def'];
    // Count how many EV slots are already occupied with 252; remaining EVs are 508 total available but in this scheme
    // we only placed 252 per letter; collect how many stats have 252 and give remaining 4 to the first available in order
    let allocated = Object.values(evs).reduce((s, v) => s + v, 0);
    let remaining = Math.max(0, 508 - allocated); // 508 is 252*2 + 4 fallback but using safe cap
    // Instead of trying to be too strict, give up to 4 EVs distributed as 4,0,0 in order if that stat currently has 0
    let leftToAssign = 4;
    for (const k of remainingOrder) {
        if (leftToAssign <= 0) break;
        if (evs[k] === 0) {
            evs[k] = Math.min(252, leftToAssign);
            leftToAssign -= evs[k];
        }
    }

    return {
        nature,
        evs
    }
}

// Return a minimal Pokemon Showdown set object suitable for Teams: {species, ability, item, moves, evs/ivs optional}
function toPSSet(setObj) {
	if (!setObj) return null;

    const weightedAbilities = parseWeightedList(setObj.ability);
    const abilityPick = weightedPick(weightedAbilities);

    const weightedItems = parseWeightedList(setObj.item);
    const itemPick = weightedPick(weightedItems);

    const pickedMoves = [];
    if (Array.isArray(setObj.moves)) {
        for (const move of setObj.moves) {
            const weightedMove = parseWeightedList(move);
            const movePick = weightedPick(weightedMove);
            pickedMoves.push(movePick);
        }
    }

    const spread = parseSpread(setObj.spread, pickedMoves);
    const usesAtkStat = getMovesetMetadata(pickedMoves).usesAtkStat;
    const atkIVs = usesAtkStat ? 31 : 0;
	return {
		species: setObj.species || setObj.name || undefined,
		ability: abilityPick,
		item: itemPick,
		moves: pickedMoves,
        nature: spread.nature,
		evs: spread.evs,
        ivs: { hp: 31, atk: atkIVs, def: 31, spa: 31, spd: 31, spe: 31 },
        role: setObj.role || undefined
	};
}

// Generate a trainer's team
// TODO obey Item Clause
// TODO validations
function generateTrainerTeam(trainerName, size) {
    const trainer = trainers.find(t => t.name.toLowerCase() === String(trainerName).toLowerCase());
    if (!trainer) return [];
    const out = [];

    const isDoublesMode = false;
    let pkmnListName = "sets";
    switch (trainer.difficulty) {
        case "noob":
            pkmnListName = "sets_easy";
            break;
    }

    // copy trainer.team into a local pool so we don't mutate original trainer data
    const pool = Array.isArray(trainer.team) ? trainer.team.slice() : [];
    for (let i = 0; i < size; i++) {
        if (pool.length === 0) break; // nothing left to pick
        // build weighted list from current pool
        const weightedSpecies = pool.map(p => ({ item: p.species, weight: p.weight || 1 }));
        const speciesPick = weightedPick(weightedSpecies);
        if (!speciesPick) break;
        const set = getSetForSpecies(speciesPick, pkmnListName);
        if (set) out.push(toPSSet(set));
        // remove the first matching species from pool to avoid duplicates
        const idx = pool.findIndex(p => String(p.species) === String(speciesPick));
        if (idx >= 0) pool.splice(idx, 1);
    }

    return out;
}

// Demo when run directly
if (require.main === module) {
    // generate a team
    const trainerTeam = generateTrainerTeam('Penny', 6);
    console.log('Generated team for Penny:');
    console.log(JSON.stringify(trainerTeam, null, 2));

    const trainerTeam2 = generateTrainerTeam('Red', 6);
    console.log('Generated team for Red:');
    console.log(JSON.stringify(trainerTeam2, null, 2));
}

// Exports
module.exports = {
	sets,
	findSpecies,
	getSetForSpecies,
	toPSSet,
    generateTrainerTeam,
};
