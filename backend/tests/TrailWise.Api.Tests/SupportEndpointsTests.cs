using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TrailWise.Api.Contracts.Auth;
using TrailWise.Api.Contracts.Common;
using TrailWise.Api.Contracts.Support;
using TrailWise.Domain.Entities;
using TrailWise.Domain.Enums;
using TrailWise.Infrastructure.Persistence;
using Xunit;

namespace TrailWise.Api.Tests;

public class SupportEndpointsTests : IClassFixture<TrailWiseWebApplicationFactory>
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly TrailWiseWebApplicationFactory _factory;

    public SupportEndpointsTests(TrailWiseWebApplicationFactory factory)
    {
        _factory = factory;
    }

    // 1. Traveler can create ticket without booking
    [Fact]
    public async Task Test01_Traveler_CanCreateTicket_WithoutBooking()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();

        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Account,
            Subject: "Inquiry about profile settings",
            Description: "Hello, I would like to know how to change my account name."
        ));

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var detail = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.NotNull(detail);
        Assert.Equal("Inquiry about profile settings", detail.Subject);
        Assert.Equal(TicketCategory.Account, detail.Category);
        Assert.Equal(TicketPriority.Normal, detail.Priority);
        Assert.Equal(TicketStatus.Open, detail.Status);
        Assert.Null(detail.BookingId);
    }

    // 2. Traveler can create ticket with own booking
    [Fact]
    public async Task Test02_Traveler_CanCreateTicket_WithOwnBooking()
    {
        var (client, bookingId, travelerId) = await SetupBookingAsync();

        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: bookingId,
            Category: TicketCategory.Booking,
            Subject: "Date change request for my trip",
            Description: "I need to postpone my travel dates by one week."
        ));

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var detail = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.NotNull(detail);
        Assert.Equal(bookingId, detail.BookingId);
        Assert.Equal(travelerId, detail.TravelerId);
    }

    // 3. Traveler cannot link another user's booking
    [Fact]
    public async Task Test03_Traveler_CannotLinkAnotherUsersBooking_ReturnsForbidden()
    {
        var (_, otherBookingId, _) = await SetupBookingAsync();
        var (client, _) = await AuthenticatedTravelerWithIdAsync();

        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: otherBookingId,
            Category: TicketCategory.Trip,
            Subject: "Unauthorized booking ticket",
            Description: "Attempting to create ticket for someone else's trip."
        ));

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 4. Missing booking returns 404
    [Fact]
    public async Task Test04_MissingBooking_ReturnsNotFound()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();

        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: Guid.NewGuid(),
            Category: TicketCategory.Payment,
            Subject: "Payment issue for non-existent booking",
            Description: "Where is my booking confirmation?"
        ));

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // 5. Traveler sees own tickets only
    [Fact]
    public async Task Test05_Traveler_SeesOwnTicketsOnly()
    {
        var (client1, _) = await AuthenticatedTravelerWithIdAsync();
        var (client2, _) = await AuthenticatedTravelerWithIdAsync();

        var res1 = await client1.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.App,
            Subject: "Traveler 1 ticket subject",
            Description: "Issue description by traveler 1."
        ));
        Assert.Equal(HttpStatusCode.Created, res1.StatusCode);

        var res2 = await client2.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Other,
            Subject: "Traveler 2 ticket subject",
            Description: "Issue description by traveler 2."
        ));
        Assert.Equal(HttpStatusCode.Created, res2.StatusCode);

        var listRes = await client1.GetFromJsonAsync<PagedResult<SupportTicketListDto>>("/api/support/tickets/mine", JsonOptions);
        Assert.NotNull(listRes);
        Assert.All(listRes.Items, t => Assert.Equal("Traveler 1 ticket subject", t.Subject));
    }

    // 6. Traveler cannot view another ticket
    [Fact]
    public async Task Test06_Traveler_CannotViewAnotherTicket_ReturnsForbidden()
    {
        var (client1, _) = await AuthenticatedTravelerWithIdAsync();
        var (client2, _) = await AuthenticatedTravelerWithIdAsync();

        var createRes = await client1.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Trip,
            Subject: "Private traveler 1 ticket",
            Description: "Confidential trip details."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var accessRes = await client2.GetAsync($"/api/support/tickets/{ticket!.Id}");
        Assert.Equal(HttpStatusCode.Forbidden, accessRes.StatusCode);
    }

    // 7. Traveler can send follow-up message
    [Fact]
    public async Task Test07_Traveler_CanSendFollowUpMessage()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Booking,
            Subject: "Need help with booking details",
            Description: "First inquiry."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var msgRes = await client.PostAsJsonAsync($"/api/support/tickets/{ticket!.Id}/messages", new AddSupportMessageRequest(
            Message: "Following up on my previous question."
        ));

        Assert.Equal(HttpStatusCode.Created, msgRes.StatusCode);
        var msgDto = await msgRes.Content.ReadFromJsonAsync<SupportMessageDto>(JsonOptions);
        Assert.NotNull(msgDto);
        Assert.Equal("Following up on my previous question.", msgDto.Message);
        Assert.False(msgDto.IsStaff);

        var detail = await client.GetFromJsonAsync<SupportTicketDetailDto>($"/api/support/tickets/{ticket.Id}", JsonOptions);
        Assert.NotNull(detail);
        Assert.Single(detail.Messages);
        Assert.Equal("Following up on my previous question.", detail.Messages[0].Message);
    }

    // 8. Traveler cannot send message to another user's ticket
    [Fact]
    public async Task Test08_Traveler_CannotSendMessageToAnotherUsersTicket_ReturnsForbidden()
    {
        var (client1, _) = await AuthenticatedTravelerWithIdAsync();
        var (client2, _) = await AuthenticatedTravelerWithIdAsync();

        var createRes = await client1.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Payment,
            Subject: "Payment support required",
            Description: "Please verify payment."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var msgRes = await client2.PostAsJsonAsync($"/api/support/tickets/{ticket!.Id}/messages", new AddSupportMessageRequest(
            Message: "Intruder attempting to inject message."
        ));

        Assert.Equal(HttpStatusCode.Forbidden, msgRes.StatusCode);
    }

    // 9. Traveler cannot reply to Closed ticket
    [Fact]
    public async Task Test09_Traveler_CannotReplyToClosedTicket_ReturnsBadRequest()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.App,
            Subject: "Bug in mobile app",
            Description: "Crash on startup."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Closed));

        var replyRes = await client.PostAsJsonAsync($"/api/support/tickets/{ticket.Id}/messages", new AddSupportMessageRequest(
            Message: "Wait, it still crashes!"
        ));

        Assert.Equal(HttpStatusCode.BadRequest, replyRes.StatusCode);
    }

    // 10. Staff can view all tickets
    [Fact]
    public async Task Test10_Staff_CanViewAllTickets()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Payment,
            Subject: "Ops listing test ticket",
            Description: "Testing ops visibility."
        ));

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var listRes = await opsClient.GetFromJsonAsync<PagedResult<SupportTicketListDto>>("/api/staff/support/tickets", JsonOptions);
        Assert.NotNull(listRes);
        Assert.NotEmpty(listRes.Items);
    }

    // 11. Admin can view all tickets
    [Fact]
    public async Task Test11_Admin_CanViewAllTickets()
    {
        var adminClient = await AuthenticatedAdminAsync();
        var listRes = await adminClient.GetFromJsonAsync<PagedResult<SupportTicketListDto>>("/api/staff/support/tickets", JsonOptions);
        Assert.NotNull(listRes);
    }

    // 12. TourGuide cannot use staff endpoints
    [Fact]
    public async Task Test12_TourGuide_CannotUseStaffEndpoints_ReturnsForbidden()
    {
        var guideClient = await AuthenticatedUserWithRoleAsync("TourGuide");
        var res = await guideClient.GetAsync("/api/staff/support/tickets");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 13. FleetCoordinator cannot use staff endpoints
    [Fact]
    public async Task Test13_FleetCoordinator_CannotUseStaffEndpoints_ReturnsForbidden()
    {
        var fleetClient = await AuthenticatedUserWithRoleAsync("FleetCoordinator");
        var res = await fleetClient.GetAsync("/api/staff/support/tickets");
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 14. Staff can reply and ticket status transitions to WaitingForCustomer
    [Fact]
    public async Task Test14_Staff_CanReply_TransitionsStatusToWaitingForCustomer()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Trip,
            Subject: "Guide inquiry",
            Description: "Who is my assigned guide?"
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(TicketStatus.Open, ticket!.Status);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var replyRes = await opsClient.PostAsJsonAsync($"/api/staff/support/tickets/{ticket.Id}/messages", new AddSupportMessageRequest(
            Message: "We have assigned an experienced guide for your trip."
        ));
        Assert.Equal(HttpStatusCode.Created, replyRes.StatusCode);
        var msg = await replyRes.Content.ReadFromJsonAsync<SupportMessageDto>(JsonOptions);
        Assert.True(msg!.IsStaff);

        var updated = await opsClient.GetFromJsonAsync<SupportTicketDetailDto>($"/api/staff/support/tickets/{ticket.Id}", JsonOptions);
        Assert.Equal(TicketStatus.WaitingForCustomer, updated!.Status);

        var travelerReply = await client.PostAsJsonAsync($"/api/support/tickets/{ticket.Id}/messages", new AddSupportMessageRequest(
            Message: "Thank you for the update!"
        ));
        Assert.Equal(HttpStatusCode.Created, travelerReply.StatusCode);

        var reloaded = await client.GetFromJsonAsync<SupportTicketDetailDto>($"/api/support/tickets/{ticket.Id}", JsonOptions);
        Assert.Equal(TicketStatus.Open, reloaded!.Status);
    }

    // 15. Staff can change status
    [Fact]
    public async Task Test15_Staff_CanChangeStatus()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Other,
            Subject: "General question",
            Description: "Question about baggage."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var statusRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.InProgress));
        Assert.Equal(HttpStatusCode.OK, statusRes.StatusCode);
        var updated = await statusRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(TicketStatus.InProgress, updated!.Status);
    }

    // 16. Setting status to Resolved sets ResolvedAt
    [Fact]
    public async Task Test16_SettingStatusToResolved_SetsResolvedAt()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Payment,
            Subject: "Receipt request",
            Description: "Need invoice copy."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var res = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Resolved));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var detail = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.NotNull(detail!.ResolvedAt);
    }

    // 17. Setting status to Closed sets ClosedAt
    [Fact]
    public async Task Test17_SettingStatusToClosed_SetsClosedAt()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Account,
            Subject: "Close this inquiry",
            Description: "Solved on my own."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var res = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Closed));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var detail = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.NotNull(detail!.ClosedAt);
    }

    // 18. Staff can reopen resolved (clears ResolvedAt)
    [Fact]
    public async Task Test18_Staff_CanReopenResolved_ClearsResolvedAt()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Booking,
            Subject: "Reopening resolved test",
            Description: "Testing reopening."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Resolved));

        var reopenRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket.Id}/status", new UpdateSupportStatusRequest(TicketStatus.InProgress));
        var detail = await reopenRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(TicketStatus.InProgress, detail!.Status);
        Assert.Null(detail.ResolvedAt);
    }

    // 19. Staff can reopen closed (clears ClosedAt)
    [Fact]
    public async Task Test19_Staff_CanReopenClosed_ClearsClosedAt()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.App,
            Subject: "Reopening closed test",
            Description: "Reopening ticket."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Closed));

        var reopenRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket.Id}/status", new UpdateSupportStatusRequest(TicketStatus.InProgress));
        var detail = await reopenRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(TicketStatus.InProgress, detail!.Status);
        Assert.Null(detail.ClosedAt);
    }

    // 20. Staff can assign OperationsManager
    [Fact]
    public async Task Test20_Staff_CanAssignOperationsManager()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Trip,
            Subject: "Assignment test Ops",
            Description: "Ticket to assign."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var (opsClient, opsUserId) = await AuthenticatedUserWithIdAsync("OperationsManager");
        var assignRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/assign", new AssignSupportTicketRequest(opsUserId));
        Assert.Equal(HttpStatusCode.OK, assignRes.StatusCode);
        var detail = await assignRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(opsUserId, detail!.AssignedToId);
    }

    // 21. Staff can assign Admin
    [Fact]
    public async Task Test21_Staff_CanAssignAdmin()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Payment,
            Subject: "Assignment test Admin",
            Description: "Ticket to assign admin."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var (adminClient, adminUserId) = await AuthenticatedUserWithIdAsync("Admin");
        var assignRes = await adminClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/assign", new AssignSupportTicketRequest(adminUserId));
        Assert.Equal(HttpStatusCode.OK, assignRes.StatusCode);
        var detail = await assignRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(adminUserId, detail!.AssignedToId);
    }

    // 22. Staff cannot assign Traveler
    [Fact]
    public async Task Test22_Staff_CannotAssignTraveler_ReturnsBadRequest()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Account,
            Subject: "Invalid assignment test",
            Description: "Try to assign traveler."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var assignRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/assign", new AssignSupportTicketRequest(travelerId));
        Assert.Equal(HttpStatusCode.BadRequest, assignRes.StatusCode);
    }

    // 23. Staff can unassign
    [Fact]
    public async Task Test23_Staff_CanUnassign_SetsAssignedToIdNull()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Booking,
            Subject: "Unassignment test",
            Description: "Assign then unassign."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var (opsClient, opsUserId) = await AuthenticatedUserWithIdAsync("OperationsManager");
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/assign", new AssignSupportTicketRequest(opsUserId));

        var unassignRes = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket.Id}/assign", new AssignSupportTicketRequest(null));
        Assert.Equal(HttpStatusCode.OK, unassignRes.StatusCode);
        var detail = await unassignRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Null(detail!.AssignedToId);
    }

    // 24. Staff can change priority
    [Fact]
    public async Task Test24_Staff_CanChangePriority()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Trip,
            Subject: "Priority test ticket",
            Description: "Escalate to urgent."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        var res = await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/priority", new UpdateSupportPriorityRequest(TicketPriority.Urgent));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var detail = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);
        Assert.Equal(TicketPriority.Urgent, detail!.Priority);
    }

    // 25. Traveler cannot change priority
    [Fact]
    public async Task Test25_Traveler_CannotChangePriority()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var res = await client.PatchAsJsonAsync($"/api/staff/support/tickets/{Guid.NewGuid()}/priority", new UpdateSupportPriorityRequest(TicketPriority.High));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 26. Traveler cannot change status
    [Fact]
    public async Task Test26_Traveler_CannotChangeStatus()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var res = await client.PatchAsJsonAsync($"/api/staff/support/tickets/{Guid.NewGuid()}/status", new UpdateSupportStatusRequest(TicketStatus.Resolved));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 27. Traveler cannot assign
    [Fact]
    public async Task Test27_Traveler_CannotAssign()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var res = await client.PatchAsJsonAsync($"/api/staff/support/tickets/{Guid.NewGuid()}/assign", new AssignSupportTicketRequest(Guid.NewGuid()));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    // 28. Creation logs SupportTicketCreated
    [Fact]
    public async Task Test28_Creation_LogsSupportTicketCreatedAudit()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.App,
            Subject: "Audit log creation test",
            Description: "Ensure audit log is written."
        ));
        var ticket = await res.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == ticket!.Id && a.Action == "SupportTicketCreated");
        Assert.NotNull(audit);
        Assert.Equal(travelerId, audit.PerformedBy);
    }

    // 29. Message logs SupportMessageAdded
    [Fact]
    public async Task Test29_Message_LogsSupportMessageAddedAudit()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Payment,
            Subject: "Message audit log test",
            Description: "Initial description."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var msgRes = await client.PostAsJsonAsync($"/api/support/tickets/{ticket!.Id}/messages", new AddSupportMessageRequest(
            Message: "Testing message audit log."
        ));
        var msg = await msgRes.Content.ReadFromJsonAsync<SupportMessageDto>(JsonOptions);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == msg!.Id && a.Action == "SupportMessageAdded");
        Assert.NotNull(audit);
        Assert.Equal(travelerId, audit.PerformedBy);
    }

    // 30. Assignment logs SupportTicketAssigned
    [Fact]
    public async Task Test30_Assignment_LogsSupportTicketAssignedAudit()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Booking,
            Subject: "Assignment audit test",
            Description: "Check audit on assign."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var (opsClient, opsUserId) = await AuthenticatedUserWithIdAsync("OperationsManager");
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/assign", new AssignSupportTicketRequest(opsUserId));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == ticket.Id && a.Action == "SupportTicketAssigned");
        Assert.NotNull(audit);
    }

    // 31. Status changes logged SupportTicketStatusChanged
    [Fact]
    public async Task Test31_StatusChanges_LoggedSupportTicketStatusChangedAudit()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Other,
            Subject: "Status audit test",
            Description: "Check audit on status change."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.InProgress));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var audit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == ticket.Id && a.Action == "SupportTicketStatusChanged");
        Assert.NotNull(audit);
    }

    // 32. Closed/resolved audits logged
    [Fact]
    public async Task Test32_ClosedAndResolved_LogsSpecificAudits()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var createRes = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Trip,
            Subject: "Resolved and closed audit test",
            Description: "Audit test for resolution."
        ));
        var ticket = await createRes.Content.ReadFromJsonAsync<SupportTicketDetailDto>(JsonOptions);

        var opsClient = await AuthenticatedOperationsManagerAsync();
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket!.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Resolved));
        await opsClient.PatchAsJsonAsync($"/api/staff/support/tickets/{ticket.Id}/status", new UpdateSupportStatusRequest(TicketStatus.Closed));

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();
        var resolvedAudit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == ticket.Id && a.Action == "SupportTicketResolved");
        var closedAudit = await db.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == ticket.Id && a.Action == "SupportTicketClosed");
        Assert.NotNull(resolvedAudit);
        Assert.NotNull(closedAudit);
    }

    // 33. Search/filter/pagination behaves correctly
    [Fact]
    public async Task Test33_StaffTickets_SearchFilterPagination_BehavesCorrectly()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var uniqueSearchTerm = $"SearchTarget_{Guid.NewGuid():N}";

        await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.App,
            Subject: $"Important query with {uniqueSearchTerm}",
            Description: "Searchable description."
        ));

        var opsClient = await AuthenticatedOperationsManagerAsync();

        var searchRes = await opsClient.GetFromJsonAsync<PagedResult<SupportTicketListDto>>(
            $"/api/staff/support/tickets?search={uniqueSearchTerm}", JsonOptions);
        Assert.NotNull(searchRes);
        Assert.Single(searchRes.Items);
        Assert.Contains(uniqueSearchTerm, searchRes.Items[0].Subject);

        var catRes = await opsClient.GetFromJsonAsync<PagedResult<SupportTicketListDto>>(
            $"/api/staff/support/tickets?category=App&search={uniqueSearchTerm}", JsonOptions);
        Assert.NotNull(catRes);
        Assert.Single(catRes.Items);

        var mismatchRes = await opsClient.GetFromJsonAsync<PagedResult<SupportTicketListDto>>(
            $"/api/staff/support/tickets?category=Payment&search={uniqueSearchTerm}", JsonOptions);
        Assert.NotNull(mismatchRes);
        Assert.Empty(mismatchRes.Items);
    }

    // Traveler cannot choose Urgent priority on creation
    [Fact]
    public async Task Traveler_CannotSetUrgentPriority_ReturnsBadRequest()
    {
        var (client, _) = await AuthenticatedTravelerWithIdAsync();
        var res = await client.PostAsJsonAsync("/api/support/tickets", new CreateSupportTicketRequest(
            BookingId: null,
            Category: TicketCategory.Other,
            Subject: "Urgent issue",
            Description: "I need immediate help.",
            Priority: TicketPriority.Urgent
        ));

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // Helpers
    private async Task<(HttpClient Client, Guid BookingId, Guid TravelerId)> SetupBookingAsync()
    {
        var (client, travelerId) = await AuthenticatedTravelerWithIdAsync();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TrailWiseDbContext>();

        var package = new TourPackage
        {
            Name = $"Support Test Tour {Guid.NewGuid():N}",
            Theme = "SupportTheme",
            DurationDays = 3,
            BasePricePerPerson = 200m,
            MaxGroupSize = 10
        };
        var tier = new PackageTier
        {
            TourPackage = package,
            ClassType = ClassType.Normal,
            IncludesFood = false,
            BasePricePerPerson = 200m,
            RequiresAC = false
        };
        var booking = new Booking
        {
            TravelerId = travelerId,
            TourPackage = package,
            PackageTier = tier,
            GroupSize = 2,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(13)),
            BudgetPerPerson = 500m,
            Status = BookingStatus.Confirmed
        };

        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        return (client, booking.Id, travelerId);
    }

    private async Task<(HttpClient Client, Guid TravelerId)> AuthenticatedTravelerWithIdAsync()
    {
        var client = _factory.CreateClient();
        var email = $"traveler-{Guid.NewGuid():N}@example.com";
        await client.PostAsJsonAsync(
            "/api/auth/register",
            new { Name = "Support Traveler", Email = email, Password = "P@ssword123", ContactNumber = "+14155550100" });

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedAdminAsync()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = "admin@test.local", Password = "TestAdminPass123!" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return client;
    }

    private async Task<HttpClient> AuthenticatedOperationsManagerAsync()
    {
        var (client, _) = await AuthenticatedUserWithIdAsync("OperationsManager");
        return client;
    }

    private async Task<(HttpClient Client, Guid UserId)> AuthenticatedUserWithIdAsync(string role)
    {
        var client = _factory.CreateClient();
        var adminClient = await AuthenticatedAdminAsync();

        var email = $"{role.ToLower()}-{Guid.NewGuid():N}@example.com";
        var createResponse = await adminClient.PostAsJsonAsync("/api/auth/admin/users", new
        {
            Name = $"{role} User",
            Email = email,
            Password = "P@ssword123",
            ContactNumber = "+14155550101",
            Role = role
        });
        createResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/auth/login", new { Email = email, Password = "P@ssword123" });
        var auth = await loginResponse.Content.ReadFromJsonAsync<AuthResponse>(JsonOptions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth!.Token);
        return (client, auth.User.Id);
    }

    private async Task<HttpClient> AuthenticatedUserWithRoleAsync(string role)
    {
        var (client, _) = await AuthenticatedUserWithIdAsync(role);
        return client;
    }
}
