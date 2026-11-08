namespace MediPath.BuildingBlocks.Audit;

/// <summary>Append-only audit record. Each service maps it to an <c>audit_events</c> table in its own schema.</summary>
public sealed class AuditEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTimeOffset OccurredAt { get; set; }
    public string EventType { get; set; } = "";
    public Guid? UserId { get; set; }
    /// <summary>The identifier the actor presented (e.g. normalised email on a failed login), when there is no user id.</summary>
    public string? Subject { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? ClientType { get; set; }
    public string? Detail { get; set; }
}
