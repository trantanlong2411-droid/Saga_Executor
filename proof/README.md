# Saga Executor — independent Pharos Atlantic execution evidence

All linked transactions are public testnet transactions with no real funds. The demo uses a fixed 1:1 educational conversion of test assets, not a live DEX. Both scenarios use the same testnet contract and wallet.

| Scenario | Outcome | Evidence | Independent verification |
|---|---|---|---|
| Three dependent operations | **SUCCEEDED**: APPROVE → SWAP → DEPOSIT, each real status-1 receipt | [Successful run](./SUCCESS.md) | `node scripts/verify-success-proof.mjs` |
| Forced business-rule failure and rollback | **COMPENSATED**: APPROVE → SWAP → read-only failed deposit guard → real REFUND_A | [Recovery run](./COMPENSATED.md) | `node scripts/verify-compensated-proof.mjs` |

Reviewer summary:
- Main proof / interactive demo: https://saga-executor.trantanlong2411.workers.dev/
- Source: https://github.com/trantanlong2411-droid/Saga_Executor
- Evidence scripts and CI: https://github.com/trantanlong2411-droid/Saga_Executor/actions/workflows/verify.yml
- Network: Pharos Atlantic Testnet, chain ID 688689.
- Testnet contract: `0x934403227468426b33c26536dABC33b066B73f73`.
- Wallet: `0x74B2c2E4E4B771F0C75dcE44f40787468E323f79`.

The successful run paused on a user-rejected wallet SWAP request and resumed later using the previously verified APPROVE receipt; the successful on-chain SWAP and DEPOSIT were then receipt-checked.

Important reviewer limitation: the failure scenario is a real read-only DEPOSIT business-rule rejection followed by a real refund/compensation. Because OKX rejected the intentionally reverted transaction before broadcast, there is no status-0 DEPOSIT receipt. Do not misstate it as a mined revert. Both rollback outcome and the separate three-transaction success outcome are genuinely on-chain verifiable.
