# Gramelle — Spin & Stars removed

Base: commit 2a1725b (stable before Spin-fix marathon)

Removed:
- Spin / PvP wheel (API, UI, useRound, Wheel, rooms, bet, verify, fair)
- Stars deposits (stars-invoice route)

Kept:
- RPS
- TON deposit / withdraw
- Referrals
- Tasks
- Profile / transactions / admin / auth

Apply: extract over repo → npm install → npm run build → deploy
