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
    /// <summary>Every property D-1 defines for the GET response; anything else could carry scoring data.</summary>
    private static readonly string[] AllowedPropertyNames =
        ["id", "title", "instructions", "pages", "questions", "prompt", "options", "label"];

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
    public async Task Questionnaire_response_has_only_display_properties()
    {
        var (_, json) = await GetWc6();

        var unexpected = Json.PropertyNames(json).Where(name => !AllowedPropertyNames.Contains(name)).OrderBy(n => n).ToList();
        Assert.True(unexpected.Count == 0,
            $"INVARIANT VIOLATION (D-1): the questionnaire response has properties outside the D-1 contract: {string.Join(", ", unexpected)}. " +
            $"Allowed: {string.Join(", ", AllowedPropertyNames)}. " +
            "FIX: map the definition to a display-only DTO (IDs, titles, instructions, prompts, option labels).");
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
