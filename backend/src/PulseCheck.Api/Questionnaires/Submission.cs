namespace PulseCheck.Api.Questionnaires;

/// <summary>The submission body (D-2): question ID to selected option ID.</summary>
public sealed record SubmissionRequest(Dictionary<string, string?>? Answers);

/// <summary>
/// The only scoring output the browser receives (D-2, D-8): the band's label and next-steps message.
/// It has no property for the score, band index or range, so they cannot be serialized.
/// </summary>
public sealed record SubmissionResult(string Label, string NextSteps)
{
    public static SubmissionResult From(BandDefinition band) => new(band.Label, band.NextSteps);
}
