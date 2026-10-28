# Recovery scenario — Pharos Atlantic (October 27, 2026)

Source evidence: user-exported Saga Executor JSON audit. This folder contains a minimal, public, independently checkable summary, not private wallet credentials.

**Result:** `COMPENSATED` after business-rule DEPOSIT guard failure.

| Action | Result | Pharos Atlantic explorer |
|---|---|---|
| APPROVE | receipt status 1 | [Transaction](https://atlantic.pharosscan.xyz/tx/0x8e094b77aeb6a566639ee32f7bf8e71ac17d21e854ee6d7395ffbecab3224fe3) |
| SWAP | receipt status 1 and `Swapped` log | [Transaction](https://atlantic.pharosscan.xyz/tx/0x530b552a9e146bd515c7757017d861d1b338bc06dd9d24c2769f586079828722) |
| DEPOSIT | `FAILED_PRECONDITION`; **NO transaction broadcast** | No tx hash or reverted receipt exists |
| REFUND_A | receipt status 1 and `SwapCompensated` log | [Transaction](https://atlantic.pharosscan.xyz/tx/0x06fda77e053d8382f29c73460e7c492d1e1aedb5a8a4564b8c1140d8b1f64150) |

The testnet contract state at refund block `0x1e79ca9` is checked automatically: pending credit = 0, deposited shares = 0, allowance = 0. The refund is a compensating on-chain write, not an undo of EVM history.

Verify independently from CI or locally:

```bash
npm install
node scripts/verify-compensated-proof.mjs
```

The script uses Pharos Atlantic JSON-RPC to verify receipts, senders, destinations, block order, emitted events, and historical storage. It must fail rather than invent success when the RPC cannot return proof.

**Scoring caveat:** The third operation did **not** broadcast because OKX Wallet rejected an intentionally reverted transaction. The fallback safely demonstrated a rejected on-chain precondition followed by real compensation. For complete task coverage, also demonstrate a separate SUCCESS saga where APPROVE, SWAP and DEPOSIT each have an on-chain receipt. A forced actual reverted receipt, if the reviewer requires it, remains unproven.

Evidence JSON: [forced-failure-compensated-2026-10-27.json](./forced-failure-compensated-2026-10-27.json)

