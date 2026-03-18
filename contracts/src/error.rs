use cosmwasm_std::{OverflowError, StdError};
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("{0}")]
    Overflow(#[from] OverflowError),

    #[error("unauthorized")]
    Unauthorized,

    #[error("proof verification failed")]
    InvalidProof,

    #[error("incorrect deposit amount")]
    IncorrectDepositAmount,

    #[error("commitment already exists")]
    CommitmentAlreadyExists,

    #[error("merkle tree is full")]
    MerkleTreeFull,

    #[error("nullifier already used")]
    NullifierAlreadyUsed,

    #[error("invalid merkle root")]
    InvalidMerkleRoot,

    #[error("invalid recipient address")]
    InvalidRecipient,

    #[error("invalid public inputs")]
    InvalidPublicInputs,

    #[error("deposit not found")]
    DepositNotFound,
}
