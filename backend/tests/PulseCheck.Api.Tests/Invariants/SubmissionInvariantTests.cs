using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-1, 2.2, 2.4, D-2, D-8: the numeric score never reaches the client, in the body or the
/// headers, on success or on error, and the success response is exactly { label, nextSteps }.
/// Pending until T3, which may only remove the Pending trait from this file (D-13).
/// </summary>
[Trait("Category", "Pending")]
public class SubmissionInvariantTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Successful_submission_returns_exactly_the_expected_label_and_next_steps()
    {
        using var client = factory.CreateClient();
        using var response = await Wc6.Submit(client, Wc6.AnswersScoring13());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal(JsonValueKind.Object, json.ValueKind);
        var names = json.EnumerateObject().Select(p => p.Name).OrderBy(n => n, StringComparer.Ordinal).ToList();
        Assert.True(names.SequenceEqual(["label", "nextSteps"]),
            $"INVARIANT VIOLATION (D-2): the submission response has properties [{string.Join(", ", names)}]; " +
            "it must have exactly label and nextSteps. FIX: return only those two strings.");

        // Exact values, so a score, band index or range added to either string fails ("10 to 14 ...").
        var label = json.GetProperty("label");
        var nextSteps = json.GetProperty("nextSteps");
        Assert.True(label.ValueKind == JsonValueKind.String && label.GetString() == Wc6.LabelFor13,
            $"INVARIANT VIOLATION (D-2, T-1): label is {label.GetRawText()}, expected \"{Wc6.LabelFor13}\" exactly. " +
            "FIX: return the band's label unchanged, with nothing added.");
        Assert.True(nextSteps.ValueKind == JsonValueKind.String && nextSteps.GetString() == Wc6.NextStepsFor13,
            $"INVARIANT VIOLATION (D-2, T-1): nextSteps is {nextSteps.GetRawText()}, expected \"{Wc6.NextStepsFor13}\" exactly. " +
            "FIX: return the band's next-steps message unchanged, with nothing added.");
    }

    [Fact]
    public async Task Successful_submission_contains_no_json_numbers()
    {
        using var client = factory.CreateClient();
        using var response = await Wc6.Submit(client, Wc6.AnswersScoring13());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var numbers = Json.Numbers(JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement);
        Assert.True(numbers.Count == 0,
            $"INVARIANT VIOLATION (T-1, 2.4): the submission response contains numbers: {string.Join("; ", numbers)}. " +
            "FIX: return only the label and next-steps message; never the score, a band index or a range.");
    }

    [Fact]
    public async Task Submission_headers_carry_no_score()
    {
        using var client = factory.CreateClient();
        using var response = await Wc6.Submit(client, Wc6.AnswersScoring13());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Standard headers legitimately contain digits (dates, lengths); only the others are checked for the score.
        string[] standard = ["Date", "Content-Length", "Content-Type", "Server", "Transfer-Encoding"];
        var headers = response.Headers.Concat(response.Content.Headers).ToList();
        var suspicious = headers
            .Where(h => Regex.IsMatch(h.Key, "score|band|severity|result", RegexOptions.IgnoreCase)
                || (!standard.Contains(h.Key, StringComparer.OrdinalIgnoreCase) && h.Value.Any(v => Regex.IsMatch(v, @"\b13\b"))))
            .Select(h => $"{h.Key}: {string.Join(",", h.Value)}")
            .ToList();
        Assert.True(suspicious.Count == 0,
            $"INVARIANT VIOLATION (T-1, D-8): response headers may carry the score: {string.Join("; ", suspicious)}. " +
            "FIX: do not put the score or band in headers.");
    }

    [Fact]
    public async Task Invalid_submission_echoes_no_answers_and_no_partial_score()
    {
        using var client = factory.CreateClient();
        using var response = await Wc6.Submit(client, Wc6.IncompleteAnswersPartial15());
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var visible = string.Join("\n", Json.VisibleValues(await response.Content.ReadAsStringAsync()));

        Assert.False(visible.Contains("nearly-every-day", StringComparison.OrdinalIgnoreCase),
            "INVARIANT VIOLATION (D-2): the error response echoes submitted option IDs. FIX: describe problems by question ID only.");
        Assert.False(Regex.IsMatch(visible, @"\b15\b"),
            "INVARIANT VIOLATION (D-2, D-8): the error response contains the partial score 15. FIX: never compute or return a partial score.");
        Assert.False(Wc6.Labels.Any(label => visible.Contains(label, StringComparison.OrdinalIgnoreCase)),
            "INVARIANT VIOLATION (D-2): the error response contains a severity label. FIX: an invalid submission has no result.");
    }
}
