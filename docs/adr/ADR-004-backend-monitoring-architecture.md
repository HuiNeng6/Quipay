# ADR-004: Backend Monitoring Architecture

## Status

Accepted

## Context

Quipay's backend services need to monitor:
1. **Treasury Solvency**: Ensure `TreasuryBalance >= TotalLiability`
2. **Stream Health**: Detect stalled or problematic streams
3. **AI Agent Performance**: Track automation success rates
4. **System Reliability**: Monitor uptime and response times

### Problem

A decentralized payroll protocol requires reliable monitoring to:
- Prevent treasury insolvency (users can't withdraw if balance < liability)
- Detect and respond to anomalies (failed transactions, stuck streams)
- Provide transparency to employers and workers
- Support compliance reporting

## Decision

We implement a **modular monitoring architecture** with three layers:

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Monitoring Stack                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Solvency       │  │  Stream         │  │  AI Agent       │ │
│  │  Monitor        │  │  Monitor        │  │  Monitor        │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│                                ▼                                │
│                    ┌─────────────────────┐                     │
│                    │   Event Aggregator  │                     │
│                    │   (Redis Stream)    │                     │
│                    └─────────────────────┘                     │
│                                │                                │
│                                ▼                                │
│           ┌─────────────────────────────────────────┐          │
│           │         PostgreSQL Database             │          │
│           │  (Events, Metrics, Audit Trail)         │          │
│           └─────────────────────────────────────────┘          │
│                                │                                │
│                                ▼                                │
│           ┌─────────────────────────────────────────┐          │
│           │         Alert Dispatcher                │          │
│           │  (Email, Slack, On-chain Events)        │          │
│           └─────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Solvency Monitor

**Purpose**: Ensure treasury always meets liabilities

```typescript
interface SolvencyCheck {
  treasuryBalance: bigint;    // From PayrollVault contract
  totalLiability: bigint;     // Sum of all active streams
  healthFactor: number;       // treasuryBalance / totalLiability
  timestamp: Date;
}

// Alert conditions
if (healthFactor < 1.0) {
  // CRITICAL: Treasury insolvent
  triggerAlert('INSOLVENCY', { treasuryBalance, totalLiability });
}
if (healthFactor < 1.2) {
  // WARNING: Low buffer
  triggerAlert('LOW_BUFFER', { healthFactor });
}
```

**Check Frequency**: Every 5 minutes

### 2. Stream Monitor

**Purpose**: Track stream health and detect anomalies

```typescript
interface StreamHealth {
  streamId: string;
  status: 'active' | 'stalled' | 'completed' | 'cancelled';
  lastWithdrawal: Date;
  expectedAccrual: bigint;
  actualWithdrawn: bigint;
  anomalyScore: number;  // 0-1, higher = more suspicious
}
```

**Monitored Metrics**:
- Streams with no withdrawal in 30+ days (stuck funds)
- Streams where `withdrawn > expected` (potential exploit)
- Failed withdrawal attempts

### 3. AI Agent Monitor

**Purpose**: Track automation performance and reliability

```typescript
interface AgentMetrics {
  agentAddress: string;
  totalExecutions: number;
  successRate: number;
  averageLatency: number;
  lastExecution: Date;
  failedActions: FailedAction[];
}
```

**Key Metrics**:
- Success rate of automated payroll runs
- Average execution latency
- Failed transaction count and reasons

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Event Queue | Redis Streams | High throughput, persistent, supports consumer groups |
| Database | PostgreSQL | ACID compliance, complex queries, audit trail |
| Alerting | Custom + External | Email/Slack for critical, on-chain events for transparency |
| Metrics | Prometheus | Industry standard, Grafana integration |

## Consequences

### Positive
- **Early Warning**: Detect issues before they become critical
- **Compliance**: Full audit trail for regulatory requirements
- **Transparency**: Employers can verify system health
- **Reliability**: Automated checks reduce human error

### Negative
- **Infrastructure Cost**: Additional services to maintain
- **Complexity**: More moving parts to monitor
- **Latency**: Monitoring adds slight delay to alerts

### Operational Considerations

| Aspect | Approach |
|--------|----------|
| High Availability | Run monitors in active-active mode |
| Data Retention | Keep metrics for 90 days, audit logs for 7 years |
| Alert Routing | Critical → Immediate notification; Warning → Daily digest |
| False Positive Handling | Require 2+ consecutive failures before alert |

## Alternatives Considered

### 1. Fully On-Chain Monitoring
- Store all metrics in smart contract storage
- **Rejected**: Too expensive (storage costs), slow queries

### 2. External Monitoring Service (e.g., Tenderly)
- Use third-party service for all monitoring
- **Rejected**: Centralization risk, less control, cost

### 3. Client-Side Monitoring Only
- Frontend displays real-time data
- **Rejected**: No historical data, can't detect backend issues

## References

- [Backend Source](../../backend/)
- [API Documentation](../API.md)
- [Deployment Guide](../DEPLOYMENT.md)