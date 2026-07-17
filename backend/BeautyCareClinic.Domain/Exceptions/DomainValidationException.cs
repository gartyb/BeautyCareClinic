namespace BeautyCareClinic.Domain.Exceptions;

/// <summary>
/// Thrown when input data fails domain validation rules.
/// Maps to HTTP 422 Unprocessable Entity in the ExceptionHandlingMiddleware.
/// </summary>
public class DomainValidationException : Exception
{
    public DomainValidationException(string message) : base(message) { }
}
