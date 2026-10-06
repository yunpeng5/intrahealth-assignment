namespace PulseCheck.Api.Questionnaires;

/// <summary>
/// Checks submitted answers and scores them on the server (1.2, 1.6, 2.4). Stateless: the score
/// exists only as a local value inside the request that computed it (D-7, D-8).
/// </summary>
public static class QuestionnaireScoring
{
    /// <summary>
    /// The problems with <paramref name="answers"/> (question ID to option ID), keyed by question ID (D-2):
    /// a question with no answer, an unknown question ID, or an option that does not belong to its question.
    /// Messages name question IDs only, never option IDs or values. Empty when the answers are complete and valid.
    /// </summary>
    public static Dictionary<string, string[]> Validate(QuestionnaireDefinition definition, IReadOnlyDictionary<string, string?> answers)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var questions = definition.Pages.SelectMany(page => page.Questions).ToList();
        foreach (var question in questions)
        {
            if (!answers.TryGetValue(question.Id, out var optionId) || string.IsNullOrEmpty(optionId))
            {
                errors[question.Id] = [$"Question '{question.Id}' has no answer."];
            }
            else if (!question.Options.Any(option => option.Id == optionId))
            {
                errors[question.Id] = [$"The answer to question '{question.Id}' is not one of its options."];
            }
        }

        var known = questions.Select(question => question.Id).ToHashSet(StringComparer.Ordinal);
        foreach (var questionId in answers.Keys.Where(id => !known.Contains(id)))
        {
            errors[questionId] = [$"Question '{questionId}' is not part of this questionnaire."];
        }
        return errors;
    }

    /// <summary>The integer sum of the selected options' values (D-6). <paramref name="answers"/> must pass <see cref="Validate"/>.</summary>
    public static int Score(QuestionnaireDefinition definition, IReadOnlyDictionary<string, string?> answers) =>
        definition.Pages
            .SelectMany(page => page.Questions)
            .Sum(question => question.Options.Single(option => option.Id == answers[question.Id]).Value);

    /// <summary>The band whose inclusive range contains <paramref name="score"/>. Startup validation guarantees exactly one (D-6).</summary>
    public static BandDefinition BandFor(QuestionnaireDefinition definition, int score) =>
        definition.Bands.Single(band => band.Min <= score && score <= band.Max);
}
