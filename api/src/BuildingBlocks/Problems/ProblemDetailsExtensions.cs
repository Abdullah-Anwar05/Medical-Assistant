using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace MediPath.BuildingBlocks.Problems;

public static class ProblemDetailsExtensions
{
    /// <summary>RFC 9457 Problem Details for all errors, including unhandled exceptions and bare status codes.</summary>
    public static IServiceCollection AddMediPathProblemDetails(this IServiceCollection services) =>
        services.AddProblemDetails(o => o.CustomizeProblemDetails = c =>
            c.ProblemDetails.Extensions["traceId"] = c.HttpContext.TraceIdentifier);

    public static WebApplication UseMediPathProblemDetails(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        return app;
    }

    public static IResult Problem(int status, string title, string? detail = null) =>
        Results.Problem(statusCode: status, title: title, detail: detail);
}
