using MediPath.Identity.Application.Abstractions;
using MediPath.Identity.Application.Common;

namespace MediPath.Identity.Application.UseCases;

public sealed class GetCurrentUser(IUserRepository users)
{
    public async Task<Result<UserProfile>> ExecuteAsync(Guid userId, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(userId, ct);
        return user is null || !user.IsActive ? Failure.InvalidCredentials : UserProfile.From(user);
    }
}
