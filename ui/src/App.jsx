import React, { useEffect } from 'react'
import { Box, Button, Container, TextField, Typography, Paper, List, ListItem, ListItemText } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { WS_CONNECT, WS_SEND, WS_DISCONNECT } from './store/wsMiddleware'

import PokemonSelectButton from './components/PokemonSelectButton'
import FoePokemonInfo from './components/FoePokemonInfo'
import PokemonMoveButton from './components/PokemonMoveButton'

import {
  setInput,
  selectConnected,
  selectInput,
  selectRecentLogs,
  selectP1Info,
  selectP2Info,
  sendChoice,
  sendDebug,
  sendRestart
} from './store/battleSlice'

import useTranslation from './i18n/useTranslation'
export default function App() {
  const dispatch = useDispatch()
  const connected = useSelector(selectConnected)
  const input = useSelector(selectInput)
  const recentLog = useSelector(selectRecentLogs)
  const p1Info = useSelector(selectP1Info)
  const p2Info = useSelector(selectP2Info)
  const { textLabel, lang, setLanguage } = useTranslation()


  useEffect(() => {
    // prefer explicit VITE_WS_URL env var (e.g. ws://localhost:3000/), fallback to current host
    const url = import.meta.env.VITE_WS_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/')
      dispatch({ type: WS_CONNECT, payload: url })
      return () => {
        dispatch({ type: WS_DISCONNECT })
      }
  }, [dispatch])

  function sendInputChoice() {
    dispatch(sendChoice(input))
    dispatch(setInput(''))
  }

  function debug() {
    dispatch(sendDebug())
  }

  function processLogs() {
    const out = [];
    //console.log("incoming logs: ", recentLog);
    (recentLog || []).forEach((line) => {
      const { header, args } = line || {};
      if (!header) {
        // some server log entries may just be raw strings in args
        if (Array.isArray(args) && args.length > 0) out.push(String(args[0]))
        return;
      } else {
        out.push(textLabel(header, ...args));
      }
    })
    //console.log("processed logs: ", out)
    return out;
  }

  return (
    <Container sx={{ mt: 4 }}>
      <Typography variant="h4">{textLabel('title')}</Typography>
      <Typography variant="subtitle1">{textLabel('status')}: {connected ? 'connected' : 'disconnected'}</Typography>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6">Your Pokémon</Typography>
        <Box>
          {(p1Info?.ownPokemon || []).map((p, i) => (
            <PokemonSelectButton key={i} pokemon={p} disabled={false} />
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6">Opponent</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {(p1Info?.foePokemon || []).map((p, i) => (
            <FoePokemonInfo key={i} pokemon={p} />
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {(p1Info?.ownActiveMoves || []).map((p, i) => (
            <PokemonMoveButton key={i} move={p} />
          ))}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mt: 2 }}>
        <Typography variant="h6">Log</Typography>
        <List dense disablePadding>
          {(processLogs() || []).map((l, i) => (
            <ListItem key={i} disablePadding sx={{ py: 0 }}>
              <ListItemText
                  primary={l}
                  primaryTypographyProps={{
                  sx: { margin: 0, lineHeight: 1, whiteSpace: 'pre-wrap' }
                  }}
              />
            </ListItem>
          ))}
        </List>
        <TextField fullWidth value={input} onChange={e => dispatch(setInput(e.target.value))} placeholder={textLabel('placeholderChoice')} />
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={sendInputChoice}>Send</Button>
          <Button variant="contained" onClick={debug}>debug</Button>
          <Button variant="contained" onClick={() => dispatch(sendRestart())}>restart</Button>
        </Box>
      </Paper>
      <Typography variant="h6">{textLabel("test", 1)}</Typography>
    </Container>
  )
}
