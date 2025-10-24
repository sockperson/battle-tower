# Battle UI (React + Vite)

This is a minimal React + Vite front-end that connects to the simulator server via WebSocket.

Quick start (PowerShell):

cd ui
npm install
npm run dev

Open the printed localhost URL in your browser.

Notes:
- Uses Material UI for layout and components.
- The app expects the server to host the WebSocket at the same host (ws://<host>/).
- Replace `src/App.jsx` with a more advanced React/Redux + MUI app when ready.
