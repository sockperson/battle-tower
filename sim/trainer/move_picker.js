const { evaluate } = require("./heuristics");
const { getAllPossibleChoices } = require('./../sim_parser/sim_parser.js');

const PS = require('pokemon-showdown');
const { getRequestedAction } = require("../sim_parser/sim_parser.js");
const {Battle} = PS;

// Class-based MovePicker so callers can create instances with their own playerInfo.
// For backward compatibility we also export a default instance as the module's default export.
class MovePicker {
    constructor(
        userPlayerInfo = { id: 'p1', name: 'user' },
        aiPlayerInfo = { id: 'p2', name: 'noob' }
    ) {
        this.userPlayerInfo = userPlayerInfo;
        this.aiPlayerInfo = aiPlayerInfo;
    }

    // randint: returns integer in [0, max)
    randint(max) {
        return Math.floor(Math.random() * max);
    }

    weightedPick(weightedList) {
        if (!weightedList || !weightedList.length) return null;       // return null if empty
        if (weightedList.length === 1) return weightedList[0].item;   // return the only item
        const total = weightedList.reduce((s, i) => s + (Number(i.weight) || 0), 0);
        if (total <= 0) {
            // fallback to uniform random
            const idx = Math.floor(Math.random() * weightedList.length);
            return weightedList[idx].item;
        }
        let r = Math.random() * total;
        for (const p of weightedList) {
            if (r < p.weight) return p.item;
            r -= p.weight;
        }
        return weightedList[weightedList.length - 1].item; // fallback
    }


    // pick a random element from an array (returns undefined for empty/non-array)
    pickRandom(list) {
        if (!Array.isArray(list) || list.length === 0) return undefined;
        return list[Math.floor(Math.random() * list.length)];
    }

    // "naive" algorithm
    // something slightly smarter than picking a random legal option
    // calculate some score "progress" for current state
    // simulate all possible combinations of player and bot moves and evaluate their outcomes
    // use a weighted pick based off of the average progress differences
    // NOTE: this picker cheats since it knows what the player's sets are.
    // if implementing a better AI, need to make sure AI only uses revealed info
    pickMoveSmarter(battle) {
        const processedMoves = [];
        let movePickPair = [];
        try {
            const possibleMoves = getAllPossibleChoices(battle);
            if (possibleMoves.p2[0] === "") { // don't bother simulating if no moves available
                return "";
            }

            const currAiScore = evaluate(battle, this.aiPlayerInfo, this.userPlayerInfo);
            const currPlayerScore = evaluate(battle, this.userPlayerInfo, this.aiPlayerInfo);
            const p1PossibleMoves = possibleMoves.p1;
            const p2PossibleMoves = possibleMoves.p2;

            const pickWeights = [];
            for (const p2move of p2PossibleMoves) {
                let playerProgressSum = 0.0;
                let aiProgressSum = 0.0;
                for (const p1move of p1PossibleMoves) {
                    // debug
                    movePickPair = [p1move, p2move];
                    // copy the battle object
                    const simulatedBattle = Battle.fromJSON(JSON.stringify(battle, null, 2));
                    // simulate the moves
                    simulatedBattle.makeChoices(p1move, p2move);
                    const playerScore = evaluate(simulatedBattle, this.userPlayerInfo, this.aiPlayerInfo);
                    const aiScore = evaluate(simulatedBattle, this.aiPlayerInfo, this.userPlayerInfo);
                    const playerProgress = playerScore - currPlayerScore;
                    const aiProgress = aiScore - currAiScore;
                    const scale = p1move.startsWith('switch') ? 0.2 : 1.0; // make p1 switches matter less
                    const bias = p2move.startsWith('switch') ? -0.7 : 0; // bias against switching as no heuristic for matchup
                    playerProgressSum += playerProgress * scale;
                    aiProgressSum += (aiProgress * scale) + bias;
                    //console.log(`${p1move},${p2move}... prog: ${playerProgress}, AI: ${aiProgress}, diff: ${diff}`);
                    processedMoves.push({ p1move, p2move });
                }
                const sum = aiProgressSum - playerProgressSum;
                const avg = sum / p1PossibleMoves.length;
                //console.log(`Avg diff for p2: ${p2move}, avg: ${avg}, playerProgressSum: ${playerProgressSum}, aiProgressSum: ${aiProgressSum}`);
                pickWeights.push({
                    item: p2move,
                    weight: 3.0 ** avg // sharpen weights
                });
            }
            //console.log("Pick weights:", pickWeights);
            const out = this.weightedPick(pickWeights);
            //console.log("Picked move:", out);
            return out;
        } catch (e) {
            console.error("Error in pickMoveSmarter, falling back to pickMove()", e);
            console.log("attempted: ", movePickPair);
            return this.pickMove(battle);
        }
    }

    // given info about the current game, make a legal move
    pickMove(battle) {
        const requestedAction = getRequestedAction(battle).p2;
      
        const req = battle.getRequests();
        const p2req = Array.isArray(req)
            ? req.find(r => r && r.side && r.side.id === this.aiPlayerInfo.id)
            : (req && req.side && req.side.id === this.userPlayerInfo.id ? req : undefined);

        if (requestedAction === 'wait') return '';
        if (requestedAction === 'team') return 'team 123456';

        // switch-only situation (no moves)
        if (requestedAction === 'switch') {
            const pokemonList = (p2req && p2req.side && Array.isArray(p2req.side.pokemon)) ? p2req.side.pokemon : [];
            const nonFainted = pokemonList.filter(p => typeof p.condition === 'string' && !p.condition.includes('fnt') && !p.active);
            const picked = this.pickRandom(nonFainted);
            const choice = picked && picked.details ? String(picked.details).split(',')[0] : undefined;
            return choice ? `switch ${choice}` : '';
        }

        // pick a random move
        if (requestedAction === 'move') {
            const movesArr = Array.isArray(p2req?.active) && p2req.active[0] && Array.isArray(p2req.active[0].moves)
                ? p2req.active[0].moves
                : [];
            const moveList = movesArr.filter(m => !m.disabled).map(m => m.id);
            const choice = this.pickRandom(moveList);
            return choice ? `move ${choice}` : '';
        }

        return 'default';
    }
}

// Default instance for backward compatibility with code that expects the module to be an object.
const defaultPicker = new MovePicker();

// module.exports is the default instance; also expose the class as a property.
module.exports = defaultPicker;
module.exports.MovePicker = MovePicker;