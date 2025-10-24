// given some input, validate it
// also return some info about why it is invalid if so
function validateInput(input, requestedAction, player, battle) {
    if (requestedAction === "wait" && input !== '') {
        return {
            isValid: false,
            msg: "No valid moves available, input must be empty"
        }
    }

    const args = String(input).trim().split(/\s+/);
    const cmd = (args[0] || '').toLowerCase();

    const requests = battle.getRequests();
    const req = Array.isArray(requests) ? requests.find(r => r && r.side && r.side.id === player) 
        : (requests && requests.side && requests.side.id === player ? requests : undefined);

    if (requestedAction === "team") {
        // must start with the word 'team' (case-insensitive)
        if (cmd !== 'team') return {
            isValid: false,
            msg: "Expected 'team' command for team preview"
        };
        // require exactly one argument after 'team'
        if (args.length !== 2) return {
            isValid: false,
            msg: "Expected exactly one argument after 'team'"
        }
        const code = args[1];
        // must be exactly six characters from 1..6
        if (!/^[1-6]{6}$/.test(code)) return {
            isValid: false,
            msg: "Team code must be exactly six digits from 1 to 6"
        }

        // digits must be unique (no duplicates)
        const uniqueCount = new Set(code.split('')).size;
        return uniqueCount === 6 ? {
            isValid: true,
            msg: "Input validation passed"
        } : {
            isValid: false,
            msg: "Team code digits must be unique (no duplicates)"
        }
    } else {
        if (cmd === 'team') {
            return {
                isValid: false,
                msg: "Unexpected 'team' command outside of team preview"
            }
        }
    }

    if (requestedAction === "switch") {
        if (cmd !== 'switch') {
            return {
                isValid: false,
                msg: "Expected 'switch' command for force switch"
            }
        }
    }

    if (cmd === 'switch') {
        // arg should be a non dead pokemon
        const pokemonName = args[1];
        const pokemonList = req.side.pokemon;
        //console.log("pokemonList: ", pokemonList);
        const nonFainted = pokemonList.filter(p => typeof p.condition === 'string' && !p.condition.includes('fnt') && !p.active);
        //console.log("nonFainted: ", nonFainted);
        const pokemonNames = nonFainted.map(p => p.details.split(",")[0].toLowerCase());
        if (!pokemonNames.includes(pokemonName.toLowerCase())) {
            return {
                isValid: false,
                msg: `Cannot switch to ${pokemonName}. Valid choices are: ${pokemonNames}`
            }
        }
    }

    return {
        isValid: true,
        msg: "Input validation passed"
    }
}

module.exports = {
    validateInput
}