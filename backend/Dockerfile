FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY TrailWise.sln ./
COPY src/TrailWise.Domain/TrailWise.Domain.csproj src/TrailWise.Domain/
COPY src/TrailWise.Infrastructure/TrailWise.Infrastructure.csproj src/TrailWise.Infrastructure/
COPY src/TrailWise.Api/TrailWise.Api.csproj src/TrailWise.Api/
COPY tests/TrailWise.Api.Tests/TrailWise.Api.Tests.csproj tests/TrailWise.Api.Tests/
RUN dotnet restore TrailWise.sln

COPY . .
RUN dotnet publish src/TrailWise.Api/TrailWise.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "TrailWise.Api.dll"]
