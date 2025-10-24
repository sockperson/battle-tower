import { createSlice } from '@reduxjs/toolkit'

const defaultStateShape = {
  recentLogs: [],
  p1Info: { ownPokemon: [], foePokemon: [] },
  p2Info: { ownPokemon: [], foePokemon: [] },
}

const initialState = {
  connected: false,
  input: '',
  serverState: defaultStateShape,
}

const battleSlice = createSlice({
  name: 'battle',
  initialState,
  reducers: {
    setConnected(state, action) {
      state.connected = !!action.payload
    },
    setInput(state, action) {
      state.input = action.payload ?? ''
    },
    setServerState(state, action) {
      const incoming = action.payload || {}
      state.serverState = {
        recentLogs: incoming.recentLogs || [],
        p1Info: incoming.p1Info || defaultStateShape.p1Info,
        p2Info: incoming.p2Info || defaultStateShape.p2Info,
        ...incoming,
      }
    },
    addLogEntry(state, action) {
      const entry = action.payload
      if (!state.serverState) state.serverState = defaultStateShape
      state.serverState.recentLogs = (state.serverState.recentLogs || []).concat([entry])
      if (state.serverState.recentLogs.length > 200) {
        state.serverState.recentLogs = state.serverState.recentLogs.slice(-200)
      }
    },
    clearServerState(state) {
      state.serverState = defaultStateShape
    },
  },
})

export const {
  setConnected,
  setInput,
  setServerState,
  addLogEntry,
  clearServerState,
} = battleSlice.actions

export const selectConnected = (state) => state.battle.connected
export const selectInput = (state) => state.battle.input
export const selectRecentLogs = (state) => (state.battle.serverState?.recentLogs || [])
export const selectP1Info = (state) => (state.battle.serverState?.p1Info || { ownPokemon: [], foePokemon: [] })
export const selectP2Info = (state) => (state.battle.serverState?.p2Info || { ownPokemon: [], foePokemon: [] })

export default battleSlice.reducer

// helper action creators for middleware-driven actions
export const sendChoice = (choice) => ({ type: 'ws/send', payload: { type: 'choice', choice } })
export const sendDebug = () => ({ type: 'ws/send', payload: { type: 'debug' } })
export const sendRestart = () => ({ type: 'ws/send', payload: { type: 'restart' } })
