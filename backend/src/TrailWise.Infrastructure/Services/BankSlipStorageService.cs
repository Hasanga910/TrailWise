using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace TrailWise.Infrastructure.Services;

public class BankSlipStorageService : IBankSlipStorageService
{
    public const long MaxSlipSizeBytes = 5 * 1024 * 1024; // 5 MB

    private static readonly Dictionary<string, string> AllowedSlipContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["application/pdf"] = ".pdf"
    };

    private static readonly HashSet<string> AllowedSlipExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
        ".pdf"
    };

    private readonly string _privateStorageDir;
    private readonly string _legacyStorageDir;
    private readonly ILogger<BankSlipStorageService> _logger;

    public BankSlipStorageService(
        IHostEnvironment env,
        IConfiguration configuration,
        ILogger<BankSlipStorageService> logger)
    {
        _logger = logger;

        var configuredPath = configuration["Storage:PrivateUploadsDirectory"];
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            _privateStorageDir = Path.GetFullPath(Path.Combine(configuredPath, "slips"));
        }
        else
        {
            _privateStorageDir = Path.GetFullPath(Path.Combine(env.ContentRootPath, "private_uploads", "slips"));
        }

        _legacyStorageDir = Path.GetFullPath(Path.Combine(env.ContentRootPath, "wwwroot", "uploads", "slips"));
    }

    public bool ValidateSlip(long length, string fileName, string? contentType, out string? errorMessage, out string safeExtension)
    {
        safeExtension = string.Empty;
        errorMessage = null;

        if (length <= 0)
        {
            errorMessage = "Bank slip file is required.";
            return false;
        }

        if (length > MaxSlipSizeBytes)
        {
            errorMessage = "Bank slip file must be 5MB or smaller.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(contentType) && AllowedSlipContentTypes.TryGetValue(contentType, out var extFromMime))
        {
            safeExtension = extFromMime;
            return true;
        }

        var ext = Path.GetExtension(fileName);
        if (!string.IsNullOrWhiteSpace(ext) && AllowedSlipExtensions.Contains(ext))
        {
            safeExtension = ext.ToLowerInvariant();
            return true;
        }

        errorMessage = "Only JPG, JPEG, PNG, WEBP, or PDF files are allowed.";
        return false;
    }

    public async Task<string> SaveSlipAsync(Stream content, string originalFileName, string? contentType, CancellationToken ct = default)
    {
        var length = content.CanSeek ? content.Length : 1;
        ValidateSlip(length, originalFileName, contentType, out _, out var safeExt);
        if (string.IsNullOrEmpty(safeExt))
        {
            var rawExt = Path.GetExtension(originalFileName);
            safeExt = AllowedSlipExtensions.Contains(rawExt) ? rawExt.ToLowerInvariant() : ".jpg";
        }

        var uniqueFileName = $"{Guid.NewGuid()}{safeExt}";
        Directory.CreateDirectory(_privateStorageDir);

        var destinationPath = Path.Combine(_privateStorageDir, uniqueFileName);
        await using (var fileStream = new FileStream(destinationPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await content.CopyToAsync(fileStream, ct);
        }

        _logger.LogInformation("Saved private bank slip to storage reference slips/{FileName}", uniqueFileName);
        return $"slips/{uniqueFileName}";
    }

    public Task<BankSlipFileResult?> OpenSlipReadStreamAsync(string storageReference, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(storageReference) || storageReference.Contains(".."))
        {
            _logger.LogWarning("Potential path traversal or empty slip reference rejected: {Reference}", storageReference);
            return Task.FromResult<BankSlipFileResult?>(null);
        }

        // Normalize reference: strip any directory structure to get pure filename
        var fileName = Path.GetFileName(storageReference);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Task.FromResult<BankSlipFileResult?>(null);
        }

        // Ensure target is strictly within private storage
        var privateFilePath = Path.GetFullPath(Path.Combine(_privateStorageDir, fileName));
        if (!privateFilePath.StartsWith(_privateStorageDir, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning("Path traversal attempt detected for reference: {Reference}", storageReference);
            return Task.FromResult<BankSlipFileResult?>(null);
        }

        if (File.Exists(privateFilePath))
        {
            var stream = new FileStream(privateFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
            var result = new BankSlipFileResult
            {
                Stream = stream,
                ContentType = ResolveContentType(fileName),
                FileName = fileName
            };
            return Task.FromResult<BankSlipFileResult?>(result);
        }

        // Fallback for legacy files in wwwroot/uploads/slips
        var legacyFilePath = Path.GetFullPath(Path.Combine(_legacyStorageDir, fileName));
        if (legacyFilePath.StartsWith(_legacyStorageDir, StringComparison.OrdinalIgnoreCase) && File.Exists(legacyFilePath))
        {
            try
            {
                Directory.CreateDirectory(_privateStorageDir);
                File.Move(legacyFilePath, privateFilePath, overwrite: true);
                var stream = new FileStream(privateFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return Task.FromResult<BankSlipFileResult?>(new BankSlipFileResult
                {
                    Stream = stream,
                    ContentType = ResolveContentType(fileName),
                    FileName = fileName
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to migrate legacy slip file {FileName}. Reading directly.", fileName);
                var stream = new FileStream(legacyFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return Task.FromResult<BankSlipFileResult?>(new BankSlipFileResult
                {
                    Stream = stream,
                    ContentType = ResolveContentType(fileName),
                    FileName = fileName
                });
            }
        }

        return Task.FromResult<BankSlipFileResult?>(null);
    }

    public Task DeleteSlipAsync(string? storageReference, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(storageReference) || storageReference.Contains(".."))
        {
            return Task.CompletedTask;
        }

        var fileName = Path.GetFileName(storageReference);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return Task.CompletedTask;
        }

        var privateFilePath = Path.GetFullPath(Path.Combine(_privateStorageDir, fileName));
        if (privateFilePath.StartsWith(_privateStorageDir, StringComparison.OrdinalIgnoreCase) && File.Exists(privateFilePath))
        {
            try { File.Delete(privateFilePath); } catch { /* Ignore */ }
        }

        var legacyFilePath = Path.GetFullPath(Path.Combine(_legacyStorageDir, fileName));
        if (legacyFilePath.StartsWith(_legacyStorageDir, StringComparison.OrdinalIgnoreCase) && File.Exists(legacyFilePath))
        {
            try { File.Delete(legacyFilePath); } catch { /* Ignore */ }
        }

        return Task.CompletedTask;
    }

    public string ResolveContentType(string fileNameOrExtension)
    {
        var ext = Path.GetExtension(fileNameOrExtension).ToLowerInvariant();
        return ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };
    }
}
