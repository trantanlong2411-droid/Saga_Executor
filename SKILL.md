---
name: pharos-saga-executor
description: Receipt-gated, resumable three-step approve-swap-deposit saga on Pharos Atlantic Testnet with wallet signatures, bounded receipt retries, compensation and audit log.
---
# Pharos Saga Executor
- Never use real funds. Contract is an explicitly labeled Atlantic TESTNET sandbox, NOT a DEX or real vault.
- Connect an EIP-1193 wallet. Confirm chain ID 688689 before any write. No private keys in web/server/repo.
- Run one signed transaction for each sequential step: (1) `SagaToken.approve`, (2) `SagaPlayground.swap`, (3) `SagaPlayground.deposit`.
- Check each transaction receipt hash, block, status=1 before the next step; check expected state transitions as well.
- Controlled demo failure sends a deliberately reverting deposit on testnet using explicit gasLimit; inspect status=0 and compensate with `compensateSwap` and `approve(0)`, each receipt checked.
- Retry only receipt fetches with bounded backoff. Never blindly rebroadcast a transaction with an unknown hash/result. A missing receipt is `NEEDS_RECONCILIATION`.
- Keep state transitions, event timestamps and explorer tx hashes in a downloadable JSON audit log.
- Run `npm test` for synthetic unit tests and `npm run compile` for verified compiler output. Unit tests are NOT proof of a live on-chain execution.
- For full 200-point evidence, connect a funded Atlantic wallet, deploy sandbox, run success and forced-failure modes, download logs, include testnet transaction links and a demo URL with reviewer notes.
