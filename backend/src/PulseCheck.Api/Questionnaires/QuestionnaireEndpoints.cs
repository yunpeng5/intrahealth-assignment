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
        return app;
    }
}
