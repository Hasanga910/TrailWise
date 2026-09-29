namespace TrailWise.Infrastructure.Services;

public class BankSlipFileResult : IAsyncDisposable, IDisposable
{
    public Stream Stream { get; init; } = Stream.Null;
    public string ContentType { get; init; } = "application/octet-stream";
    public string FileName { get; init; } = string.Empty;

    public void Dispose()
    {
        Stream.Dispose();
    }

    public async ValueTask DisposeAsync()
    {
        await Stream.DisposeAsync();
    }
}

public interface IBankSlipStorageService
{
    Task<string> SaveSlipAsync(Stream content, string originalFileName, string? contentType, CancellationToken ct = default);
    Task<BankSlipFileResult?> OpenSlipReadStreamAsync(string storageReference, CancellationToken ct = default);
    Task DeleteSlipAsync(string? storageReference, CancellationToken ct = default);
    bool ValidateSlip(long length, string fileName, string? contentType, out string? errorMessage, out string safeExtension);
    string ResolveContentType(string fileNameOrExtension);
}
