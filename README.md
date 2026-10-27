# Saga Executor — Pharos Agent Arena (Hard / 200 points)

## Live URL (once Cloudflare Git-connected Worker deploys)
https://saga-executor.trantanlong2411.workers.dev/

## Current proof status\n\n- [On-chain COMPENSATED evidence (October 27, 2026)](./proof/README.md): real APPROVE, SWAP and REFUND receipts, plus an explicitly labeled no-broadcast DEPOSIT precondition failure.\n- The three-step SUCCEEDED run is still awaiting wallet-signed transactions; do not report full challenge completion yet.\n\n## Purpose
An actual wallet-signed, receipt-gated 3-step saga on Pharos **Atlantic Testnet** (chain ID **688689**, `https://atlantic.dplabs-internal.com`), with bounded retries, state logging, and on-chain compensation. No private key or server-side signer is stored.

### Important: no fictitious DeFi trades
The included Solidity sandbox creates two worthless test ERC-20 assets. The "swap" is a fixed 1:1 collateral-backed **educational conversion**, NOT a decentralized exchange, a live liquidity pool, or a real-money vault. Only testnet PHRS is required for gas. The demo wallet signs each transaction in MetaMask or another EIP-1193 provider.

| Requirement | How it is implemented |
| --- | --- |
| 3 dependent steps | ERC-20 `approve` → `SagaPlayground.swap` → `SagaPlayground.deposit` |
| Verified receipt before next step | Fetch `eth_getTransactionReceipt` from Pharos Atlantic RPC; check chain 688689, matching hash, block number, and status 1. Validate state changes. |
| Bounded retry | Retry **receipt polling only** with backoffs of 0 / 1.5 / 3.5 / 7 / 12 seconds. Do **not** blindly resubmit unknown transactions. |
| Permanent failure and compensation | Deliberately send `deposit(amount + 1)` (with `gasLimit`) and verify status 0; call `compensateSwap(amount)` to refund user A, then `approve(spender,0)` to revoke authorization, each with receipt verification. |
| State log | Browser-local machine-readable log with timestamps, steps, hashes, blocks, transitions and recovery; export JSON. |
| Two outcomes | Real testnet success mode; real testnet forced revert + compensation mode. **Require wallet + testnet PHRS; CI unit tests do not substitute live receipts.** |

## OKX Wallet: gas estimate missing for intentionally reverted DEPOSIT

An intentionally reverting `deposit(amount+1)` can be rejected by OKX Wallet as an unknown transaction with no network-fee estimate. Do not force a nonce or invent a gas figure.

Two separate failure demonstrations are now available:

- **Run safe failure + recovery** (default, OKX-compatible): execute real APPROVE and SWAP receipts; read actual contract pending B credit; require more than that credit at DEPOSIT; record a clearly labeled **business-rule precondition failure, without sending the third tx**; submit real `compensateSwap` to refund A, receipt-check and verify storage; revoke allowance only if any remains. This is a real blockchain compensation demo, NOT a status-0 reverted transaction.
- **Advanced: on-chain revert** (optional): original transaction deliberately reverts, and can be rejected by browser wallets or cost testnet gas. If submitted and status 0, run the same real compensation.

When the earlier paused forced-failure run already has a confirmed SWAP receipt, the **Finish paused failure + refund (OKX)** button verifies the original APPROVE and SWAP receipts and current pending state, then performs the safe precondition failure and testnet compensation without duplicate SWAP/APPROVE. Preserve browser localStorage until proof is exported.

## Reviewer: reproduce a true on-chain run

1. Open the deployed Worker URL using Chrome with MetaMask installed; connect a *testnet-only* wallet with some Atlantic PHRS for gas. Do not use a wallet holding significant real assets.
2. Click **Switch to Atlantic** if required (chain 688689), then **Connect wallet**.
3. Click **Deploy sandbox contract**. This requires wallet approval and testnet gas, and mints 10,000 worthless test asset A to the deploying wallet while holding worthless test asset B as a reserve.
4. Leave the resulting contract address populated; set the amount to 1. Click **Run success saga**. Approve each of the three wallet transactions. Confirm on-screen 3 receipts and success plus vault shares.
5. Click **Run forced-failure + recovery**. Approve step 1 and 2, sign the deliberately reverting deposit (which spends gas), then approve refund and allowance revoke compensating transactions. Observe receipt status 0, COMPENSATED, and pending balance 0.
6. If the wallet refuses to broadcast the intentionally reverting deposit, click **Recover pending / revoke approval**, then confirm the compensating transactions. This is a safe alternative recovery demo, but without a reverted on-chain receipt it does not prove the strongest forced-failure criterion. Export both JSON traces; click hashes to open Atlantic Explorer receipts. For submission, provide this public demo link, the repo, and transaction hashes / JSON evidence. If you cannot run real transactions, explicitly say so — unit tests alone are not complete challenge evidence.

Note that browsers and wallets sometimes reject a knowingly reverting transaction *before broadcast*. In that case the UI does not invent a status-0 receipt; it records the failure and stops. Perform a real on-chain forced-revert to meet the strongest form of proof.

## Implementation

`contracts/SagaPlayground.sol`: self-contained test-token escrow and vault accounting, with `pending`, `deposited`, `swap`, `deposit`, `compensateSwap`, and `undoDeposit` (post-success reverse path).

`src/saga-core.mjs`: dependency state transitions and receipt verification for offline testing.

`src/page.mjs`: HTML/JS wallet UI, event/state trace, explicit failure trigger, recovery logic, exported JSON evidence.

`src/worker.mjs`: Cloudflare Worker, read-only on-chain receipt endpoint `GET /api/tx/:hash` and compiled contract artifact for browser-side wallet deployment. The server cannot submit transactions.

`public/contract.json`: ABI and compiler bytecode. Generated reproducibly from source code via `npm run compile` using pinned solc 0.8.30. A placeholder will only exist during initial bootstrap; deploy buttons remain disabled until ABI and bytecode are committed.

### Commands
```sh
npm install
npm test
npm run compile
npm run build-check
npx wrangler deploy
```

A Git-linked Cloudflare Worker should use branch `main` and a Worker name matching `wrangler.jsonc`: `saga-executor`. Cloudflare Workers Builds deploys automatically from GitHub pushes; no local Git or Windows script is required after initial setup.

## Recover a real confirmed swap from a lagging RPC state

A real October 27, 2026 testnet SWAP transaction `0x530b552a9e146bd515c7757017d861d1b338bc06dd9d24c2769f586079828722` had `receipt.status=1`, `Swapped` event, and real `pending=1000000000000000000` wei at its receipt block `0x1e79ab4` AND at latest. The browser's immediate provider state read gave a stale result and misclassified the step as failed.

Receipt-gated compensation also verifies a refunded pending balance or revoked allowance at both receipt block and latest, with bounded retries. The Worker now provides `GET /api/state?contract=...&wallet=...&block=0x...` with read-only Atlantic RPC calls for allowance/pending/deposited and chain-ID verification. After each successful receipt, the app checks state at the exact receipt block and again at latest, with bounded retries. If verification lags, it sets `NEEDS_RECONCILIATION`, preserves the transaction hash, and never blindly rebroadcasts.

For historical audit traces where SWAP is `SUBMITTED` with status `1` but `state: FAILED`, use **Reconcile last tx** in the same browser. The handler verifies chain, wallet, contract, receipt hash/sender/destination and on-chain state, changes SWAP to `CONFIRMED`, then enables **Resume interrupted saga** to proceed to DEPOSIT without a duplicate SWAP.

See [read-only CI on-chain diagnostics](https://github.com/trantanlong2411-droid/Saga_Executor/actions/runs/40562887657).

## Continue after a rejected wallet signature

If the wallet rejects the SWAP signature (ethers `ACTION_REJECTED` or EIP-1193 error 4001) after APPROVE succeeds, this is not a reverted blockchain transaction. The approval receipt remains valid and any allowance may remain set. The site now stores a `PAUSED_USER` audit state and enables **Resume interrupted saga**. It re-checks Pharos Atlantic chain 688689, connected wallet, deployed sandbox contract, amount, prior APPROVE/SWAP receipts, and current token allowance or pending on-chain credit before signing the next step. No automatic broadcast or duplicate swap occurs while a receipt is unknown.

For an old version audit with `state: FAILED`, successful APPROVE, pending SWAP and pending DEPOSIT, the resume button also works as long as browser localStorage has that original trace. Do not clear your browser data. If you do not want to continue, use **Recover pending / revoke approval** to clear any existing allowance or refundable test credit.

A wallet rejection before SWAP produces no second tx hash and is **not** a forced-failure/rollback proof. To satisfy the 200-point requirement, run a real success saga and a separately confirmed forced-revert + on-chain compensation.

## Manual recovery\n\nThe UI includes **Recover pending / revoke approval**. It queries your real pending test credit and allowance, sends compensation transactions only when there is something to undo, and verifies each receipt. It refuses to compensate while a previously submitted transaction has an unknown receipt; first reconcile that hash. Successful prior vault deposits are not silently reversed.\n\n## Security and state caveats

- No custody, wallet keys, seed phrases, token approvals on mainnet, or mainnet deployment.
- Real-money swaps are not available. The demo issues test assets from its own sandbox contract.
- The web UI signs user-approved tx individually; *a single click does not perform uncontrolled autonomous transactions*.
- When a receipt is unknown, stop and reconcile. There is no unsafe automatic retry of a write after an ambiguous result.
- On-chain transactions are irreversible; "rollback" means **compensating transactions**, not undoing EVM history or refunding gas fees.
- An on-chain reverted forced-deposit transaction spends testnet gas, even though contract state is reverted.
- Wallet refreshes, errors or missing receipts may require manual reconciliation. The persisted browser audit does not equal a server-side durable queue.
- The locally generated ABI/bytecode must be compiled using the checked-in source with the pinned compiler version.

## Documentation
- [Pharos Atlantic Network](https://github.com/PharosNetwork/pharos-skill-engine/blob/main/assets/networks.json)
- [Official Pharos MCP](https://github.com/PharosNetwork/pharos-mcp) — hosted MCP is **read-only** on mainnet; for this **testnet** app, unsigned receipt reads use Atlantic JSON-RPC directly, and wallet-signing uses EIP-1193. These must not be confused.
- [Task](https://pharos-agent-arena.vercel.app/tasks/saga-executor)

## Suggested reviewer note (once real runs are completed)

"Deployed a testnet-only, wallet-signed Saga Executor with three receipt-gated, dependent operations (approve, fixed-rate test-token swap, vault deposit). The app exposes state logs, block explorer receipts, bounded receipt retries, and a deliberately reverted deposit followed by compensating refund and approval-revocation transactions. All wallet signatures occur in the browser; no private keys are stored. The swap and vault are educational sandbox primitives, not a production DeFi exchange. Attached: successful saga transaction hashes and failed/recovered saga hashes."

