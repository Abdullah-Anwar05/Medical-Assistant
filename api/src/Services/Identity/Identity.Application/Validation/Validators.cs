using System.Globalization;
using System.Net.Mail;
using MediPath.Identity.Application.Common;

namespace MediPath.Identity.Application.Validation;

public interface IRequestValidator<in TRequest>
{
    /// <returns>Field errors keyed by JSON property name; empty when the request is valid.</returns>
    IReadOnlyDictionary<string, string[]> Validate(TRequest? request);
}

public sealed class RegisterUserRequestValidator(PasswordPolicy passwordPolicy, TimeProvider clock) : IRequestValidator<RegisterUserRequest>
{
    public const int MaxEmailLength = 320;
    public const int MaxNameLength = 100;
    public const int MaxTermsVersionLength = 32;
    private const string DateOfBirthFormat = "yyyy-MM-dd";

    public IReadOnlyDictionary<string, string[]> Validate(RegisterUserRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        var email = request?.Email?.Trim();
        if (string.IsNullOrEmpty(email) || email.Length > MaxEmailLength || !IsValidEmail(email))
            errors["email"] = ["A valid email address is required."];
        if (passwordPolicy.Validate(request?.Password) is { } passwordError)
            errors["password"] = [passwordError];
        RequireName(errors, "firstName", request?.FirstName);
        RequireName(errors, "lastName", request?.LastName);
        ValidateDateOfBirth(errors, request?.DateOfBirth);
        if (string.IsNullOrWhiteSpace(request?.AcceptedTermsVersion) || request.AcceptedTermsVersion.Length > MaxTermsVersionLength)
            errors["acceptedTermsVersion"] = ["The accepted terms version is required."];
        return errors;
    }

    /// <summary>Parses a date of birth that has already passed <see cref="Validate"/>.</summary>
    public static DateOnly ParseDateOfBirth(string value) =>
        DateOnly.ParseExact(value, DateOfBirthFormat, CultureInfo.InvariantCulture);

    private void ValidateDateOfBirth(Dictionary<string, string[]> errors, string? value)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            !DateOnly.TryParseExact(value, DateOfBirthFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dob))
            errors["dateOfBirth"] = ["Date of birth is required in yyyy-mm-dd format."];
        else if (dob > DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime) || dob.Year < 1900)
            errors["dateOfBirth"] = ["Date of birth must be a real past date."];
    }

    private static void RequireName(Dictionary<string, string[]> errors, string field, string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Trim().Length > MaxNameLength)
            errors[field] = ["Required, at most 100 characters."];
    }

    private static bool IsValidEmail(string email) =>
        MailAddress.TryCreate(email, out var address) && address.Address == email && email.Contains('.', StringComparison.Ordinal);
}

public sealed class LoginRequestValidator : IRequestValidator<LoginRequest>
{
    public IReadOnlyDictionary<string, string[]> Validate(LoginRequest? request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request?.Email)) errors["email"] = ["Email is required."];
        if (string.IsNullOrEmpty(request?.Password)) errors["password"] = ["Password is required."];
        return errors;
    }
}
