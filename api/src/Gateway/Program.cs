var builder = WebApplication.CreateBuilder(args);

const string WebCors = "web";
var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddPolicy(WebCors, p => p
    .WithOrigins(origins)
    .AllowAnyMethod()
    .WithHeaders("Authorization", "Content-Type", "X-Client")
    .AllowCredentials())); // needed for the mp_refresh cookie

builder.Services.AddReverseProxy().LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();
app.UseCors(WebCors);
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapReverseProxy().RequireCors(WebCors);
app.Run();
