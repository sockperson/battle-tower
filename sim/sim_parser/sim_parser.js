const PS = require('pokemon-showdown');
const {Dex} = PS;

function getAllPossibleChoices(battle) {
    const requestedActions = getRequestedActions(battle);

    const out = {};
    //console.log("requestedActions: ", requestedActions);
    const requests = battle.getRequests();
    for (const [playerId, requestedAction] of Object.entries(requestedActions)) {
        //console.log(requestedAction);
        const playerRequest = requests.find(r => r.side.id === playerId);
        const playerSide = battle.sides.find(s => s.id === playerId);
        switch (requestedAction) {
            case "wait": {
                out[playerId] = [""];
                break;
            }
            case "team": {
                out[playerId] = ["team 123456"];
                break;
            }
            case "move": { // can move or switch
                //console.log("move req");
                const activeMoves = playerRequest.active;
                let ownActiveMoves = [];
                let canSwitch = true;
                if (activeMoves) {
                    //console.log(activeMoves);
                    ownActiveMoves = activeMoves[0].moves
                        .filter(move => move.disabled !== true).map(move => move.move);
                    canSwitch = (activeMoves[0].trapped !== true);
                }
                out[playerId] = ownActiveMoves.map(moveName => `move ${moveName}`);
                
                if (canSwitch) {
                    const pokemonList = playerSide.pokemon;
                    const nonFainted = pokemonList.filter(p => !p.fainted && !p.isActive);
                    const pokemonNames = nonFainted.map(p => p.set.species);
                    out[playerId] = out[playerId].concat(pokemonNames.map(name => `switch ${name}`));
                }
                break;
            }
            case "switch": {
                const pokemonList = playerSide.pokemon;
                const nonFainted = pokemonList.filter(p => !p.fainted && !p.isActive);
                const pokemonNames = nonFainted.map(p => p.set.species);
                out[playerId] = pokemonNames.map(name => `switch ${name}`);
                break;
            }
        }
        
    }
    return out;
}

// read game requests data and return a shorthand of valid actions
// input: battle object
// output: { p1: requestedAction, p2: requestedAction } 
// requestedAction: one of "move", "switch", "team", "wait"
// "move": player can pick a move or switch a pokemon out
// "switch": player is forced to switch (when their pokemon faints or uses a pivoting move)
// "team": player must pick their team for team preview
// "wait": player has no valid actions (must wait)
function getRequestedActions(battle) {
    if (battle.ended) {
        return { p1: "wait", p2: "wait" };
    }

    const requestState = battle.requestState;
    const requests = battle.getRequests(requestState);
    const p1request = requests.find(request => request.side.id === 'p1');
    const p2request = requests.find(request => request.side.id === 'p2');

    switch (requestState) {
        case 'teampreview':
            return {
                p1: 'team',
                p2: 'team'
            };
        case 'move':
            //console.log("request state move: " + JSON.stringify(battle.getRequests(requestState), null, 2));
            return {
                p1: "move",
                p2: "move"
            }
        case 'switch':
            //console.log("request state switch: " + JSON.stringify(battle.getRequests(requestState), null, 2));
            return {
                p1: p1request.wait ? "wait" : "switch",
                p2: p2request.wait ? "wait" : "switch"
            };
        default:
            console.log("this shouldn't reach in sim_parser.getRequestedAction(). requestState: " + requestState);
            return {
                p1: "wait",
                p2: "wait"
            }
    }
}

// given a pokemon object, sanitize sensitive info not meant to be seen by the user
// ex: hide foe pokemon abilities/items
// probably dont worry about this too much for now... might be important later on however
function sanitizePokemonEntry(poke) {
    if (!poke || typeof poke !== 'object') return poke;
    // deep-clone serializable data (drops methods and internal refs)
    const data = JSON.parse(JSON.stringify(poke));

    // list of sensitive properties to strip when not revealing
    const sensitive = [
        'ability', 'baseAbility', 'item'
    ];
    const setSensitive = [
        'ability', 'item', 'moves', 'bold', 'evs', 'ivs', 'nature'
    ]

    for (const key of sensitive) {
        if (key in data) delete data[key];
    }
    for (const key of setSensitive) {
        if (data.set && key in data.set) delete data.set[key];
    }
    if (data.set === undefined) {
        console.log("???");
    }

    return data;
}

// given the battle object, extract info that is important to both players
//
// weather conditions, turn count, win status, etc.
// basically information about the battle revealed to both players + spectators
function extractBattleInfo(battle) {
    return {
        ended: !!battle.ended, 
        turn: battle.turn, 
        winner: battle.winner, 
        log: battle.log.slice(-200) 
    }
}

// given the battle object, extract info that is important to one player
//
// own status (HP, status conditions, moves...)
// foe status (HP, status conditions, not moves...)
// basically information about the battle revealed to one side
function extractIndividualBattleInfo(battle, player) {
    if (player !== 'p1' && player !== 'p2') {
        return undefined; // invalid player
    }

    const ownSide = battle.sides.find(side => side.id === player);
    const foeSide = battle.sides.find(side => side.id !== player);

    const ownPokemon = ownSide.pokemon;
    const foePokemon = foeSide.pokemon.map(p => sanitizePokemonEntry(p));

    ownPokemon.forEach(p => {
        const name = p.set.species.toLowerCase();
        const gen = Dex.species.get(name)?.gen ?? 0;
        const metadata = p.metadata || {};
        metadata.imgName = name;
        metadata.gen = gen;
        p.metadata = metadata;
    });
    
    foePokemon.forEach(p => {
        const name = p.set.species.toLowerCase();
        const gen = Dex.species.get(name)?.gen ?? 0;
        const metadata = p.metadata || {};
        metadata.imgName = name;
        metadata.gen = gen;
        p.metadata = metadata;
    });
    const moveRequests = battle.getRequests("move");
    
    const ownActive = moveRequests.find(req => req.side.id === player).active;
    let ownActiveMoves = [];
    if (ownActive) {
        ownActiveMoves = ownActive[0].moves;
    }

    const foeActive = moveRequests.find(req => req.side.id !== player).active;
    let foeActiveMoves = [];
    if (foeActive) {
        foeActiveMoves = foeActive[0].moves;
    }

    return {
        ownPokemon: ownPokemon,
        foePokemon: foePokemon,
        ownActiveMoves: ownActiveMoves
    };
}

// some lines in the log are repeated twice, not sure why
function filterRedundantLogs(logs) {
    const out = [];
    let lastLine = 'not a real line';
    for (const line of logs) {
        if (line === lastLine) {
            continue; // skip redundant log
        }
        out.push(line);   
        lastLine = line;
    }
    return out;
}

// given log object, return the logs of the most recent x turns
function getRecentLogs(battle, turns, player = "p1") {
    // start at end of log, work backwards until a line starting with '|t:|' is found
    // return just those lines
    let turnCount = 0;
    const recentLogs = [];
    const filteredLogs = filterRedundantLogs(battle.log);
    for (let i = filteredLogs.length - 1; i >= 0; i--) {
        const line = filteredLogs[i];
        recentLogs.unshift(parseLogLine(line, player));
        if (line.startsWith('|t:|')) {
            turnCount++;
            if (turnCount >= turns) break;
        }
    }
    //console.log("recentLogs: ", recentLogs);
    return recentLogs.filter(entry => entry !== "");
}

// convert something like "p1a: Umbreon" to { isOwn: true, name: "Umbreon" }
function parsePokemonPosition(value, player) {
    const [id, name] = value.split(': ').map(part => part.trim());
    const isOwn = id.startsWith(player);
    return { isOwn, name };
}
function parsePokemonPosition3P(value) {
    const [id, name] = value.split(': ').map(part => part.trim());
    const isP1 = id.startsWith("p1");
    return { isP1, name };
}

const OPPOSING_POKEMON_PREFIX = "The opposing "

// wrap parsePokemonPosition
// either put "The opposing {pokemonName}" or "{pokemonName}" based on player
function getPokemonOwnerStrings(line, player, needsCapitalization = true) {
    const pos = parsePokemonPosition(line, player);
    if (pos.isOwn) {
        return {
            ownerPrefix: '',
            pokemonName: pos.name
        };
    } else {
        return {
            ownerPrefix: needsCapitalization ?
                OPPOSING_POKEMON_PREFIX : OPPOSING_POKEMON_PREFIX.toLowerCase(),
            pokemonName: pos.name
        }
    }
}

const ignoredHeaders = [
    "", "t:", "gametype", "teamsize", "gen", "clearpoke", "poke", "teampreview",
    "start", "split", "upkeep", "debug"
]

// map status short name to label name
// "brn" ---> "BURN"
function mapStatusName(status) {
    switch (status) {
        case "brn":
            return "BURN";
        case "psn":
            return "POISON";
        case "tox":
            return "TOXIC";
        case "slp":
            return "SLEEP";
        case "par":
            return "PARALYSIS";
        case "frz":
            return "FROZEN";
    }
    return status;
}

// map stat short name to full name
function mapStatName(stat) {
    switch (stat) {
        case "atk":
            return "Attack";
        case "def":
            return "Defense";
        case "spa":
            return "Special Attack";
        case "spd":
            return "Special Defense";
        case "spe":
            return "Speed";
        case "acc":
            return "Accuracy";
        case "eva":
            return "Evasion";
    }
    console.log("unknown stat name: " + stat);
    return stat;
}

const cantCauses = {
    slp: "BATTLE_CANT_SLEEP",
    frz: "BATTLE_CANT_FROZEN"
}

function parseLogLine(line, player) {
    try {
        if (!line.startsWith('|')) {
            return ''; // invalid line
        }
        const parts = line.slice(1).split('|');

        let header = parts[0];

        if (ignoredHeaders.includes(header)) {
            return '';
        }
        switch (header) {
            case 'turn': // |turn|1
                return {
                    header: "BATTLE_TURN",
                    args: [
                        parts[1] // turn number
                    ]
                };
            case 'move': { // |move|p1a: Umbreon|Wish|p1a: Umbreon
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                return {
                    header: "BATTLE_USE_MOVE",
                    args: [
                        ownerStrings.ownerPrefix,
                        ownerStrings.pokemonName,
                        parts[2] // move name
                    ]
                };
            }
            case 'switch': { // |switch|p1a: Sylveon|Sylveon, M|394/394
                const pokemonPosition3P = parsePokemonPosition3P(parts[1], player);
                const playerName = pokemonPosition3P.isP1 ? "P1" : "P2"; // TODO use real player names
                return {
                    header: "BATTLE_SWITCH_POKEMON",
                    args: [
                        playerName,
                        pokemonPosition3P.name
                    ]
                };
            }
            case '-status': { // |-status|p1a: Umbreon|slp
                const statusOwnerStrings = getPokemonOwnerStrings(parts[1], player);
                const status = parts[2];
                return {
                    header: `BATTLE_APPLY_${mapStatusName(status)}`,
                    args: [
                        statusOwnerStrings.ownerPrefix,
                        statusOwnerStrings.pokemonName
                    ]
                };
            }
            case "-curestatus": { // |-curestatus|p1a: Vaporeon|slp|[msg]
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                const status = parts[2];
                return {
                    header: `BATTLE_CURE_${mapStatusName(status)}`,
                    args: [
                        ownerStrings.ownerPrefix,
                        ownerStrings.pokemonName
                    ]
                };
            }
            case "fail": {
                return {
                    header: "BATTLE_FAIL_MOVE",
                    args: []
                };
            }
            case "-boost": { // |-boost|p1a: Vaporeon|spa|1
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                const statName = mapStatName(parts[2]);
                const boostAmount = parseInt(parts[3]);
                let statHeader = "BATTLE_BOOST_STAT_DRASTICALLY";
                switch (boostAmount) {
                    case 1:
                        statHeader = "BATTLE_BOOST_STAT_NORMAL";
                        break;
                    case 2:
                        statHeader = "BATTLE_BOOST_STAT_SHARPLY";
                        break;
                    case 0: // no boost, probably capped
                        statHeader = "BATTLE_BOOST_STAT_CAPPED";
                        break;
                }
                return {
                    header: statHeader,
                    args: [
                        ownerStrings.ownerPrefix,
                        ownerStrings.pokemonName,
                        statName
                    ]
                };
            }
            case "-unboost": { // |-unboost|p1a: Vaporeon|spa|1
                ownerStrings = getPokemonOwnerStrings(parts[1], player);
                const statName = mapStatName(parts[2]);
                const boostAmount = parseInt(parts[3]);
                let statHeader = "BATTLE_UNBOOST_STAT_SEVERELY";
                switch (boostAmount) {
                    case 1:
                        statHeader = "BATTLE_UNBOOST_STAT_NORMAL";
                        break;
                    case 2:
                        statHeader = "BATTLE_UNBOOST_STAT_HARSHLY";
                        break;
                    case 0:
                        statHeader = "BATTLE_UNBOOST_STAT_CAPPED";
                        break;
                }
                return {
                    header: statHeader,
                    args: [
                        ownerStrings.ownerPrefix,
                        ownerStrings.pokemonName,
                        statName
                    ]
                };
            }
            case "-resisted": {
                return { header: "BATTLE_RESISTED_MOVE", args: [] }
            }
            case "-supereffective": { 
                return { header: "BATTLE_SUPER_EFFECTIVE_MOVE", args: [] }
            }
            case "-crit": { 
                return { header: "BATTLE_CRIT_MOVE", args: [] }
            }
            case "-immune": { // |-immune|p1a: Umbreon
                const ownerStrings = getPokemonOwnerStrings(parts[1], player, false);
                return {
                    header: "BATTLE_IMMUNE_MOVE",
                    args: [ ownerStrings.ownerPrefix, ownerStrings.pokemonName ]
                }
            }
            case "-fail": { // |-fail|p2a: Clodsire
                return {
                    header: "BATTLE_FAIL_MOVE",
                    args: []
                }
            }
            case "-start": { // |-start|p2a: Umbreon|move: Yawn|[of] p1a: Espeon
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                const status = parts[2].split(": " )[1];
                switch (status) {
                    case "Yawn":
                        return {
                            header: "BATTLE_APPLY_YAWN",
                            args: [ ownerStrings.ownerPrefix, ownerStrings.pokemonName ]
                        }
                    case "Leech Seed":
                        return {
                            header: "BATTLE_APPLY_LEECH_SEED",
                            args: [ ownerStrings.ownerPrefix, ownerStrings.pokemonName ]
                        }
                }
                
                console.log("unhandled start status: " + status);
                return {
                    header: '',
                    args: [ line ]
                }
            }
            case "faint": {
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                return {
                    header: "BATTLE_FAINT_POKEMON",
                    args: [ ownerStrings.ownerPrefix, ownerStrings.pokemonName ]
                }
            }
            case "cant": {
                const ownerStrings = getPokemonOwnerStrings(parts[1], player);
                const cause = parts[2];
                if (cause in cantCauses) {
                    return {
                        header: cantCauses[cause],
                        args: [ ownerStrings.ownerPrefix, ownerStrings.pokemonName ]
                    }
                } else {
                    return { // unhandled cant cause
                        header: '',
                        args: [ line ]
                    }
                }
            }
        }

        return { // unhandled log lines will just print as normal
            header: '', // empty headers will print the first and only arg
            args: [ line ]
        }
    } catch (e) {
        console.error("Error parsing log line: " + line, e);
        return '';
    }
}

module.exports = {
    getRequestedAction: getRequestedActions,
    sanitizePokemonEntry,
    extractBattleInfo,
    extractIndividualBattleInfo,
    getRecentLogs,
    parseLogLine,
    getAllPossibleChoices
};