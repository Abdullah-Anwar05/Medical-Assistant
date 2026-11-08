using MediPath.Identity.Application.Common;
using MediPath.Identity.Application.UseCases;

namespace MediPath.Identity.Api.Endpoints;

/// <summary>Maps HTTP to the Identity use cases. No business rules here.</summary>
public static class IdentityEndpoints
{
    public const string BasePath = "/api/v1/identity";
    public const string AuthRateLimitPolicy = "auth";

    public static IEndpointRouteBuilder MapIdentityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(BasePath);
        group.MapPost("/register", Register).RequireRateLimiting(AuthRateLimitPolicy);
        group.MapPost("/login", Login).RequireRateLimiting(AuthRateLimitPolicy);
        group.MapPost("/refresh", Refresh).RequireRateLimiting(AuthRateLimitPolicy);
        group.MapPost("/logout", Logout).RequireAuthorization();
        group.MapGet("/me", Me).RequireAuthorization();
        return app;
    }

    private static async Task<IResult> Register(
        RegisterUserRequest? request, HttpContext context, RegisterUser useCase, ITokenDelivery delivery, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(request, ct);
        return result.IsSuccess
            ? Results.Created($"{BasePath}/me", delivery.Deliver(context, result.Value!))
            : result.Failure!.ToHttp();
    }

    private static async Task<IResult> Login(
        LoginRequest? request, HttpContext context, LoginUser useCase, ITokenDelivery delivery, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(request, ct);
        return result.IsSuccess ? Results.Ok(delivery.Deliver(context, result.Value!)) : result.Failure!.ToHttp();
    }

    private static async Task<IResult> Refresh(
        HttpContext context, RefreshSession useCase, ITokenDelivery delivery, CancellationToken ct)
    {
        var result = await useCase.ExecuteAsync(await delivery.ReadRefreshTokenAsync(context, ct), ct);
        if (result.IsSuccess)
            return Results.Ok(delivery.Deliver(context, result.Value!));
        if (result.Failure!.Kind == FailureKind.SessionEnded)
            delivery.ClearRefreshToken(context);
        return result.Failure.ToHttp();
    }

    private static async Task<IResult> Logout(
        HttpContext context, LogoutUser useCase, ITokenDelivery delivery, CancellationToken ct)
    {
        if (CurrentUserId(context) is not { } userId)
            return FailureResults.Unauthenticated();

        await useCase.ExecuteAsync(userId, await delivery.ReadRefreshTokenAsync(context, ct), ct);
        delivery.ClearRefreshToken(context);
        return Results.NoContent();
    }

    private static async Task<IResult> Me(HttpContext context, GetCurrentUser useCase, CancellationToken ct)
    {
        if (CurrentUserId(context) is not { } userId)
            return FailureResults.Unauthenticated();

        var result = await useCase.ExecuteAsync(userId, ct);
        return result.IsSuccess ? Results.Ok(result.Value) : result.Failure!.ToHttp();
    }

    private static Guid? CurrentUserId(HttpContext context) =>
        Guid.TryParse(context.User.FindFirst("sub")?.Value, out var id) ? id : null;
}
