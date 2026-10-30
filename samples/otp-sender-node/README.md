# Sample App: OTP Sender (Node.js)

A lightweight runnable script showing how to send transactional OTP messages using the Relay API and track telecom delivery state.

## How to Run

1. Ensure the Relay Developer Hub is running on `http://localhost:3001`.
2. Run the script:
   ```bash
   npx tsx index.ts
   ```
3. Or test with a specific test number:
   ```bash
   npx tsx index.ts +919999900001 # Always delivers
   npx tsx index.ts +919999900002 # Handset unreachable simulation
   ```
