//! `odra-cli` entrypoint for deploying and interacting with `RevenueSplitter`.
//!
//! Build the CLI binary with `cargo build --bin revenue_splitter_cli` and run it
//! with `--help` to see the deploy and scenario commands.

use odra::host::{HostEnv, NoArgs};
use odra_cli::{
    deploy::DeployScript, ContractProvider, DeployedContractsContainer, DeployerExt, OdraCli,
};
use revenue_splitter::revenue_splitter::RevenueSplitter;

/// Deploys `RevenueSplitter` and registers it in the deployed-contracts container.
pub struct RevenueSplitterDeployScript;

impl DeployScript for RevenueSplitterDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let _splitter = RevenueSplitter::load_or_deploy(
            env,
            NoArgs,
            container,
            350_000_000_000, // gas limit in motes; adjust for the target network
        )?;
        Ok(())
    }
}

/// Main function to run the CLI tool.
pub fn main() {
    OdraCli::new()
        .about("CLI tool for the RevenueSplitter smart contract")
        .deploy(RevenueSplitterDeployScript)
        .contract::<RevenueSplitter>()
        .build()
        .run();
}
