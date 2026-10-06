using PulseCheck.Api.Questionnaires;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddQuestionnaires();
var app = builder.Build();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapQuestionnaireEndpoints();

app.Run();
