GRAMELLE BUILD FIX

1. Extract this archive into the project root C:\Users\PROCAD\gramelle with replacement.
2. Run FIX_BUILD.cmd once. It removes the accidental ROOT round.ts file.
3. Run npm run lint
4. Run npm run build

Important: src/lib/server/round.ts is the real server file. Do NOT copy it to the project root.

The current build errors show that root round.ts was being compiled as a standalone file and therefore could not resolve ./supabase, ./ledger, ./house, ./referral.
VerifyModal.tsx is also fixed so all React state is declared before the effect that uses its setters.
