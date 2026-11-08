using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace MediPath.BuildingBlocks.Audit;

public interface IAuditWriter
{
    /// <summary>Stages an audit event on the current DbContext; it is saved with the caller's SaveChanges so the event and the change commit together.</summary>
    void Add(string eventType, Guid? userId = null, string? subject = null, string? detail = null);
}

public sealed class AuditWriter<TContext>(TContext db, IHttpContextAccessor http, TimeProvider clock) : IAuditWriter
    where TContext : DbContext
{
    public void Add(string eventType, Guid? userId = null, string? subject = null, string? detail = null)
    {
        var ctx = http.HttpContext;
        db.Set<AuditEvent>().Add(new AuditEvent
        {
            OccurredAt = clock.GetUtcNow(),
            EventType = eventType,
            UserId = userId,
            Subject = subject,
            IpAddress = ctx?.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Truncate(ctx?.Request.Headers.UserAgent.ToString(), 512),
            ClientType = Truncate(ctx?.Request.Headers["X-Client"].ToString(), 32),
            Detail = detail,
        });
    }

    private static string? Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? null : s.Length <= max ? s : s[..max];
}
