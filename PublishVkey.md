```bash
xiond tx zk add-vkey sudoku ./sudoku_vkey.json "Sudoku puzzle circuit" --from $SATYAM2 --chain-id xion-testnet-2 --node $RPC_URL --gas auto --gas-prices 1uxion --gas-adjustment 0.4
```

```
xiond query tx A10314DFC997B024EE796A678DEB02DD506BD7D8AD381A948E3FCE59A84E8B42 --node $RPC_URL
```

Check Balance

```bash
xiond q bank balances $SATYAM2 --node $RPC_URL
```

Transfer xion tokens

```bash
xiond tx bank send $SATYAM4 $SATYAM2  1960000uxion --chain-id xion-testnet-2 \
--node $RPC_URL \
--from $SATYAM4 \
--gas-prices 0.125uxion \
--gas auto \
--gas-adjustment 1.5 \
-y
```

```bash
xiond q zk verify-proof ./payload/proof.json  --vkey-name sudoku --public-inputs "$(cat payload/public_signals.txt)" --node $RPC_URL
```

```bash
xiond tx zk add-vkey withdraw_small ./vkeys/withdraw_small_vkey.json "Tornado cash Withdraw" --from $SATYAM2 --chain-id xion-testnet-2 --node $RPC_URL --gas 2774643 --gas-prices 0.1uxion
```

xiond tx zk add-vkey comm ./vkeys/sudoku_vkey.json "Tornado cash commitment" --from $SATYAM2 --chain-id xion-testnet-2 --node $RPC_URL --gas auto --gas-prices 1uxion --gas-adjustment 0.4

commitment: vkey_id 7

withdraw_small: vkey_id 8
