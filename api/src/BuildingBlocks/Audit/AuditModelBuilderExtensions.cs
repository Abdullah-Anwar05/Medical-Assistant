using Microsoft.EntityFrameworkCore;

namespace MediPath.BuildingBlocks.Audit;

public static class AuditModelBuilderExtensions
{
    public static ModelBuilder MapAuditEvents(this ModelBuilder b)
    {
        b.Entity<AuditEvent>(e =>
        {
            e.ToTable("audit_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.EventType).HasMaxLength(64).IsRequired();
            e.Property(x => x.Subject).HasMaxLength(320);
            e.Property(x => x.IpAddress).HasMaxLength(64);
            e.Property(x => x.UserAgent).HasMaxLength(512);
            e.Property(x => x.ClientType).HasMaxLength(32);
            e.HasIndex(x => x.OccurredAt);
            e.HasIndex(x => x.UserId);
        });
        return b;
    }
}
