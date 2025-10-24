const PS = require('pokemon-showdown');
const {Battle, Dex} = PS;

// imports
const {generateTrainerTeam} = require('./team_gen/team_gen.js');
const {getRequestedAction, extractBattleInfo, extractIndividualBattleInfo, getRecentLogs,
  getAllPossibleChoices
} = require('./sim_parser/sim_parser.js');
const {MovePicker} = require('./trainer/move_picker.js');
const {validateInput} = require('./input/input_validation.js');

const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

//////////
// copilot generated server setup that I don't understand.
//////////

// start express + ws server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// simple connect-rate limiter to prevent noisy reconnect loops from spamming logs
const _connAttempts = new Map(); // ip -> array of timestamps (ms)
const CONN_WINDOW_MS = 60 * 1000; // 60s window
const CONN_THRESHOLD = 6; // more than N connects inside window -> throttle

// --- server-side log forwarding to connected WebSocket clients ---
// Wrap console methods so server logs also get sent to browser clients for debugging.
const _origConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};
let _broadcastingLogs = false;
function broadcastServerLog(level, args) {
  // args is an array
  try {
    const payload = { type: 'server-log', level, msg: args.map(a => {
      try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ') };
    const s = JSON.stringify(payload);
    for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s);
  } catch (e) {
    // non-fatal
  }
}

console.log = function(...args) {
  _origConsole.log(...args);
  if (_broadcastingLogs) return;
  try { _broadcastingLogs = true; broadcastServerLog('log', args); } finally { _broadcastingLogs = false; }
};
console.warn = function(...args) {
  _origConsole.warn(...args);
  if (_broadcastingLogs) return;
  try { _broadcastingLogs = true; broadcastServerLog('warn', args); } finally { _broadcastingLogs = false; }
};
console.error = function(...args) {
  _origConsole.error(...args);
  if (_broadcastingLogs) return;
  try { _broadcastingLogs = true; broadcastServerLog('error', args); } finally { _broadcastingLogs = false; }
};

console.log('Starting example-sim server, pid=', process.pid);
server.on('listening', () => console.log('HTTP server listening', server.address()));
server.on('error', (err) => console.error('HTTP server error', err));
wss.on('error', (err) => console.error('WebSocket server error', err));

// Serve static frontend files from ./public
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//////////
// SIM
//////////

// util
function pickRandom(list) {
    if (!Array.isArray(list) || list.length === 0) return undefined;
    return list[Math.floor(Math.random() * list.length)];
}
const trainerNames = ['Red', 'Penny', 'Cynthia', 'Lacey'];

// Use a custom game format so teams don't get validated strictly.
const formatid = 'gen9customgame';

const playerTeamName = "Penny";
const aiTeamName = pickRandom(trainerNames);

let t1 = generateTrainerTeam(playerTeamName, 6);
let t2 = generateTrainerTeam(aiTeamName, 6);

let battle = new Battle({formatid, p1: {name: 'Player 1', team: t1}, p2: {name: 'Player 2', team: t2}});
let requestedActions = getRequestedAction(battle);
let movePicker = new MovePicker(
  { id: 'p1', name: "Player 1" },
  { id: 'p2', name: "Player 2" }
);
advanceSim("team 123456", "team 123456"); // auto select team preview for now

function restartSim() {
    t1 = generateTrainerTeam(playerTeamName, 6);
    t2 = generateTrainerTeam(pickRandom(trainerNames), 6);
    battle = new Battle({formatid, p1: {name: 'Player 1', team: t1}, p2: {name: 'Player 2', team: t2}});
    requestedActions = getRequestedAction(battle);
    movePicker = new MovePicker(
      { id: 'p1', name: "Player 1" },
      { id: 'p2', name: "Player 2" }
    );
    advanceSim("team 123456", "team 123456"); // auto select team preview for now
}

function getState() {
    const battleInfo = extractBattleInfo(battle);
    const p1Info = extractIndividualBattleInfo(battle, 'p1');
    const p2Info = extractIndividualBattleInfo(battle, 'p2');
    const recentLogs = getRecentLogs(battle, 2);
    return { 
        type: 'state', 
        data: {
            ended: battleInfo.ended, 
            turn: battleInfo.turn, 
            winner: battleInfo.winner, 
            log: battleInfo.log,
            recentLogs: recentLogs,
            p1Info,
            p2Info
        }
    };
}

function acceptUserInput(p1choice) {
    //const p2choice = movePicker.pickMove(battle, requestedActions.p2);
    const p2choice = movePicker.pickMoveSmarter(battle);
    advanceSim(p1choice, p2choice);
}

let p2ChoiceAttempts = 0; 

// accept user and/or AI choice and advance game state
function advanceSim(p1choice, p2choice) {
    if (battle.ended) {
        console.log("Battle has ended, not advancing simulation.");
        return;
    }
    const inputValidationP1 = validateInput(p1choice, requestedActions.p1, "p1", battle);
    const inputValidationP2 = validateInput(p2choice, requestedActions.p2, "p2", battle);
    const validChoices = inputValidationP1.isValid && inputValidationP2.isValid;
    if (validChoices) {
        console.log(`Receiving choices: ${p1choice}, ${p2choice}`)
        //console.log('all possible choices: ', getAllPossibleChoices(battle));
        battle.makeChoices(p1choice, p2choice);
        if (battle.ended) {
          console.log("Battle ended");
        }
        // update valid moves
        requestedActions = getRequestedAction(battle);
        // broadcast state to all clients (guarded)
        let s
        try {
          s = JSON.stringify(getState())
        } catch (e) {
          console.error('WS: failed to serialize state for broadcast', e && e.stack || e)
          s = JSON.stringify({ type: 'error', msg: 'state-serialize-failure' })
        }
        for (const c of wss.clients) {
          if (c.readyState === WebSocket.OPEN) {
            try { c.send(s) } catch (e) { console.error('WS: failed to send to client', e && e.stack || e) }
          }
        }
    } else {
        if (!inputValidationP1.isValid) {
            console.log('Player 1 input invalid: ', inputValidationP1.msg);
        }
        if (!inputValidationP2.isValid) { // this shouldn't happen for AI but just in case
            console.log('Player 2 input invalid: ', inputValidationP2.msg);
            p2ChoiceAttempts++; // prevent infinite loop if AI input is bugged
        }
    }
    // additionally make moves for the AI until user input is required again
    if (requestedActions.p1 === "wait" && requestedActions.p2.length !== "wait" && p2ChoiceAttempts < 5) {
        const aiChoice = movePicker.pickMoveSmarter(battle);
        advanceSim('', aiChoice);
        p2ChoiceAttempts = 0;
    }
}

// helper to log easier
function p(header, input) {
  console.log(header, ": ", JSON.stringify(input, null, 2));
}

function debug() {
  console.log('Start debug log');
  p('Battle', battle);
  const requestState = battle.requestState;
  p('Battle requestState', requestState);
  p('Requests: ', battle.getRequests(requestState));
  p('Requested Actions: ', requestedActions);
  console.log('End debug log');
}

wss.on('connection', (ws, req) => {
  const ip = req && req.socket && req.socket.remoteAddress || 'unknown'
  // record attempt
  const now = Date.now()
  const arr = _connAttempts.get(ip) || []
  // drop old entries
  const fresh = arr.filter(ts => now - ts <= CONN_WINDOW_MS)
  fresh.push(now)
  _connAttempts.set(ip, fresh)

  console.log('WS: client connected from', ip);

  if (fresh.length > CONN_THRESHOLD) {
    console.warn('WS: too many recent connections from', ip, '- throttling')
    try { ws.close(1013, 'throttled') } catch (e) {}
    return
  }

  // send initial state (guarded to avoid throwing on bad serialization)
  try {
    ws.send(JSON.stringify(getState()));
  } catch (e) {
    console.error('WS: failed to send initial state to', ip, e && e.stack || e);
    try { ws.close(1011, 'send-error') } catch (err) {}
    return
  }

  ws.on('message', (data) => {
    //console.log('WS: message received (raw):', data.toString());
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'choice':
          try {
            acceptUserInput(msg.choice);
          } catch (err) {
            console.error('Error while applying choices:', err && err.stack || err);
          }
          break;
        case 'debug':
          debug();
          break;
        case 'restart':
          restartSim();
          break;
        default:
          console.warn('WS: unknown message type', msg.type);
      }
    } catch (e) {
      console.error('WS: invalid message payload', e && e.stack || e);
      try { ws.send(JSON.stringify({ type: 'error', error: 'invalid message' })) } catch (err) { console.error('WS: failed to send error to client', err && err.stack || err) }
    }
  });

  ws.on('close', (code, reason) => console.log('WS: client closed', code, reason && reason.toString()));
  ws.on('error', (err) => console.error('WS client error', err));
});

const DEFAULT_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
function listenOnPort(port) {
  server.listen(port, () => console.log(`Server running at http://localhost:${port}/`));
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && port === DEFAULT_PORT) {
      console.warn(`Port ${port} in use, trying ${port + 1}`);
      listenOnPort(port + 1);
    } else {
      console.error('Server error', err);
      process.exit(1);
    }
  });
}
listenOnPort(DEFAULT_PORT);
