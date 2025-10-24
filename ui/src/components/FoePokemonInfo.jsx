import React from 'react'
import { Button, Avatar, Box, Typography } from '@mui/material'

// NOTE: `pokemon-showdown` is a server-side/commonjs library and `require` is not
// available in the browser build. Don't attempt to npm install it into `ui` —
// instead guard usage of any `Dex` symbol (in case you later provide it via a
// global or different bundle). Use typeof checks so the code doesn't throw.

export default function FoePokemonInfo({ pokemon }) {
    if (pokemon === undefined) {
        return null;
    }
    if (pokemon.set === undefined) {
        console.log("null: " + JSON.stringify(pokemon));
        return null;
    }

    // assume common fields exist to keep component simple
    const name = pokemon.set.species;

    // hp/maxhp expected to be numeric; condition like "100/200" may be used as fallback
    let hp = pokemon.hp
    let maxHp = pokemon.maxhp

    const status = pokemon.status;

    const imgName = pokemon.metadata.imgName;
    const gen = pokemon.metadata.gen;

    // TODO quite a few pokemon dont have these SWSH images
    let img = `https://img.pokemondb.net/sprites/sword-shield/normal/${imgName}.png`
   
    if (gen > 8) {
        img = `https://img.pokemondb.net/sprites/scarlet-violet/normal/${imgName}.png`
    }
    const formattedHp = `${hp}/${maxHp}`;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 140, flex: '0 0 15%' }}>
            <Avatar src={img} imgProps={{ alt: name }} sx={{ width: 36, height: 36, bgcolor: 'background.paper', boxShadow: 1 }}>{name || '?'}</Avatar>
            <Box sx={{ textAlign: 'left' }}>
            <Typography variant="body1">{name}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{formattedHp}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{status}</Typography>
            </Box>
        </Box>
    )
}
