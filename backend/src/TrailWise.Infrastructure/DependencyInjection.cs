using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using TrailWise.Infrastructure.Agents;
using TrailWise.Infrastructure.Options;
using TrailWise.Infrastructure.Persistence;
using TrailWise.Infrastructure.Services;

namespace TrailWise.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Missing 'ConnectionStrings:Default' configuration.");

        services.AddDbContext<TrailWiseDbContext>(options =>
            options.UseNpgsql(connectionString));

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<AdminSeedOptions>(configuration.GetSection(AdminSeedOptions.SectionName));

        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IAuthService, AuthService>();

        services.AddHttpClient(NominatimLocationSearchService.HttpClientName, client =>
        {
            client.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("TrailWise/1.0 (https://trailwise.local)");
        });
        services.AddScoped<ILocationSearchService, NominatimLocationSearchService>();

        var llmOptions = configuration.GetSection(LlmOptions.SectionName).Get<LlmOptions>() ?? new LlmOptions();
        services.Configure<LlmOptions>(configuration.GetSection(LlmOptions.SectionName));
        services.AddHttpClient("Groq", client =>
        {
            client.BaseAddress = new Uri(llmOptions.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(llmOptions.TimeoutSeconds);
            if (!string.IsNullOrEmpty(llmOptions.ApiKey))
            {
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", llmOptions.ApiKey);
            }
        });
        services.AddScoped<ILlmClient>(sp => llmOptions.Enabled
            ? new GroqAgentClient(
                sp.GetRequiredService<IHttpClientFactory>().CreateClient("Groq"),
                llmOptions,
                sp.GetRequiredService<ILogger<GroqAgentClient>>())
            : new NullLlmClient());

        services.AddScoped<IPreferenceExtractionAgent, PreferenceExtractionAgent>();
        services.AddScoped<IProposalSummaryAgent, ProposalSummaryAgent>();
        services.AddScoped<IGuideMatchingAgent, MockGuideMatchingAgent>();
        services.AddScoped<IFleetCapacityAgent, FleetCapacityAgent>();
        services.AddScoped<IFleetReservationService, FleetReservationService>();
        services.AddScoped<IPricingValidationAgent, PricingValidationAgent>();
        services.AddScoped<ICoordinatorAgentService, CoordinatorAgentService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IReviewService, ReviewService>();
        services.AddScoped<IAuditLogService, AuditLogService>();
        services.AddScoped<IAuditReportService, AuditReportService>();
        services.AddScoped<IOperationsReportService, OperationsReportService>();
        services.AddScoped<IDiscountService, DiscountService>();
        services.AddScoped<IBankSlipStorageService, BankSlipStorageService>();
        services.AddScoped<ISupportService, SupportService>();

        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<IBookingLifecycleService, BookingLifecycleService>();
        services.AddSingleton<BookingPaymentExpiryService>();
        services.AddHostedService(sp => sp.GetRequiredService<BookingPaymentExpiryService>());

        return services;
    }
}
