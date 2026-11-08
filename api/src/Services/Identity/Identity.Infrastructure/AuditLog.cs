using MediPath.BuildingBlocks.Audit;
using MediPath.Identity.Application.Abstractions;

namespace MediPath.Identity.Infrastructure;

/// <summary>Adapts the shared BuildingBlocks audit writer (which stages on the Identity DbContext) to the Application port.</summary>
public sealed class AuditLog(IAuditWriter writer) : IAuditLog
{
    public void Record(string eventType, Guid? userId = null, string? subject = null, string? detail = null) =>
        writer.Add(eventType, userId, subject, detail);
}
