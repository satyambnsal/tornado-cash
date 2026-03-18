//! Tornado Cash contract for private deposits and withdrawals using zero-knowledge proofs

use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Uint128, Uint256};

use crate::types::{Deposit, Groth16Proof};

#[cw_serde]
pub struct InstantiateMsg {
    pub denomination: Uint128,
}

#[cw_serde]
pub enum ExecuteMsg {
    /// Deposit funds with a commitment hash
    Deposit { commitment: Uint256 },

    /// Withdraw funds by proving knowledge of commitment
    Withdraw {
        proof: Groth16Proof,
        public_inputs: Vec<Uint256>,
        root: Uint256,
        nullifier_hash: Uint256,
        recipient: String,
        relayer: String,
        fee: Uint256,
        refund: Uint256,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    /// Get contract configuration
    #[returns(ConfigResponse)]
    Config {},

    /// Get deposit by ID
    #[returns(DepositResponse)]
    Deposit { id: u64 },

    /// Check if nullifier has been used
    #[returns(NullifierUsedResponse)]
    IsNullifierUsed { nullifier_hash: String },

    /// Get current Merkle root
    #[returns(MerkleRootResponse)]
    MerkleRoot {},
}

#[cw_serde]
pub struct ConfigResponse {
    pub denomination: Uint128,
    pub merkle_tree_levels: u32,
    pub next_leaf_index: u32,
}

#[cw_serde]
pub struct DepositResponse {
    pub deposit: Deposit,
}

#[cw_serde]
pub struct NullifierUsedResponse {
    pub used: bool,
}

#[cw_serde]
pub struct MerkleRootResponse {
    pub root: Uint256,
}
