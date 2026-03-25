# ADR-003: Automation Gateway Authorization Model

## Status

Accepted

## Context

Quipay's vision includes an AI agent that can execute payroll operations on behalf of employers. This requires careful authorization design to balance:

1. **Automation**: AI can perform routine tasks without constant user approval
2. **Security**: Unauthorized agents cannot access or move funds
3. **Flexibility**: Different agents might have different capabilities
4. **Revocability**: Employers can remove agent access at any time

### Problem

We need an authorization model that:
- Defines what actions an AI agent can perform
- Prevents unauthorized access to treasury funds
- Supports granular permissions (some agents can only read, others can execute)
- Integrates cleanly with Stellar's existing auth model

## Decision

We implement a **capability-based authorization model** through the `AutomationGateway` contract.

### Permission System

```rust
enum Permission {
    ExecutePayroll = 1,    // Run scheduled payroll
    ManageTreasury = 2,    // Deposit/withdraw funds
    RegisterAgent = 3,     // Add new agents (admin only)
    ViewReports = 4,       // Read-only access
    EmergencyPause = 5,    // Halt operations
}
```

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AutomationGateway                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Agent A   │  │   Agent B   │  │   Agent C   │        │
│  │ [ExecPay]   │  │ [ViewOnly]  │  │ [ExecPay,   │        │
│  │ [Emergency] │  │             │  │  ManageTreas]│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│                      │                                      │
│                      ▼                                      │
│            ┌─────────────────┐                             │
│            │ Permission Check│                             │
│            └─────────────────┘                             │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   PayrollVault/Stream  │
          │   (Actual Execution)   │
          └────────────────────────┘
```

### Authorization Flow

1. **Agent Registration**: Admin calls `register_agent(agent_address, permissions)`
2. **Action Request**: Agent calls `execute_automation(agent, action, data)`
3. **Permission Check**: Gateway verifies `is_authorized(agent, action)`
4. **Execution**: If authorized, gateway routes to target contract
5. **Audit Log**: All actions recorded for compliance

### Security Properties

| Property | Implementation |
|----------|---------------|
| **Least Privilege** | Each agent only has permissions explicitly granted |
| **Revocation** | Admin can call `revoke_agent()` instantly |
| **Audit Trail** | Every action logged with timestamp and caller |
| **Fail-Safe** | Invalid permissions cause transaction to revert |

## Consequences

### Positive
- **Granular Control**: Employers can limit AI to specific operations
- **Multi-Agent Support**: Different agents for different tasks (scheduling vs reporting)
- **Compliance Ready**: Full audit trail for regulatory requirements
- **Upgrade Flexibility**: Permissions can be added without contract changes

### Negative
- **Complexity**: Additional contract and logic to maintain
- **Gas Overhead**: Each operation requires permission check
- **Admin Responsibility**: Admin key becomes high-value target

### Mitigations

| Risk | Mitigation |
|------|------------|
| Admin key compromise | Support multisig admin accounts |
| Permission escalation | Strict validation on `register_agent` calls |
| Replay attacks | Include nonce/timestamp in action data |

## Alternatives Considered

### 1. Direct Authorization (No Gateway)
- Each contract maintains its own agent list
- **Rejected**: Duplicated logic, harder to audit

### 2. Role-Based Access Control (RBAC)
- Assign roles like "PayrollManager" to agents
- **Rejected**: Less flexible than capability-based; roles hard to change

### 3. Signed Messages (Off-Chain Auth)
- Employer signs messages authorizing specific actions
- **Deferred**: Considered for future, but adds UX complexity for MVP

## References

- [AutomationGateway Contract](../../contracts/automation_gateway/src/lib.rs)
- [Security Threat Model](../SECURITY_THREAT_MODEL.md)
- [DAO Treasury Setup Guide](../DAO_TREASURY_SETUP.md)