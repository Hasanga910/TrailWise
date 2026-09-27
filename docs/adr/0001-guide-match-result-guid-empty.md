# ADR 0001: GuideMatchResult Sentinel Value (Guid.Empty)

## Status
Accepted

## Context
In the original Person 2 subsystem specification, `GuideMatchResult.GuideId` was proposed as a nullable `Guid?` to represent cases where no candidate guide qualified for a tour package.

During early cross-module integration across the engineering team (Person 1 Coordinator, Person 2 Guide Management, Person 3 Fleet, Person 4 Pricing), the shared contract defined in `TrailWise.Infrastructure.Agents.IGuideMatchingAgent` standardized on a non-nullable `Guid`:

```csharp
public record GuideMatchResult(
    Guid GuideId,
    double MatchScore,
    string Reasoning);
```

In this contract:
- `Guid.Empty` serves as the explicit sentinel value indicating that no guide matched the criteria (accompanied by `MatchScore = 0.0` and a descriptive `Reasoning` string).
- A non-empty `Guid` represents a valid matched guide with a positive score (`MatchScore >= 0.5`).

This sentinel pattern is deeply embedded across:
1. `CoordinatorAgentService`: evaluates `guideResult.GuideId == Guid.Empty` and matching thresholds to orchestrate workflow steps and guide assignments.
2. `GuideAssignmentService`: validates guide identifiers before executing transactional slot assignments.
3. Pricing and Fleet agents / integration suites that mock or evaluate guide outcomes.
4. Comprehensive unit, integration, and coordinator test suites across `TrailWise.Api.Tests`.

## Decision
Retain `Guid.Empty` as the non-nullable sentinel value for `GuideMatchResult.GuideId` across all shared interfaces and implementations:
- `IGuideMatchingAgent.MatchAsync` continues to return a non-nullable `Guid GuideId`.
- No-match scenarios must consistently return `new GuideMatchResult(Guid.Empty, 0, reasoning)`.
- Do NOT alter `GuideId` to nullable `Guid?` at runtime or in contract interfaces.

## Consequences
- **Contract Stability**: Avoids breaking shared coordinator workflows, approval evaluator logic, mock agents, and dependent tests.
- **Consistency**: All sub-agents and orchestrator validation rules rely on predictable, non-null value types with well-defined sentinels.
- **Maintainability**: Clear and explicit documentation ensures future maintainers understand why `Guid.Empty` is used rather than `null`.
