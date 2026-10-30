FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src
COPY ["PaymentGateway.API/PaymentGateway.API.csproj", "PaymentGateway.API/"]
COPY ["PaymentGateway.Infrastructure/PaymentGateway.Infrastructure.csproj", "PaymentGateway.Infrastructure/"]
COPY ["PaymentGateway.Application/PaymentGateway.Application.csproj", "PaymentGateway.Application/"]
COPY ["PaymentGateway.Domain/PaymentGateway.Domain.csproj", "PaymentGateway.Domain/"]
RUN dotnet restore "PaymentGateway.API/PaymentGateway.API.csproj"
COPY . .
WORKDIR "/src/PaymentGateway.API"
RUN dotnet build "./PaymentGateway.API.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./PaymentGateway.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM build AS migrations
WORKDIR /src
RUN dotnet tool restore
# Generate the artifact without connecting to a database or using production secrets.
RUN ASPNETCORE_ENVIRONMENT=Production \
    ConnectionStrings__DefaultConnection="Host=localhost;Database=build_only;Username=build_only;Password=build_only" \
    dotnet ef migrations bundle \
    --project PaymentGateway.Infrastructure \
    --startup-project PaymentGateway.API \
    --configuration Release \
    --target-runtime linux-x64 \
    --output /app/efbundle

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
COPY --from=migrations --chmod=755 /app/efbundle ./efbundle
ENTRYPOINT ["dotnet", "PaymentGateway.API.dll"]
