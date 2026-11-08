namespace MediPath.Identity.Application.Common;

public static class AuditEventTypes
{
    public const string Registered = "identity.register";
    public const string LoginSucceeded = "identity.login.succeeded";
    public const string LoginFailed = "identity.login.failed";
    public const string LoginLockedOut = "identity.login.locked_out";
    public const string RefreshSucceeded = "identity.refresh.succeeded";
    public const string RefreshFailed = "identity.refresh.failed";
    public const string RefreshReuseDetected = "identity.refresh.reuse_detected";
    public const string Logout = "identity.logout";
}
