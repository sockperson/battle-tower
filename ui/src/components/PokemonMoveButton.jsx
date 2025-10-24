import React from 'react'

// MUI
import { Button, Box, Typography } from '@mui/material'

// Redux
import { useDispatch } from 'react-redux'
import { sendChoice } from './../store/battleSlice'

export default function PokemonSelectButton({ move }) {
    const dispatch = useDispatch()
    
    if (move === undefined) {
        return null;
    }

    const formattedPP = `${move.pp}/${move.maxpp}`;
    const choice = `move ${move.id}`;
    return (
        <Button
            variant="outlined"
            onClick={() => dispatch(sendChoice(choice))}
            disabled={move.disabled || move.pp === 0}
            sx={{ textTransform: 'none', justifyContent: 'flex-start', width: '15%' }}
        >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '15%' }}>
            <Box sx={{ textAlign: 'left' }}>
            <Typography variant="body1">{move.move}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>{formattedPP}</Typography>
            </Box>
        </Box>
        </Button>
    )
}
