namespace MediPath.BuildingBlocks.Auth;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "medipath";
    public string Audience { get; set; } = "medipath-api";

    /// <summary>HS256 key, at least 32 bytes. Supplied via user-secrets or env var Jwt__SigningKey — never in appsettings.</summary>
    public string SigningKey { get; set; } = "";

    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 14;
}
