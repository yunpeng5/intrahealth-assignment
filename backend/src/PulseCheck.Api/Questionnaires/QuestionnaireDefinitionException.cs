namespace PulseCheck.Api.Questionnaires;

/// <summary>An invalid questionnaire definition or definitions directory. Stops startup (D-5).</summary>
public sealed class QuestionnaireDefinitionException(string path, string problem)
    : Exception($"Invalid questionnaire definition {path}: {problem}")
{
    public string FilePath { get; } = path;

    public string Problem { get; } = problem;
}
