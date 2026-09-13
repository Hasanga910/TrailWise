using Microsoft.EntityFrameworkCore;
using TrailWise.Infrastructure.Persistence;

namespace TrailWise.Api.Tests;

internal static class TestDbContextFactory
{
    public static TrailWiseDbContext Create()
    {
        var options = new DbContextOptionsBuilder<TrailWiseDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new TrailWiseDbContext(options);
    }
}
