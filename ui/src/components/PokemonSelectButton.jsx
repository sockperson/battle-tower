import React from 'react'

// MUI
import { Button, Avatar, Box, Typography } from '@mui/material'

// Redux
import { useDispatch } from 'react-redux'
import { sendChoice } from './../store/battleSlice'

export default function PokemonSelectButton({ pokemon }) {
    const dispatch = useDispatch();

    if (pokemon === undefined) {
        return null;
    }

    // assume common fields exist to keep component simple
    const name = (pokemon.set && pokemon.set.species) || pokemon.details || pokemon.ident || 'Unknown'

    // hp/maxhp expected to be numeric; condition like "100/200" may be used as fallback
    let hp = pokemon.hp
    let maxHp = pokemon.maxhp

    const status = pokemon.status;

    const short = String(name).split(',')[0]
    const speciesId = short.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    // TODO quite a few pokemon dont have these SWSH images
    const img = `https://img.pokemondb.net/sprites/sword-shield/normal/${speciesId}.png`

    const disabled = hp === 0 || pokemon.isActive;
    const choice = `switch ${pokemon.set.species}`;

    return (
        <Button
            variant="outlined"
            onClick={() => dispatch(sendChoice(choice))}
            disabled={disabled}
            sx={{ textTransform: 'none', justifyContent: 'flex-start', width: '15%' }}
        >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '15%' }}>
            <Avatar src={img} imgProps={{ alt: short }} sx={{ width: 36, height: 36, bgcolor: 'background.paper', boxShadow: 1 }}>{short[0] || '?'}</Avatar>
            <Box sx={{ textAlign: 'left' }}>
            <Typography variant="body1">{short}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{`${hp}/${maxHp}`}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{status}</Typography>
            </Box>
        </Box>
        </Button>
    )
}
