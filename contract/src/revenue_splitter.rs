//! RevenueSplitter: pro-rata parking revenue distribution for RWA cashflow holders.
//!
//! An owner registers holders with a number of shares. A daily revenue report is
//! submitted as a payable call: the attached native token amount is the day's
//! revenue, and it is split pro-rata across all registered holders by
//! `holder_shares / total_shares`. Each day can be reported exactly once, and a
//! report is rejected outright if the caller (agent pipeline) flags an anomaly.
//!
//! There is no separate on-chain agent role in this MVP: the anomaly-checking
//! agent runs off-chain and calls `report_revenue` through the owner-controlled
//! account, so the same `NotOwner` guard covers both the owner and the agent
//! pipeline. Splitting "owner" and "agent" into distinct addresses is a
//! straightforward follow-on (an extra `Var<Address>` plus an owner-only setter)
//! that was not part of the frozen interface for this contract.

use odra::casper_types::U512;
use odra::prelude::*;

/// Errors returned to callers. Field-less enum with explicit discriminants so the
/// on-chain error codes are stable across builds.
#[odra::odra_error]
pub enum Error {
    /// A non-owner tried to call an owner-only entrypoint.
    NotOwner = 1,
    /// This day already has a finalized revenue report.
    DayAlreadyReported = 2,
    /// The report was rejected because the anomaly checker did not clear it.
    AnomalyFlagged = 3,
    /// There are no registered holders to distribute revenue to.
    NoHolders = 4,
}

/// Emitted when the owner registers (or tops up) a holder's shares.
#[odra::event]
pub struct HolderRegistered {
    pub holder: Address,
    pub shares: u64,
}

/// Emitted when a day's revenue is successfully distributed to all holders.
#[odra::event]
pub struct RevenueDistributed {
    pub day: u64,
    pub amount: U512,
    pub total_shares: u64,
    pub report_hash: String,
}

/// The RevenueSplitter contract module.
#[odra::module(
    events = [HolderRegistered, RevenueDistributed],
    errors = Error
)]
pub struct RevenueSplitter {
    owner: Var<Address>,
    holder_shares: Mapping<Address, u64>,
    holders: List<Address>,
    total_shares: Var<u64>,
    reported_days: Mapping<u64, bool>,
}

#[odra::module]
impl RevenueSplitter {
    /// Initializes the splitter with the deployer as the owner.
    pub fn init(&mut self) {
        self.owner.set(self.env().caller());
    }

    /// Registers `holder` with `shares`, adding to any shares already on file.
    /// Owner only. The holder is tracked in an iterable list the first time it
    /// is registered so `report_revenue` can walk every holder on distribution.
    pub fn register_holder(&mut self, holder: Address, shares: u64) {
        self.assert_owner();

        let existing = self.holder_shares.get(&holder).unwrap_or_default();
        if existing == 0 {
            self.holders.push(holder);
        }
        self.holder_shares.set(&holder, existing + shares);
        self.total_shares
            .set(self.total_shares.get_or_default() + shares);

        self.env().emit_event(HolderRegistered { holder, shares });
    }

    /// Reports and distributes one day's parking revenue. The attached native
    /// token value is the revenue for `day`. Owner/agent-pipeline only.
    ///
    /// Reverts, in order:
    /// - `DayAlreadyReported` if `day` was already finalized.
    /// - `AnomalyFlagged` if `anomaly_ok` is false.
    /// - `NoHolders` if no shares have ever been registered.
    ///
    /// On success, transfers `holder_shares * amount / total_shares` to each
    /// registered holder and emits `RevenueDistributed`.
    #[odra(payable)]
    pub fn report_revenue(&mut self, day: u64, report_hash: String, anomaly_ok: bool) {
        self.assert_owner();

        if self.reported_days.get(&day).unwrap_or(false) {
            self.env().revert(Error::DayAlreadyReported);
        }
        if !anomaly_ok {
            self.env().revert(Error::AnomalyFlagged);
        }
        let total_shares = self.total_shares.get_or_default();
        if total_shares == 0 {
            self.env().revert(Error::NoHolders);
        }

        // Mark the day reported before paying out (checks-effects-interactions).
        self.reported_days.set(&day, true);

        let amount = self.env().attached_value();
        for holder in self.holders.iter() {
            let shares = self.holder_shares.get(&holder).unwrap_or_default();
            if shares == 0 {
                continue;
            }
            let payout = amount * U512::from(shares) / U512::from(total_shares);
            if !payout.is_zero() {
                self.env().transfer_tokens(&holder, &payout);
            }
        }

        self.env().emit_event(RevenueDistributed {
            day,
            amount,
            total_shares,
            report_hash,
        });
    }

    /// Returns the current owner.
    pub fn get_owner(&self) -> Address {
        self.owner.get_or_revert_with(Error::NotOwner)
    }

    /// Returns the total registered shares across all holders.
    pub fn get_total_shares(&self) -> u64 {
        self.total_shares.get_or_default()
    }

    /// Returns the shares registered for `holder`, or 0 if never registered.
    pub fn get_holder_shares(&self, holder: Address) -> u64 {
        self.holder_shares.get(&holder).unwrap_or_default()
    }

    /// Returns true if `day` already has a finalized revenue report.
    pub fn is_day_reported(&self, day: u64) -> bool {
        self.reported_days.get(&day).unwrap_or(false)
    }

    fn assert_owner(&self) {
        if self.env().caller() != self.owner.get_or_revert_with(Error::NotOwner) {
            self.env().revert(Error::NotOwner);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Error, HolderRegistered, RevenueDistributed, RevenueSplitter, RevenueSplitterHostRef};
    use odra::casper_types::U512;
    use odra::host::{Deployer, HostEnv, HostRef, NoArgs};

    fn setup() -> (HostEnv, RevenueSplitterHostRef) {
        let env = odra_test::env();
        // Account 0 is the deployer/owner.
        env.set_caller(env.get_account(0));
        let contract = RevenueSplitter::deploy(&env, NoArgs);
        (env, contract)
    }

    #[test]
    fn owner_is_deployer() {
        let (env, contract) = setup();
        assert_eq!(contract.get_owner(), env.get_account(0));
    }

    #[test]
    fn register_holder_accumulates_shares_and_emits_event() {
        let (env, mut contract) = setup();
        let holder = env.get_account(1);

        env.set_caller(env.get_account(0));
        contract.register_holder(holder, 60);

        assert!(env.emitted_event(
            &contract,
            HolderRegistered {
                holder,
                shares: 60,
            }
        ));
        assert_eq!(contract.get_holder_shares(holder), 60);
        assert_eq!(contract.get_total_shares(), 60);

        // Registering the same holder again tops up shares without a duplicate
        // entry in the iteration list (verified indirectly via total_shares).
        contract.register_holder(holder, 10);
        assert_eq!(contract.get_holder_shares(holder), 70);
        assert_eq!(contract.get_total_shares(), 70);
    }

    #[test]
    fn non_owner_cannot_register_holder() {
        let (env, mut contract) = setup();
        let non_owner = env.get_account(1);
        let holder = env.get_account(2);

        env.set_caller(non_owner);
        assert_eq!(
            contract.try_register_holder(holder, 100),
            Err(Error::NotOwner.into())
        );
    }

    #[test]
    fn report_revenue_distributes_pro_rata_and_emits_event() {
        let (env, mut contract) = setup();
        let holder_a = env.get_account(1);
        let holder_b = env.get_account(2);

        env.set_caller(env.get_account(0));
        contract.register_holder(holder_a, 60);
        contract.register_holder(holder_b, 40);

        let holder_a_balance_before = env.balance_of(&holder_a);
        let holder_b_balance_before = env.balance_of(&holder_b);

        let revenue = U512::from(1_000u64);
        contract
            .with_tokens(revenue)
            .report_revenue(1, "report-hash-1".to_string(), true);

        assert!(env.emitted_event(
            &contract,
            RevenueDistributed {
                day: 1,
                amount: revenue,
                total_shares: 100,
                report_hash: "report-hash-1".to_string(),
            }
        ));

        // 60/100 * 1000 = 600, 40/100 * 1000 = 400.
        assert_eq!(
            env.balance_of(&holder_a),
            holder_a_balance_before + U512::from(600u64)
        );
        assert_eq!(
            env.balance_of(&holder_b),
            holder_b_balance_before + U512::from(400u64)
        );
        assert!(contract.is_day_reported(1));
    }

    #[test]
    fn report_revenue_reverts_when_anomaly_flagged() {
        let (env, mut contract) = setup();
        let holder = env.get_account(1);

        env.set_caller(env.get_account(0));
        contract.register_holder(holder, 100);

        assert_eq!(
            contract
                .with_tokens(U512::from(500u64))
                .try_report_revenue(1, "hash".to_string(), false),
            Err(Error::AnomalyFlagged.into())
        );
        assert!(!contract.is_day_reported(1));
    }

    #[test]
    fn report_revenue_reverts_on_duplicate_day() {
        let (env, mut contract) = setup();
        let holder = env.get_account(1);

        env.set_caller(env.get_account(0));
        contract.register_holder(holder, 100);

        contract
            .with_tokens(U512::from(500u64))
            .report_revenue(1, "hash-1".to_string(), true);

        assert_eq!(
            contract
                .with_tokens(U512::from(200u64))
                .try_report_revenue(1, "hash-2".to_string(), true),
            Err(Error::DayAlreadyReported.into())
        );
    }

    #[test]
    fn report_revenue_reverts_when_no_holders() {
        let (env, contract) = setup();

        env.set_caller(env.get_account(0));
        assert_eq!(
            contract
                .with_tokens(U512::from(500u64))
                .try_report_revenue(1, "hash".to_string(), true),
            Err(Error::NoHolders.into())
        );
    }

    #[test]
    fn report_revenue_reverts_for_non_owner() {
        let (env, mut contract) = setup();
        let non_owner = env.get_account(1);
        let holder = env.get_account(2);

        env.set_caller(env.get_account(0));
        contract.register_holder(holder, 100);

        env.set_caller(non_owner);
        assert_eq!(
            contract
                .with_tokens(U512::from(500u64))
                .try_report_revenue(1, "hash".to_string(), true),
            Err(Error::NotOwner.into())
        );
    }
}
