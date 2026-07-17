namespace BeautyCareClinic.Domain.Exceptions;

/// <summary>
/// Thrown when a domain operation conflicts with existing data.
/// Maps to HTTP 409 Conflict in the ExceptionHandlingMiddleware.
/// </summary>
public class DomainConflictException : Exception
{
    public DomainConflictException(string message) : base(message) { }
}
