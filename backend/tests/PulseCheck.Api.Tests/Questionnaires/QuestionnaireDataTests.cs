using System.Net;
using System.Text.Json;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>1.3, D-5: a second questionnaire with different paging is served from a definitions directory, with no code change.</summary>
public class QuestionnaireDataTests
{
    private static readonly string FixtureDirectory =
        Path.Combine(AppContext.BaseDirectory, "Questionnaires", "Fixtures", "second-questionnaire");

    [Fact]
    public async Task Second_questionnaire_in_the_configured_directory_is_served_with_its_own_paging()
    {
        await using var app = new QuestionnaireApp(FixtureDirectory);
        using var client = app.CreateClient();

        using var response = await client.GetAsync("/api/questionnaires/daily-check");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("Daily Check", json.GetProperty("title").GetString());
        var paging = json.GetProperty("pages").EnumerateArray()
            .Select(page => (
                page.GetProperty("id").GetString(),
                string.Join(",", page.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("id").GetString()))))
            .ToList();
        Assert.Equal([("body", "headache,appetite,restless"), ("outlook", "hopeful")], paging);
        var hopefulOptions = json.GetProperty("pages")[1].GetProperty("questions")[0].GetProperty("options").EnumerateArray()
            .Select(option => option.GetProperty("label").GetString());
        Assert.Equal(["Yes", "Unsure", "No"], hopefulOptions);
    }

    [Fact]
    public async Task Questionnaires_outside_the_configured_directory_are_not_served()
    {
        await using var app = new QuestionnaireApp(FixtureDirectory);
        using var client = app.CreateClient();

        using var response = await client.GetAsync("/api/questionnaires/wc-6");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
