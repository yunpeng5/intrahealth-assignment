using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using PulseCheck.Api.Questionnaires;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>GET /api/questionnaires/{id} with the default configuration, which serves the shipped WC-6 (1.1, D-1).</summary>
public class QuestionnaireEndpointTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly (string Id, string Label)[] Wc6Options =
    [
        ("not-at-all", "Not at all"),
        ("several-days", "Several days"),
        ("more-than-half", "More than half the days"),
        ("nearly-every-day", "Nearly every day"),
    ];

    // From the WC-6 sample in docs/requirements.md.
    private static readonly (string Id, string Title, (string Id, string Prompt)[] Questions)[] Wc6Pages =
    [
        ("energy-sleep", "Energy and sleep", [("tired", "Feeling tired or having little energy"), ("sleep", "Trouble falling or staying asleep")]),
        ("mood", "Mood", [("nervous", "Feeling nervous or on edge"), ("interest", "Little interest or pleasure in doing things")]),
        ("focus", "Focus", [("concentration", "Difficulty concentrating"), ("piling-up", "Feeling that things are piling up")]),
    ];

    [Fact]
    public async Task Get_wc6_returns_its_title_instructions_pages_questions_and_options()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/questionnaires/wc-6");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        Assert.Equal("wc-6", json.GetProperty("id").GetString());
        Assert.Equal("Wellbeing Check (WC-6)", json.GetProperty("title").GetString());
        Assert.Equal("Over the past two weeks, how often have you been bothered by the following?",
            json.GetProperty("instructions").GetString());

        var pages = json.GetProperty("pages").EnumerateArray().ToList();
        Assert.Equal(Wc6Pages.Length, pages.Count);
        foreach (var (page, expected) in pages.Zip(Wc6Pages))
        {
            Assert.Equal(expected.Id, page.GetProperty("id").GetString());
            Assert.Equal(expected.Title, page.GetProperty("title").GetString());
            var questions = page.GetProperty("questions").EnumerateArray().ToList();
            Assert.Equal(expected.Questions.Length, questions.Count);
            foreach (var (question, expectedQuestion) in questions.Zip(expected.Questions))
            {
                Assert.Equal(expectedQuestion.Id, question.GetProperty("id").GetString());
                Assert.Equal(expectedQuestion.Prompt, question.GetProperty("prompt").GetString());
                var options = question.GetProperty("options").EnumerateArray()
                    .Select(option => (option.GetProperty("id").GetString()!, option.GetProperty("label").GetString()!));
                Assert.Equal(Wc6Options, options);
            }
        }
    }

    [Fact]
    public async Task Get_wc6_option_objects_carry_only_id_and_label()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/api/questionnaires/wc-6");

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;
        var optionProperties = json.GetProperty("pages").EnumerateArray()
            .SelectMany(page => page.GetProperty("questions").EnumerateArray())
            .SelectMany(question => question.GetProperty("options").EnumerateArray())
            .SelectMany(option => option.EnumerateObject().Select(property => property.Name))
            .Distinct()
            .Order();
        Assert.Equal(["id", "label"], optionProperties);
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("WC-6")]
    public async Task Get_unknown_questionnaire_returns_404(string id)
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync($"/api/questionnaires/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public void Wc6_definition_inside_the_back_end_keeps_option_values_and_bands()
    {
        var catalog = factory.Services.GetRequiredService<QuestionnaireCatalog>();

        Assert.True(catalog.TryGet("wc-6", out var definition));
        var questions = definition.Pages.SelectMany(page => page.Questions).ToList();
        Assert.Equal(6, questions.Count);
        Assert.All(questions, question => Assert.Equal(
            [("not-at-all", 0), ("several-days", 1), ("more-than-half", 2), ("nearly-every-day", 3)],
            question.Options.Select(option => (option.Id, option.Value))));
        Assert.Equal(
            [
                new BandDefinition(0, 4, "Doing well", "Keep doing what works for you. You can check in again any time."),
                new BandDefinition(5, 9, "Some strain", "Consider a self-guided resource. Checking in weekly helps you see patterns."),
                new BandDefinition(10, 14, "Under pressure", "It may help to talk to someone. You can request care from this portal."),
                new BandDefinition(15, 18, "Struggling",
                    "Please consider reaching out for support soon. If you are in crisis, contact a crisis line now."),
            ],
            definition.Bands);
    }
}
