# ADR-001: Vault-Stream Separation Pattern

## Status

Accepted

## Context

Quipay requires a secure and scalable architecture for managing employer funds and salary streams. We considered two main approaches:

1. **Monolithic Contract**: A single contract handling both treasury management and stream calculations
2. **Separated Contracts**: Distinct contracts for treasury (`PayrollVault`) and streaming (`PayrollStream`)

### Problem

A monolithic design creates several issues:
- **Single Point of Failure**: A bug in streaming logic could compromise treasury funds
- **Upgrade Complexity**: Any change requires upgrading the entire system
- **Permission Sprawl**: Different roles (employer, admin, AI agent) need different access levels
- **Testing Complexity**: Larger codebase increases audit surface

## Decision

We separate concerns into two primary contracts:

### PayrollVault (Treasury Management)
- Custody of employer funds
- Deposit and payout operations
- Liability tracking (`TotalLiability <= TreasuryBalance`)
- Multisig support for DAOs

### PayrollStream (Salary Streaming)
- Stream creation and management
- Time-based accrual calculations
- Withdrawal processing
- Stream cancellation

### Communication Pattern

```
┌─────────────────┐         ┌─────────────────┐
│  PayrollVault   │◄────────│  PayrollStream  │
│  (Treasury)     │  payout │  (Streaming)    │
└─────────────────┘         └─────────────────┘
        ▲                           │
        │                           │
        └───────────────────────────┘
              Authorization
```

The `PayrollStream` contract authorizes withdrawals through the vault, maintaining clear ownership boundaries.

## Consequences

### Positive
- **Security Isolation**: Treasury funds are protected even if streaming logic has issues
- **Independent Upgrades**: Stream logic can be updated without touching treasury
- **Clear Permissions**: Vault admin ≠ stream admin for fine-grained control
- **Audit Simplicity**: Smaller contracts are easier to verify
- **Composability**: Other protocols can integrate with vault independently

### Negative
- **Cross-Contract Calls**: Slight gas overhead for vault-stream interactions
- **State Synchronization**: Need to ensure liability tracking is accurate across contracts
- **Deployment Complexity**: Two contracts to deploy and configure

### Neutral
- Requires clear interface definitions between contracts
- Need to handle upgrade scenarios where contracts might be at different versions

## Alternatives Considered

1. **Single Contract**: Rejected due to security concerns and upgrade complexity
2. **Three-Contract Split** (Vault + Stream + Bridge): Rejected as over-engineering for MVP
3. **Factory Pattern**: Considered for multi-employer isolation, deferred to future phase

## References

- [Smart Contract Documentation](../CONTRACTS.md)
- [Security Threat Model](../SECURITY_THREAT_MODEL.md)