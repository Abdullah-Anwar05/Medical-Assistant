using System.Text.Json;
using MediPath.Identity.Application.Common;

namespace MediPath.Identity.Api.Endpoints;

/// <summary>How the refresh token travels: mobile (X-Client: mobile) in the JSON body, web in an HttpOnly cookie.</summary>
public interface ITokenDelivery
{
    Task<string?> ReadRefreshTokenAsync(HttpContext context, CancellationToken ct);
    AuthResponse Deliver(HttpContext context, AuthSession session);
    /// <summary>Removes the web refresh cookie; nothing to do for mobile, which discards its stored token.</summary>
    void ClearRefreshToken(HttpContext context);
}

public sealed class ClientTokenDelivery : ITokenDelivery
{
    public const string RefreshCookie = "mp_refresh";
    public const string ClientHeader = "X-Client";
    public const string MobileClient = "mobile";

    public async Task<string?> ReadRefreshTokenAsync(HttpContext context, CancellationToken ct)
    {
        if (!IsMobile(context))
            return context.Request.Cookies[RefreshCookie];
        if (context.Request.ContentLength is 0 || !context.Request.HasJsonContentType())
            return null;
        try
        {
            var body = await context.Request.ReadFromJsonAsync<RefreshRequest>(ct);
            return body?.RefreshToken;
        }
        catch (JsonException)
        {
            return null; // malformed body is treated as "no token presented"
        }
    }

    public AuthResponse Deliver(HttpContext context, AuthSession session)
    {
        if (IsMobile(context))
            return new AuthResponse(session.AccessToken, session.AccessTokenExpiresAt, session.RefreshToken, session.User);

        context.Response.Cookies.Append(RefreshCookie, session.RefreshToken, CookieOptions(session.RefreshTokenExpiresAt));
        return new AuthResponse(session.AccessToken, session.AccessTokenExpiresAt, null, session.User);
    }

    public void ClearRefreshToken(HttpContext context)
    {
        if (!IsMobile(context))
            context.Response.Cookies.Delete(RefreshCookie, CookieOptions(null));
    }

    private static bool IsMobile(HttpContext context) =>
        string.Equals(context.Request.Headers[ClientHeader], MobileClient, StringComparison.OrdinalIgnoreCase);

    private static CookieOptions CookieOptions(DateTimeOffset? expires) => new()
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = IdentityEndpoints.BasePath,
        Expires = expires,
        IsEssential = true,
    };
}
