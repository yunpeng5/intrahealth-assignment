using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// D-1, 2.4: the questionnaire the browser receives contains display data only: no option
/// values, scoring method, score ranges, severity labels or next-steps messages.
/// Pending until T2, which may only remove the Pending trait from this file (D-13).
/// </summary>
[Trait("Category", "Pending")]
public class QuestionnaireContractInvariantTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly string[] ForbiddenPropertyNames =
        ["value", "values", "score", "scoring", "band", "bands", "min", "max", "range", "nextSteps", "severity", "weight"];

    private async Task<(string Raw, JsonElement Json)> GetWc6()
    {
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(Wc6.QuestionnaireUrl);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var raw = await response.Content.ReadAsStringAsync();
        return (raw, JsonDocument.Parse(raw).RootElement.Clone());
    }

    [Fact]
    public async Task Questionnaire_response_contains_no_numbers()
    {
        var (_, json) = await GetWc6();

        var numbers = Json.Numbers(json);
        Assert.True(numbers.Count == 0,
            "INVARIANT VIOLATION (D-1, 2.4): the questionnaire response contains numbers, which can leak option values " +
            $"or score ranges: {string.Join("; ", numbers)}. FIX: send option IDs and labels only; keep values on the server.");
    }

    [Fact]
    public async Task Questionnaire_response_has_no_scoring_properties()
    {
        var (_, json) = await GetWc6();

        var names = Json.PropertyNames(json);
        var leaked = ForbiddenPropertyNames.Where(names.Contains).ToList();
        Assert.True(leaked.Count == 0,
            $"INVARIANT VIOLATION (D-1): the questionnaire response has scoring properties: {string.Join(", ", leaked)}. " +
            "FIX: map the definition to a display-only DTO (IDs, titles, prompts, option labels).");
    }

    [Fact]
    public async Task Questionnaire_response_contains_no_severity_labels_or_next_steps()
    {
        var (raw, _) = await GetWc6();

        var leaked = Wc6.Labels.Concat(Wc6.NextSteps).Where(text => raw.Contains(text, StringComparison.OrdinalIgnoreCase)).ToList();
        Assert.True(leaked.Count == 0,
            $"INVARIANT VIOLATION (D-1): the questionnaire response contains severity band text: {string.Join(" | ", leaked)}. " +
            "FIX: severity labels and next-steps messages are returned only by the submission endpoint (D-2).");
    }

    [Fact]
    public async Task Questionnaire_response_still_offers_every_option_by_id()
    {
        // Guards the tests above against passing on an empty or unrelated response.
        var (raw, _) = await GetWc6();

        foreach (var id in Wc6.QuestionIds.Concat(Wc6.OptionIds))
        {
            Assert.Contains($"\"{id}\"", raw);
        }
    }
}
