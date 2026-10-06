using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace PulseCheck.Api.Questionnaires;

public static class QuestionnaireEndpoints
{
    public static IServiceCollection AddQuestionnaires(this IServiceCollection services)
    {
        services.AddOptions<QuestionnaireOptions>().BindConfiguration(QuestionnaireOptions.SectionName);
        services.AddSingleton(provider => QuestionnaireCatalog.Load(
            provider.GetRequiredService<IOptions<QuestionnaireOptions>>(), provider.GetRequiredService<IWebHostEnvironment>()));
        services.AddHostedService<QuestionnaireCatalogStartupCheck>();
        return services;
    }

    public static IEndpointRouteBuilder MapQuestionnaireEndpoints(this IEndpointRouteBuilder app)
    {
        // D-1: display data only. The definition is mapped to a QuestionnaireView, never serialized itself.
        app.MapGet("/api/questionnaires/{id}", Results<Ok<QuestionnaireView>, NotFound> (string id, QuestionnaireCatalog catalog) =>
            catalog.TryGet(id, out var definition) ? TypedResults.Ok(QuestionnaireView.From(definition)) : TypedResults.NotFound());

        // D-2: scored on the server; only the band's label and next-steps message are returned. Nothing is kept or logged (D-7, D-8).
        app.MapPost("/api/questionnaires/{id}/submissions", Results<Ok<SubmissionResult>, ValidationProblem, NotFound> (
            string id, SubmissionRequest request, QuestionnaireCatalog catalog) => Submit(id, request, catalog));
        return app;
    }

    private static Results<Ok<SubmissionResult>, ValidationProblem, NotFound> Submit(string id, SubmissionRequest request, QuestionnaireCatalog catalog)
    {
        if (!catalog.TryGet(id, out var definition))
        {
            return TypedResults.NotFound();
        }

        var answers = request.Answers ?? new Dictionary<string, string?>();
        var errors = QuestionnaireScoring.Validate(definition, answers);
        if (errors.Count > 0)
        {
            return TypedResults.ValidationProblem(errors);
        }

        var score = QuestionnaireScoring.Score(definition, answers);
        return TypedResults.Ok(SubmissionResult.From(QuestionnaireScoring.BandFor(definition, score)));
    }
}
