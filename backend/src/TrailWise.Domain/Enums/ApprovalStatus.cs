namespace TrailWise.Domain.Enums;

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected,
    RevisionRequested,
    /// <summary>Replaced by a newer request for the same booking (e.g. the workflow was re-run).</summary>
    Superseded
}
