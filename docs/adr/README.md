# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Quipay protocol.

## What is an ADR?

An ADR is a document that captures an important architectural decision along with its context and consequences. ADRs help teams understand why specific technical choices were made.

## ADR Index

| Number | Title | Status |
|--------|-------|--------|
| [ADR-001](./ADR-001-vault-stream-separation.md) | Vault-Stream Separation Pattern | Accepted |
| [ADR-002](./ADR-002-time-based-stream-computation.md) | Time-Based Stream Computation vs Epoch-Based | Accepted |
| [ADR-003](./ADR-003-automation-gateway-authorization.md) | Automation Gateway Authorization Model | Accepted |
| [ADR-004](./ADR-004-backend-monitoring-architecture.md) | Backend Monitoring Architecture | Accepted |

## ADR Template

For new ADRs, use the following structure:

```markdown
# ADR-NNN: Title

## Status

[Proposed | Accepted | Deprecated | Superseded]

## Context

[Describe the situation and problem]

## Decision

[Describe the decision made]

## Consequences

### Positive
- [Benefits]

### Negative
- [Drawbacks]

### Neutral
- [Side effects]

## Alternatives Considered

[Describe other options and why they were rejected]

## References

[Links to related documents]
```

## Related Documentation

- [Smart Contracts](../CONTRACTS.md)
- [Security Threat Model](../SECURITY_THREAT_MODEL.md)
- [Design Overview](../design.md)