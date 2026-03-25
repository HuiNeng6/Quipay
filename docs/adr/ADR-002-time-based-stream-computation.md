# ADR-002: Time-Based Stream Computation vs Epoch-Based

## Status

Accepted

## Context

Salary streaming requires a mechanism to calculate how much of a total payment has vested at any given time. We evaluated two primary approaches:

1. **Time-Based Computation**: Calculate vested amount using block timestamps (`current_time - start_time`)
2. **Epoch-Based Computation**: Divide time into discrete intervals (daily/weekly) with fixed vesting amounts

### Problem

The choice affects:
- User experience (real-time vs delayed vesting)
- Gas costs (computation complexity)
- Front-running risks (timing attacks)
- Cross-chain compatibility (timestamp reliability)

## Decision

We implement **time-based stream computation** using Stellar ledger timestamps.

### Implementation

```rust
fn calculate_vested(stream: &Stream, current_ts: u64) -> i128 {
    if current_ts <= stream.start_ts {
        return 0;
    }
    if current_ts >= stream.end_ts {
        return stream.amount;
    }
    
    let elapsed = current_ts - stream.start_ts;
    let duration = stream.end_ts - stream.start_ts;
    
    (stream.amount * elapsed as i128) / duration as i128
}
```

### Key Properties

1. **Continuous Vesting**: Funds accrue per-second, not per-interval
2. **Deterministic Calculation**: Same input always yields same output
3. **No State Updates**: Vesting is calculated on-demand, not stored

## Consequences

### Positive
- **Real-Time UX**: Workers see earnings grow every second
- **Lower Gas**: No need to update state each epoch
- **Simple Logic**: Linear calculation is easy to verify and audit
- **Flexible Withdrawals**: Workers can withdraw any amount at any time
- **No "Cliff" Issues**: No arbitrary waiting periods

### Negative
- **Timestamp Dependency**: Relies on accurate ledger timestamps
- **Front-Running Risk**: Users might time withdrawals based on pending transactions
- **Overflow Potential**: Large amounts × large timestamps need careful handling

### Mitigations

| Risk | Mitigation |
|------|------------|
| Timestamp manipulation | Stellar's consensus ensures reasonable timestamp accuracy |
| Front-running | Withdrawals are capped to vested amount; no advantage to timing |
| Overflow | Use `i128` for amounts; validate stream duration limits |

## Alternatives Considered

### Epoch-Based Computation
```
Day 1: 1/30 of salary vests
Day 2: 1/30 of salary vests
...
```

**Pros**:
- Predictable vesting schedule
- Easier to implement "cliff" periods
- Natural fit for traditional payroll cycles

**Cons**:
- Delayed vesting (user waits for next epoch)
- State updates required each epoch
- More complex logic for partial epochs
- "Rounding losses" if not evenly divisible

**Decision**: Rejected for MVP due to worse user experience (delayed vesting).

### Hybrid Approach
- Time-based for streams under 1 year
- Epoch-based for longer streams

**Decision**: Rejected as premature optimization. Can revisit if performance data suggests need.

## References

- [PayrollStream Contract](../../contracts/payroll_stream/src/lib.rs)
- [Security Threat Model - Timestamp Validation](../SECURITY_THREAT_MODEL.md)