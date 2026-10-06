using Microsoft.Extensions.Options;

namespace PulseCheck.Api.Questionnaires;

public sealed class QuestionnaireOptions
{
    public const string SectionName = "Questionnaires";

    /// <summary>The definitions directory (D-5). A relative path is resolved against the content root.</summary>
    public string DefinitionsPath { get; set; } = "Questionnaires/Definitions";
}

/// <summary>
/// The questionnaire definitions loaded from the definitions directory at startup (D-5). Read-only
/// definition data: it holds nothing about visitors (D-7).
/// </summary>
public sealed class QuestionnaireCatalog(IReadOnlyDictionary<string, QuestionnaireDefinition> definitions)
{
    public static QuestionnaireCatalog Load(IOptions<QuestionnaireOptions> options, IWebHostEnvironment environment) =>
        new(QuestionnaireDefinitionLoader.LoadDirectory(Path.GetFullPath(options.Value.DefinitionsPath, environment.ContentRootPath)));

    public bool TryGet(string id, [System.Diagnostics.CodeAnalysis.NotNullWhen(true)] out QuestionnaireDefinition? definition) =>
        definitions.TryGetValue(id, out definition);
}

/// <summary>Loads and validates the definitions when the host starts, so an invalid definition stops startup (D-5).</summary>
internal sealed class QuestionnaireCatalogStartupCheck(IServiceProvider services) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        services.GetRequiredService<QuestionnaireCatalog>();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
