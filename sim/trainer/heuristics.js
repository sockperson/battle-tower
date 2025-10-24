const Weights = {
    WIN: 1000.0,
    ALIVE: 20.0,
    HP_RATIO: 10.0,
    STATUS_BRN: -10.0,
    STATUS_FRZ: -15.0,
    STATUS_PAR: -10.0,
    STATUS_PSN: -8.0,
    STATUS_TOX: -10.0,
    STATUS_SLP: -10.0,
    STATUS_YAWN: -7.0,
    STATUS_LEECHSEED: -6.0,
    STATUS_SUBSTITUTE: 5.0,
    STAT_BOOST: 2.0,
    STEALTH_ROCK: -15.0,
    SPIKES: [-15.0, -20.0, -30.0],
    HAS_ITEM: 5.0
}

// generate some score value based on the current battle state 
// TODO also accept object for revealed enemy info
function evaluate(battle, selfInfo, foeInfo) {
    try {
        if (battle.winner === selfInfo.name) {
            //console.log(`Player ${selfInfo.name} has won the battle!`);
            return Weights.WIN;
        }

        let score = 0;

        const selfSide = battle.sides.find(s => s.id === selfInfo.id);
        const foeSide = battle.sides.find(s => s.id !== selfInfo.id);

        // count alive
        score += Weights.ALIVE * selfSide.pokemonLeft;
        
        // side conditions
        for (const sideCondition of Object.values(selfSide.sideConditions)) {
            switch (sideCondition.id) {
                case "stealthrock":
                    score += Weights.STEALTH_ROCK;
                    break;
                case "spikes":
                    const layers = sideCondition.layers || 0;
                    if (layers >= 1 && layers <= Weights.SPIKES.length) {
                        score += Weights.SPIKES[layers - 1];
                    }
                    break;
            }
        }

        for (const pkmn of selfSide.pokemon) {
            let pkmnScore = 0;

            // hp ratio
            const hpRatio = pkmn.hp / pkmn.maxhp;
            pkmnScore += Weights.HP_RATIO * hpRatio;

            // status conditions
            const statusState = pkmn.statusState;
            if (statusState) {
                const weightKey = `STATUS_${statusState.id.toUpperCase()}`;
                if (Weights.hasOwnProperty(weightKey)) {
                    pkmnScore += Weights[weightKey];
                }
            }

            // volatile status conditions
            const volatiles = pkmn.volatiles;
            // get values for each mapping
            for (const volatileStatus of Object.values(volatiles)) {
                const id = volatileStatus.id;
                const key = `STATUS_${id.toUpperCase()}`;
                if (Weights.hasOwnProperty(key)) {
                    pkmnScore += Weights[key];
                } else {
                    //console.log("No weight defined for volatile status: " + id);
                }
            }

            // stat boosts
            for (const boostValue of Object.values(pkmn.boosts)) {
                pkmnScore += Weights.STAT_BOOST * boostValue;
            }

            // has item
            if (pkmn.item !== "") {
                pkmnScore += Weights.HAS_ITEM;
            }
            score += Math.max(pkmnScore, 0); // add a floor to pkmn individual score
            // ...
        }
        
        return score;
    } catch (e) {
        console.error("Error in evaluate():", e);
        return 0;
    }
}

module.exports = {
    evaluate
}