//! Tornado Cash contract for private deposits and withdrawals with zero-knowledge proofs

#[cfg(not(feature = "library"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    coin, to_json_binary, BankMsg, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
    Uint128, Uint256,
};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, DepositResponse, ExecuteMsg, InstantiateMsg, MerkleRootResponse,
    NullifierUsedResponse, QueryMsg,
};
use crate::state::{State, COMMITMENTS, DEPOSITS, MERKLE_ROOT, NULLIFIERS, STATE};
use crate::types::{Deposit, Groth16Proof};
use crate::verifier::verify_withdraw_proof;

const _CONTRACT_NAME: &str = "crates.io:tornado-cash";
const _CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let state = State::new(msg.denomination);
    STATE.save(deps.storage, &state)?;

    // Initialize merkle root to zero
    MERKLE_ROOT.save(deps.storage, &Uint256::zero())?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("denomination", msg.denomination.to_string()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::Deposit { commitment } => execute_deposit(deps, env, info, commitment),
        ExecuteMsg::Withdraw {
            proof,
            public_inputs,
            root,
            nullifier_hash,
            recipient,
            relayer,
            fee,
            refund,
        } => execute_withdraw(
            deps,
            env,
            info,
            proof,
            public_inputs,
            root,
            nullifier_hash,
            recipient,
            relayer,
            fee,
            refund,
        ),
    }
}

fn execute_deposit(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    commitment: Uint256,
) -> Result<Response, ContractError> {
    let state = STATE.load(deps.storage)?;

    // Check if exact denomination was sent
    let amount = info
        .funds
        .iter()
        .find(|c| c.denom == "uxion")
        .map(|c| c.amount)
        .unwrap_or(Uint128::zero());

    if amount != state.denomination {
        return Err(ContractError::IncorrectDepositAmount);
    }

    // Check if tree is full
    let max_leaves = 1u32 << state.merkle_tree_levels;
    if state.next_leaf_index >= max_leaves {
        return Err(ContractError::MerkleTreeFull);
    }

    // Check if commitment already exists (prevent replay)
    for i in 0..state.next_leaf_index {
        if let Ok(existing) = COMMITMENTS.load(deps.storage, i) {
            if existing == commitment {
                return Err(ContractError::CommitmentAlreadyExists);
            }
        }
    }

    // Store commitment
    let leaf_index = state.next_leaf_index;
    COMMITMENTS.save(deps.storage, leaf_index, &commitment)?;

    // Create deposit record
    let deposit_id = state.next_deposit_id;
    let deposit = Deposit {
        id: deposit_id,
        commitment,
        leaf_index,
        depositor: info.sender.clone(),
        amount,
        timestamp: env.block.time,
    };
    DEPOSITS.save(deps.storage, deposit_id, &deposit)?;

    // Update state
    let mut new_state = state;
    new_state.next_deposit_id += 1;
    new_state.next_leaf_index += 1;
    STATE.save(deps.storage, &new_state)?;

    // Update merkle root (simplified: just hash all commitments)
    update_merkle_root(
        deps.storage,
        new_state.next_leaf_index,
        new_state.merkle_tree_levels,
    )?;

    Ok(Response::new()
        .add_attribute("action", "deposit")
        .add_attribute("deposit_id", deposit_id.to_string())
        .add_attribute("commitment", commitment.to_string())
        .add_attribute("leaf_index", leaf_index.to_string()))
}

fn execute_withdraw(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    proof: Groth16Proof,
    public_inputs: Vec<Uint256>,
    root: Uint256,
    nullifier_hash: Uint256,
    recipient: String,
    relayer: String,
    fee: Uint256,
    refund: Uint256,
) -> Result<Response, ContractError> {
    let state = STATE.load(deps.storage)?;

    // Validate recipient address
    let recipient_addr = deps.api.addr_validate(&recipient)?;

    // Check nullifier hasn't been used
    let nullifier_key = nullifier_hash.to_string();
    if NULLIFIERS
        .may_load(deps.storage, nullifier_key.clone())?
        .unwrap_or(false)
    {
        return Err(ContractError::NullifierAlreadyUsed);
    }

    // Verify merkle root matches current root
    let current_root = MERKLE_ROOT.load(deps.storage)?;
    if root != current_root {
        return Err(ContractError::InvalidMerkleRoot);
    }

    // Verify the proof using XION module
    let proof_tuple = (proof.a, proof.b, proof.c);
    let verified = verify_withdraw_proof(deps.as_ref(), &proof_tuple, &public_inputs)?;

    if !verified {
        return Err(ContractError::InvalidProof);
    }

    // Mark nullifier as used
    NULLIFIERS.save(deps.storage, nullifier_key, &true)?;

    // Calculate amounts
    let fee_amount = uint256_to_uint128(fee)?;
    let refund_amount = uint256_to_uint128(refund)?;
    let total_fee = fee_amount.checked_add(refund_amount)?;
    let recipient_amount = state.denomination.checked_sub(total_fee)?;

    // Create bank messages
    let mut messages = vec![];

    // Send to recipient
    if !recipient_amount.is_zero() {
        messages.push(BankMsg::Send {
            to_address: recipient_addr.to_string(),
            amount: vec![coin(recipient_amount.u128(), "uxion")],
        });
    }

    // Send fee to relayer if specified
    if !fee_amount.is_zero() && relayer != "0x0000000000000000000000000000000000000000" {
        let relayer_addr = deps.api.addr_validate(&relayer)?;
        messages.push(BankMsg::Send {
            to_address: relayer_addr.to_string(),
            amount: vec![coin(fee_amount.u128(), "uxion")],
        });
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("action", "withdraw")
        .add_attribute("nullifier_hash", nullifier_hash.to_string())
        .add_attribute("recipient", recipient)
        .add_attribute("amount", recipient_amount.to_string()))
}

#[cfg_attr(not(feature = "library"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Deposit { id } => to_json_binary(&query_deposit(deps, id)?),
        QueryMsg::IsNullifierUsed { nullifier_hash } => {
            to_json_binary(&query_nullifier_used(deps, nullifier_hash)?)
        }
        QueryMsg::MerkleRoot {} => to_json_binary(&query_merkle_root(deps)?),
    }
}

fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let state = STATE.load(deps.storage)?;
    Ok(ConfigResponse {
        denomination: state.denomination,
        merkle_tree_levels: state.merkle_tree_levels,
        next_leaf_index: state.next_leaf_index,
    })
}

fn query_deposit(deps: Deps, id: u64) -> StdResult<DepositResponse> {
    let deposit = DEPOSITS.load(deps.storage, id)?;
    Ok(DepositResponse { deposit })
}

fn query_nullifier_used(deps: Deps, nullifier_hash: String) -> StdResult<NullifierUsedResponse> {
    let used = NULLIFIERS
        .may_load(deps.storage, nullifier_hash)?
        .unwrap_or(false);
    Ok(NullifierUsedResponse { used })
}

fn query_merkle_root(deps: Deps) -> StdResult<MerkleRootResponse> {
    let root = MERKLE_ROOT.load(deps.storage)?;
    Ok(MerkleRootResponse { root })
}

// Helper function to hash two values using Poseidon (matching circuit implementation)
fn hash_poseidon_pair(left: Uint256, right: Uint256) -> Uint256 {
    use ark_bn254::Fr;
    use ark_ff::{BigInteger, PrimeField};
    use light_poseidon::{Poseidon, PoseidonHasher};

    // Convert Uint256 to BN254 field elements
    // We take the bytes and convert them to field elements (mod the field order)
    let left_bytes = left.to_be_bytes();
    let right_bytes = right.to_be_bytes();

    // Convert to field elements
    let left_fr = Fr::from_be_bytes_mod_order(&left_bytes);
    let right_fr = Fr::from_be_bytes_mod_order(&right_bytes);

    // Create Poseidon hasher for BN254 (circom parameters with 2 inputs)
    let mut poseidon = Poseidon::<Fr>::new_circom(2).unwrap();

    // Hash the two inputs
    let hash_fr = poseidon.hash(&[left_fr, right_fr]).unwrap();

    // Convert back to Uint256
    let hash_bytes = hash_fr.into_bigint().to_bytes_be();

    // Pad to 32 bytes if needed
    let mut padded = [0u8; 32];
    let start = 32 - hash_bytes.len().min(32);
    padded[start..].copy_from_slice(&hash_bytes[..hash_bytes.len().min(32)]);

    Uint256::from_be_bytes(padded)
}

// Helper function to update merkle root
// Using Poseidon hash to match the circuit implementation
fn update_merkle_root(
    storage: &mut dyn cosmwasm_std::Storage,
    num_leaves: u32,
    levels: u32,
) -> StdResult<()> {
    let max_leaves = 1u32 << levels;
    let mut current_level: Vec<Uint256> = Vec::new();

    // Build leaves level
    for i in 0..max_leaves {
        let leaf = if i < num_leaves {
            COMMITMENTS.load(storage, i)?
        } else {
            Uint256::zero()
        };
        current_level.push(leaf);
    }

    // Build tree bottom-up using Poseidon hash
    for _ in 0..levels {
        let mut next_level: Vec<Uint256> = Vec::new();
        for i in (0..current_level.len()).step_by(2) {
            let left = current_level[i];
            let right = if i + 1 < current_level.len() {
                current_level[i + 1]
            } else {
                Uint256::zero()
            };

            // Hash left and right using Poseidon
            let hash = hash_poseidon_pair(left, right);
            next_level.push(hash);
        }
        current_level = next_level;
    }

    // Root is the last remaining element
    let root = current_level.first().copied().unwrap_or(Uint256::zero());
    MERKLE_ROOT.save(storage, &root)?;

    Ok(())
}

// Helper to convert address to Uint256 (for use in ZK circuit)
// For bech32 addresses, we hash them to get a field element
// For hex addresses starting with 0x, we decode them directly
fn address_to_uint256(address: &str) -> Result<Uint256, ContractError> {
    use sha2::{Digest, Sha256};

    // Check if it's a hex address or bech32
    if address.starts_with("0x") {
        // Hex address - decode it
        let hex = &address[2..];
        let padded = format!("{:0>64}", hex);
        let bytes: [u8; 32] = hex::decode(padded)
            .map_err(|_| ContractError::InvalidRecipient)?
            .try_into()
            .map_err(|_| ContractError::InvalidRecipient)?;
        Ok(Uint256::from_be_bytes(bytes))
    } else {
        // Bech32 address - hash it (same as test does)
        let mut hasher = Sha256::new();
        hasher.update(address.as_bytes());
        let hash = hasher.finalize();

        // Take first 30 bytes (240 bits) to ensure it fits in BN254 field
        let mut bytes = [0u8; 32];
        bytes[2..32].copy_from_slice(&hash[0..30]);

        Ok(Uint256::from_be_bytes(bytes))
    }
}

// Helper to convert Uint256 to Uint128 (for amounts)
fn uint256_to_uint128(val: Uint256) -> Result<Uint128, ContractError> {
    // Check if value fits in u128
    if val > Uint256::from_u128(u128::MAX) {
        return Err(ContractError::InvalidPublicInputs);
    }

    // Convert to bytes and take lower 16 bytes
    let bytes = val.to_be_bytes();
    let mut u128_bytes = [0u8; 16];
    u128_bytes.copy_from_slice(&bytes[16..32]);

    Ok(Uint128::new(u128::from_be_bytes(u128_bytes)))
}
