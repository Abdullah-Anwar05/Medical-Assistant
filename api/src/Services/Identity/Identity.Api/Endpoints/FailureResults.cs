using MediPath.BuildingBlocks.Problems;
using MediPath.Identity.Application.Common;

namespace MediPath.Identity.Api.Endpoints;

/// <summary>The single mapping from Application failures to RFC 7807 responses.</summary>
public static class FailureResults
{
    public static IResult ToHttp(this Failure failure) => failure.Kind switch
    {
        FailureKind.Validation => Results.ValidationProblem(
            failure.Errors!.ToDictionary(e => e.Key, e => e.Value)),
        FailureKind.Conflict => Problem(StatusCodes.Status409Conflict, failure),
        FailureKind.Unauthorized or FailureKind.SessionEnded => Problem(StatusCodes.Status401Unauthorized, failure),
        FailureKind.Locked => Problem(StatusCodes.Status423Locked, failure),
        _ => throw new ArgumentOutOfRangeException(nameof(failure), failure.Kind, "Unmapped failure kind."),
    };

    public static IResult Unauthenticated() => Failure.InvalidCredentials.ToHttp();

    private static IResult Problem(int status, Failure failure) =>
        ProblemDetailsExtensions.Problem(status, failure.Title, failure.Detail);
}
