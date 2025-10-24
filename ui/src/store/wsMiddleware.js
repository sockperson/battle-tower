// wsMiddleware: Opens a WebSocket when it sees {type: 'ws/connect', payload: url}
// Sends JSON when it sees {type: 'ws/send', payload: obj}
// Closes on {type: 'ws/disconnect'}
import { setConnected, setServerState, addLogEntry } from './battleSlice'

const WS_CONNECT = 'ws/connect'
const WS_DISCONNECT = 'ws/disconnect'
const WS_SEND = 'ws/send'

// copilot genned middleware that I mostly don't understand

export { WS_CONNECT, WS_DISCONNECT, WS_SEND }

export default function createWsMiddleware() {
  let socket = null
  let url = null
  let reconnectTimer = null
  let reconnectAttempts = 0
  // if the app intentionally requested disconnect, don't auto-reconnect
  let shouldReconnect = false
  // reference count for how many callers requested a connection
  let connectCount = 0

  const scheduleReconnect = (store) => {
    if (!shouldReconnect) return
    if (reconnectTimer) return
    // exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
    const delay = Math.min(30000, 1000 * Math.pow(2, Math.max(0, reconnectAttempts)))
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      reconnectAttempts++
      if (url) store.dispatch({ type: WS_CONNECT, payload: url })
    }, delay)
  }

  return store => next => action => {
    switch (action.type) {
      case WS_CONNECT: {
        // increment reference count; only actually (re)create socket when going 0->1
        connectCount++
        url = action.payload
        shouldReconnect = true
        // reset attempts when a new explicit connect is requested
        reconnectAttempts = 0
        if (connectCount > 1) {
          // another caller asked to connect; socket already open or in progress
          return next(action)
        }
        // if a socket exists (stale), ensure it's closed before creating a new one
        if (socket) {
          try { socket.close() } catch (e) {}
          socket = null
        }
        try {
          socket = new WebSocket(url)
        } catch (e) {
          console.error('ws create error', e)
          scheduleReconnect(store)
          return next(action)
        }

        socket.addEventListener('open', () => {
          // successful open -> reset reconnect attempts
          reconnectAttempts = 0
          store.dispatch(setConnected(true))
          console.info('ws opened', url)
        })
        socket.addEventListener('close', (ev) => {
          // CloseEvent in browsers provides code/reason
          const code = ev && ev.code
          const reason = ev && ev.reason
          console.warn('ws closed', code, reason)
          store.dispatch(setConnected(false))
          // schedule reconnect only if the close was not intentional
          scheduleReconnect(store)
        })
        socket.addEventListener('error', (e) => {
          console.error('ws error', e)
          store.dispatch(setConnected(false))
        })
        socket.addEventListener('message', (ev) => {
          try {
            const msg = JSON.parse(ev.data)
            if (msg.type === 'state') {
              store.dispatch(setServerState(msg.data || {}))
            } else if (msg.type === 'server-log') {
              const line = msg.msg || JSON.stringify(msg)
              // mirror server log into browser console at the same level
              try {
                if (msg.level === 'error') console.error('[server]', line)
                else if (msg.level === 'warn') console.warn('[server]', line)
                else console.log('[server]', line)
              } catch (e) {}
              store.dispatch(addLogEntry(line))
            } else if (msg.type === 'error') {
              store.dispatch(addLogEntry(`[server error] ${msg.msg || ''}`))
            } else {
              // unknown message: add to log
              store.dispatch(addLogEntry(JSON.stringify(msg)))
            }
          } catch (e) {
            console.error('ws message parse', e)
          }
        })

        return next(action)
      }

      case WS_SEND: {
        if (socket && socket.readyState === WebSocket.OPEN) {
          try {
            const payload = action.payload
            socket.send(JSON.stringify(payload))
          } catch (e) {
            console.error('ws send error', e)
          }
        } else {
          console.warn('ws not open, cannot send')
        }
        return next(action)
      }

      case WS_DISCONNECT: {
        // decrement reference count; only fully disconnect when it reaches 0
        connectCount = Math.max(0, connectCount - 1)
        if (connectCount > 0) {
          // other parts of the app still want the connection
          return next(action)
        }
        // user-requested final disconnect: prevent reconnection
        shouldReconnect = false
        url = null
        if (reconnectTimer) {
          clearTimeout(reconnectTimer)
          reconnectTimer = null
        }
        if (socket) {
          try { socket.close() } catch (e) {}
          socket = null
        }
        return next(action)
      }

      default:
        return next(action)
    }
  }
}
