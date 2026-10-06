namespace PulseCheck.Api.Questionnaires;

/// <summary>
/// The display-only questionnaire the browser receives (D-1): IDs, titles, instructions, prompts
/// and option labels. It has no property for option values, scoring or bands, so they cannot be serialized.
/// </summary>
public sealed record QuestionnaireView(string Id, string Title, string? Instructions, IReadOnlyList<PageView> Pages)
{
    public static QuestionnaireView From(QuestionnaireDefinition definition) => new(
        definition.Id,
        definition.Title,
        definition.Instructions,
        [.. definition.Pages.Select(page => new PageView(
            page.Id,
            page.Title,
            [.. page.Questions.Select(question => new QuestionView(
                question.Id,
                question.Prompt,
                [.. question.Options.Select(option => new OptionView(option.Id, option.Label))]))]))]);
}

public sealed record PageView(string Id, string? Title, IReadOnlyList<QuestionView> Questions);

public sealed record QuestionView(string Id, string Prompt, IReadOnlyList<OptionView> Options);

public sealed record OptionView(string Id, string Label);
