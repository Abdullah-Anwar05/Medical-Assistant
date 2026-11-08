using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;

namespace MediPath.BuildingBlocks.Auth;

public static class JwtServiceCollectionExtensions
{
    public const string RoleClaim = "role";
    public const string OrganisationClaim = "org";

    /// <summary>Registers JwtOptions and JWT bearer validation shared by every MediPath service.</summary>
    public static IServiceCollection AddMediPathJwt(this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(JwtOptions.SectionName);
        var options = section.Get<JwtOptions>() ?? new JwtOptions();
        if (Encoding.UTF8.GetByteCount(options.SigningKey) < 32)
            throw new InvalidOperationException(
                "Jwt:SigningKey is missing or shorter than 32 bytes. Set it with user-secrets or the Jwt__SigningKey environment variable (see api/README.md).");

        services.Configure<JwtOptions>(section);
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(o =>
            {
                o.MapInboundClaims = false;
                o.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = options.Issuer,
                    ValidAudience = options.Audience,
                    IssuerSigningKey = CreateKey(options),
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    NameClaimType = "sub",
                    RoleClaimType = RoleClaim,
                    ClockSkew = TimeSpan.FromSeconds(30),
                };
            });
        services.AddAuthorization();
        return services;
    }

    public static SymmetricSecurityKey CreateKey(JwtOptions options) => new(Encoding.UTF8.GetBytes(options.SigningKey));
}
