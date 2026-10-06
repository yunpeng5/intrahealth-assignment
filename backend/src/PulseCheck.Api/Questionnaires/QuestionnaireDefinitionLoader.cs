using System.Text.Json;

namespace PulseCheck.Api.Questionnaires;

/// <summary>
/// Reads questionnaire definition files (one JSON file per questionnaire, D-5) and checks the rules
/// correct behaviour depends on (D-5, D-6). Any problem throws a <see cref="QuestionnaireDefinitionException"/>
/// naming the file and the rule. Files are only read, never written.
/// </summary>
public static class QuestionnaireDefinitionLoader
{
    public const string SumScoring = "sum";

    private static readonly JsonSerializerOptions SerializerOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    /// <summary>Loads every <c>*.json</c> file in <paramref name="directory"/>, keyed by questionnaire ID.</summary>
    public static IReadOnlyDictionary<string, QuestionnaireDefinition> LoadDirectory(string directory)
    {
        if (!Directory.Exists(directory))
        {
            throw new QuestionnaireDefinitionException(directory, "the questionnaire definitions directory does not exist.");
        }

        var definitions = new Dictionary<string, QuestionnaireDefinition>(StringComparer.Ordinal);
        var files = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var file in Directory.EnumerateFiles(directory, "*.json").Order(StringComparer.Ordinal))
        {
            var definition = LoadFile(file);
            if (files.TryGetValue(definition.Id, out var other))
            {
                throw new QuestionnaireDefinitionException(file,
                    $"questionnaire ID '{definition.Id}' is also used by {Path.GetFileName(other)} (questionnaire IDs must be unique).");
            }
            files[definition.Id] = file;
            definitions[definition.Id] = definition;
        }
        return definitions;
    }

    public static QuestionnaireDefinition LoadFile(string file)
    {
        FileModel model;
        try
        {
            model = JsonSerializer.Deserialize<FileModel>(File.ReadAllText(file), SerializerOptions)
                ?? throw new QuestionnaireDefinitionException(file, "the file is empty (null).");
        }
        catch (JsonException e)
        {
            throw new QuestionnaireDefinitionException(file, $"the file is not a valid definition: {e.Message}");
        }
        return Validate(file, model);
    }

    private static QuestionnaireDefinition Validate(string file, FileModel model)
    {
        QuestionnaireDefinitionException Invalid(string problem) => new(file, problem);
        T Required<T>(T? value, string path) where T : class =>
            value ?? throw Invalid($"missing required property '{path}'.");

        var id = Required(model.Id, "id");
        var title = Required(model.Title, "title");

        var scoring = Required(model.Scoring, "scoring");
        if (scoring != SumScoring)
        {
            throw Invalid($"scoring is '{scoring}' (the only supported scoring method is '{SumScoring}').");
        }

        var pageIds = new HashSet<string>(StringComparer.Ordinal);
        var questionIds = new HashSet<string>(StringComparer.Ordinal);
        var pages = new List<PageDefinition>();
        foreach (var (pageModel, p) in Required(model.Pages, "pages").Select((page, i) => (page, i)))
        {
            var pagePath = $"pages[{p}]";
            var page = Required(pageModel, pagePath);
            var pageId = Required(page.Id, $"{pagePath}.id");
            if (!pageIds.Add(pageId))
            {
                throw Invalid($"page ID '{pageId}' is used more than once (page IDs must be unique within a questionnaire).");
            }

            var questions = new List<QuestionDefinition>();
            foreach (var (questionModel, q) in Required(page.Questions, $"{pagePath}.questions").Select((question, i) => (question, i)))
            {
                var questionPath = $"{pagePath}.questions[{q}]";
                var question = Required(questionModel, questionPath);
                var questionId = Required(question.Id, $"{questionPath}.id");
                if (!questionIds.Add(questionId))
                {
                    throw Invalid($"question ID '{questionId}' is used more than once (question IDs must be unique within a questionnaire).");
                }
                var prompt = Required(question.Prompt, $"{questionPath}.prompt");

                var optionModels = Required(question.Options, $"{questionPath}.options");
                if (optionModels.Count == 0)
                {
                    throw Invalid($"question '{questionId}' has no options (every question needs at least one option).");
                }

                var optionIds = new HashSet<string>(StringComparer.Ordinal);
                var options = new List<OptionDefinition>();
                foreach (var (optionModel, o) in optionModels.Select((option, i) => (option, i)))
                {
                    var optionPath = $"{questionPath}.options[{o}]";
                    var option = Required(optionModel, optionPath);
                    var optionId = Required(option.Id, $"{optionPath}.id");
                    if (!optionIds.Add(optionId))
                    {
                        throw Invalid(
                            $"option ID '{optionId}' is used more than once in question '{questionId}' (option IDs must be unique within a question).");
                    }
                    var label = Required(option.Label, $"{optionPath}.label");
                    var value = Integer(option.Value, $"{optionPath}.value")
                        ?? throw Invalid($"option '{optionId}' in question '{questionId}' has value {Raw(option.Value)} (option values must be integers).");
                    options.Add(new OptionDefinition(optionId, label, value));
                }
                questions.Add(new QuestionDefinition(questionId, prompt, options));
            }
            pages.Add(new PageDefinition(pageId, page.Title, questions));
        }

        var bands = new List<BandDefinition>();
        foreach (var (bandModel, b) in Required(model.Bands, "bands").Select((band, i) => (band, i)))
        {
            var bandPath = $"bands[{b}]";
            var band = Required(bandModel, bandPath);
            var min = Integer(band.Min, $"{bandPath}.min")
                ?? throw Invalid($"{bandPath}.min is {Raw(band.Min)} (band min and max must be integers).");
            var max = Integer(band.Max, $"{bandPath}.max")
                ?? throw Invalid($"{bandPath}.max is {Raw(band.Max)} (band min and max must be integers).");
            if (min > max)
            {
                throw Invalid($"{bandPath} has min {min} greater than max {max} (a band's min must not exceed its max).");
            }
            bands.Add(new BandDefinition(min, max, Required(band.Label, $"{bandPath}.label"), Required(band.NextSteps, $"{bandPath}.nextSteps")));
        }

        var allQuestions = pages.SelectMany(page => page.Questions).ToList();
        CheckBands(Invalid, bands,
            lowest: allQuestions.Sum(question => (long)question.Options.Min(option => option.Value)),
            highest: allQuestions.Sum(question => (long)question.Options.Max(option => option.Value)));

        return new QuestionnaireDefinition(id, title, model.Instructions, pages, bands);

        // Integer(...) reports a missing value as a missing property; a present non-integer returns null.
        int? Integer(JsonElement? element, string path) =>
            element is not { } value || value.ValueKind == JsonValueKind.Null
                ? throw Invalid($"missing required property '{path}'.")
                : value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : null;
    }

    /// <summary>D-6: bands do not overlap and together cover every integer score from lowest to highest, with no gaps.</summary>
    private static void CheckBands(Func<string, QuestionnaireDefinitionException> invalid, List<BandDefinition> bands, long lowest, long highest)
    {
        var sorted = bands.OrderBy(band => band.Min).ToList();
        for (var i = 1; i < sorted.Count; i++)
        {
            if (sorted[i].Min <= sorted[i - 1].Max)
            {
                throw invalid($"bands '{sorted[i - 1].Label}' and '{sorted[i].Label}' overlap at score {sorted[i].Min} (bands must not overlap).");
            }
        }

        var next = lowest;
        foreach (var band in sorted.TakeWhile(band => band.Min <= next))
        {
            next = Math.Max(next, band.Max + 1L);
        }
        if (next <= highest)
        {
            throw invalid($"no band covers score {next} (bands must cover every score from {lowest} to {highest}, with no gaps).");
        }
    }

    private static string Raw(JsonElement? element) => element?.GetRawText() ?? "null";

    private sealed record FileModel(string? Id, string? Title, string? Instructions, string? Scoring, List<PageModel?>? Pages, List<BandModel?>? Bands);

    private sealed record PageModel(string? Id, string? Title, List<QuestionModel?>? Questions);

    private sealed record QuestionModel(string? Id, string? Prompt, List<OptionModel?>? Options);

    private sealed record OptionModel(string? Id, string? Label, JsonElement? Value);

    private sealed record BandModel(JsonElement? Min, JsonElement? Max, string? Label, string? NextSteps);
}
