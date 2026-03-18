use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Timestamp, Uint128, Uint256};

#[cw_serde]
pub struct Groth16Proof {
    pub a: [Uint256; 2],
    pub b: [[Uint256; 2]; 2],
    pub c: [Uint256; 2],
}

#[cw_serde]
pub struct Deposit {
    pub id: u64,
    pub commitment: Uint256,
    pub leaf_index: u32,
    pub depositor: Addr,
    pub amount: Uint128,
    pub timestamp: Timestamp,
}

#[cw_serde]
pub struct Withdrawal {
    pub nullifier_hash: Uint256,
    pub recipient: Addr,
    pub amount: Uint128,
    pub timestamp: Timestamp,
}
