# Successful three-step saga — Pharos Atlantic Testnet

Result: **SUCCEEDED**. All three wallet-signed transactions were mined and receipt-confirmed on Pharos Atlantic (chain ID 688689). This evidence is sourced from the user-exported audit and independently checked against RPC in GitHub Actions.

The run began on October 27, 2026 at 19:07:55 UTC, paused when the wallet rejected the initial SWAP signature, and resumed on October 28, 2026. It completed at 17:04:39 UTC. This was one persisted/resumed saga, not one uninterrupted wallet session.

| Step | Status | Block | Explorer proof |
|---|---|---|---|
| APPROVE | receipt status 1 | `0x1e79d39` | [0x8ab21c36c4...](https://atlantic.pharosscan.xyz/tx/0x8ab21c36c45c5cb23febc62c63504cde307fae0cbf38bcd2c9d1972cd053a724) |
| SWAP | receipt status 1 | `0x1e8300b` | [0x040ade7b2a...](https://atlantic.pharosscan.xyz/tx/0x040ade7b2a5f733356f797226e0e3e611707112ef48351a21b9e2e6fe615bad5) |
| DEPOSIT | receipt status 1 | `0x1e8300f` | [0xa3f90ce5d4...](https://atlantic.pharosscan.xyz/tx/0xa3f90ce5d44d762ae743c6076f4b8d0169edabce54396bb8d25d30d365d6a5a5) |

The independent verification checks transaction hash, sender, target, method selector, exact block, receipt status, and the emitted `Approval`, `Swapped`, and `Deposited` events. It also verifies the following historical state:

- ERC-20 allowance immediately after APPROVE: 1.0 test A
- Pending B credit immediately after SWAP: 1.0 test B
- Pending B credit after DEPOSIT: 0
- Vault B shares after DEPOSIT: 1.0

Reproduce:

```sh
npm install
node scripts/verify-success-proof.mjs
```

[Machine-readable successful-run proof](./success-2026-10-28.json)

The earlier [COMPENSATED scenario](./forced-failure-compensated-2026-10-27.json) proves real on-chain refund after a failed read-only deposit precondition. It does **not** prove a reverted deposit transaction. This distinction is preserved for reviewers.
