namespace PulseCheck.Api.Questionnaires;

/// <summary>
/// A validated questionnaire definition, including option values and severity bands (1.1, 1.2).
/// Back end only: never serialize it to a response. The browser gets a <see cref="QuestionnaireView"/> (D-1).
/// Scoring is always the sum of the selected option values (D-6).
/// </summary>
public sealed record QuestionnaireDefinition(
    string Id,
    string Title,
    string? Instructions,
    IReadOnlyList<PageDefinition> Pages,
    IReadOnlyList<BandDefinition> Bands);

public sealed record PageDefinition(string Id, string? Title, IReadOnlyList<QuestionDefinition> Questions);

public sealed record QuestionDefinition(string Id, string Prompt, IReadOnlyList<OptionDefinition> Options);

public sealed record OptionDefinition(string Id, string Label, int Value);

/// <summary>A severity band: an inclusive integer score range with its label and next-steps message (D-6).</summary>
public sealed record BandDefinition(int Min, int Max, string Label, string NextSteps);
