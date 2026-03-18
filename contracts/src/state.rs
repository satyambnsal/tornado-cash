use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Uint128, Uint256};
use cw_storage_plus::{Item, Map};

use crate::types::Deposit;

#[cw_serde]
pub struct State {
    pub next_deposit_id: u64,
    pub next_leaf_index: u32,
    pub merkle_tree_levels: u32,
    pub denomination: Uint128, // Fixed deposit amount
}

impl State {
    pub fn new(denomination: Uint128) -> Self {
        Self {
            next_deposit_id: 1,
            next_leaf_index: 0,
            merkle_tree_levels: 10, // Supports 2^10 = 1024 deposits
            denomination,
        }
    }
}

pub const STATE: Item<State> = Item::new("state");
pub const DEPOSITS: Map<u64, Deposit> = Map::new("deposits");
pub const COMMITMENTS: Map<u32, Uint256> = Map::new("commitments"); // leaf_index -> commitment
pub const NULLIFIERS: Map<String, bool> = Map::new("nullifiers"); // nullifier_hash -> used
pub const MERKLE_ROOT: Item<Uint256> = Item::new("merkle_root");
