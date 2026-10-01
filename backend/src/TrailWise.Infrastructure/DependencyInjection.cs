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
        services.AddScoped<IGuideMatchingAgent, GuideMatchingAgent>();
        services.AddScoped<IFleetCapacityAgent, FleetCapacityAgent>();
        services.AddScoped<IFleetReservationService, FleetReservationService>();
        services.AddScoped<IGuideAvailabilityService, GuideAvailabilityService>();
        services.AddScoped<IGuideAssignmentService, GuideAssignmentService>();
        services.AddScoped<IItineraryService, ItineraryService>();
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

        var notifyLkUserId = configuration["NOTIFY_LK_USER_ID"] ?? configuration["NotifyLk:UserId"] ?? string.Empty;
        var notifyLkApiKey = configuration["NOTIFY_LK_API_KEY"] ?? configuration["NotifyLk:ApiKey"] ?? string.Empty;
        var notifyLkSenderId = configuration["NOTIFY_LK_SENDER_ID"] ?? configuration["NotifyLk:SenderId"] ?? "NotifyDEMO";
        var notifyLkEndpoint = configuration["NotifyLk:ApiEndpoint"] ?? "https://app.notify.lk/api/v1/send";

        services.Configure<NotifyLkOptions>(options =>
        {
            options.UserId = notifyLkUserId;
            options.ApiKey = notifyLkApiKey;
            options.SenderId = notifyLkSenderId;
            options.ApiEndpoint = notifyLkEndpoint;
        });

        services.AddHttpClient<ISmsService, NotifyLkSmsService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        services.AddScoped<IBookingNotificationService, BookingNotificationService>();

        return services;
    }
}
