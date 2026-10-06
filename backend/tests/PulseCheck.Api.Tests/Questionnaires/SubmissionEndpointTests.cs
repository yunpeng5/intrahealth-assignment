using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>POST /api/questionnaires/{id}/submissions against the shipped WC-6 (1.2, 2.2, 2.4, D-2, D-6).</summary>
public class SubmissionEndpointTests(WebApplicationFactory<Program> factory)
    : IClassFixture<WebApplicationFactory<Program>>
{
    private static readonly string[] QuestionIds = ["tired", "sleep", "nervous", "interest", "concentration", "piling-up"];

    // WC-6 options by value, from docs/requirements.md: Not at all (0) ... Nearly every day (3).
    private static readonly string[] OptionIdByValue = ["not-at-all", "several-days", "more-than-half", "nearly-every-day"];

    private const string Label0To4 = "Doing well";
    private const string Steps0To4 = "Keep doing what works for you. You can check in again any time.";
    private const string Label5To9 = "Some strain";
    private const string Steps5To9 = "Consider a self-guided resource. Checking in weekly helps you see patterns.";
    private const string Label10To14 = "Under pressure";
    private const string Steps10To14 = "It may help to talk to someone. You can request care from this portal.";
    private const string Label15To18 = "Struggling";
    private const string Steps15To18 = "Please consider reaching out for support soon. If you are in crisis, contact a crisis line now.";

    /// <summary>WC-6 answers selecting the option with the given value for each question, in question order.</summary>
    private static Dictionary<string, string> AnswersWithValues(params int[] values) =>
        QuestionIds.Zip(values).ToDictionary(pair => pair.First, pair => OptionIdByValue[pair.Second]);

    private static Dictionary<string, string> CompleteAnswers() => AnswersWithValues(1, 1, 1, 1, 1, 1);

    private async Task<(HttpStatusCode Status, JsonElement Json)> Submit(object body, string url = "/api/questionnaires/wc-6/submissions")
    {
        using var client = factory.CreateClient();
        using var response = await client.PostAsJsonAsync(url, body);
        var raw = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, raw.Length == 0 ? default : JsonDocument.Parse(raw).RootElement.Clone());
    }

    public static TheoryData<int, int[], string, string> BandBoundaries => new()
    {
        { 0, [0, 0, 0, 0, 0, 0], Label0To4, Steps0To4 },
        { 4, [3, 1, 0, 0, 0, 0], Label0To4, Steps0To4 },
        { 5, [0, 0, 2, 3, 0, 0], Label5To9, Steps5To9 },
        { 9, [3, 3, 3, 0, 0, 0], Label5To9, Steps5To9 },
        { 10, [0, 1, 3, 3, 3, 0], Label10To14, Steps10To14 },
        { 14, [3, 3, 3, 3, 2, 0], Label10To14, Steps10To14 },
        { 15, [3, 3, 3, 3, 3, 0], Label15To18, Steps15To18 },
        { 18, [3, 3, 3, 3, 3, 3], Label15To18, Steps15To18 },
    };

    [Theory]
    [MemberData(nameof(BandBoundaries))]
    public async Task Wc6_band_boundaries_return_the_band_label_and_next_steps(int score, int[] values, string label, string nextSteps)
    {
        Assert.Equal(score, values.Sum());

        var (status, json) = await Submit(new { answers = AnswersWithValues(values) });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(["label", "nextSteps"], json.EnumerateObject().Select(p => p.Name));
        Assert.Equal(label, json.GetProperty("label").GetString());
        Assert.Equal(nextSteps, json.GetProperty("nextSteps").GetString());
    }

    [Fact]
    public async Task Unanswered_question_returns_400_naming_the_question()
    {
        var answers = CompleteAnswers();
        answers.Remove("interest");

        var (status, json) = await Submit(new { answers });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = json.GetProperty("errors");
        Assert.Equal(["interest"], errors.EnumerateObject().Select(p => p.Name));
        Assert.Contains("'interest'", errors.GetProperty("interest")[0].GetString());
    }

    [Fact]
    public async Task Missing_answers_returns_400_naming_every_question()
    {
        var (status, json) = await Submit(new { });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(QuestionIds.Order(), json.GetProperty("errors").EnumerateObject().Select(p => p.Name).Order());
    }

    [Fact]
    public async Task Unknown_question_id_returns_400_naming_it()
    {
        var answers = CompleteAnswers();
        answers["appetite"] = "not-at-all";

        var (status, json) = await Submit(new { answers });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = json.GetProperty("errors");
        Assert.Equal(["appetite"], errors.EnumerateObject().Select(p => p.Name));
        Assert.Contains("'appetite'", errors.GetProperty("appetite")[0].GetString());
    }

    [Theory]
    [InlineData("sometimes")]
    [InlineData("tired")]
    public async Task Option_that_does_not_belong_to_its_question_returns_400_without_echoing_it(string optionId)
    {
        var answers = CompleteAnswers();
        answers["sleep"] = optionId;

        var (status, json) = await Submit(new { answers });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        var errors = json.GetProperty("errors");
        Assert.Equal(["sleep"], errors.EnumerateObject().Select(p => p.Name));
        var message = errors.GetProperty("sleep")[0].GetString()!;
        Assert.Contains("'sleep'", message);
        Assert.DoesNotContain(optionId, message.Replace("'sleep'", ""));
    }

    [Theory]
    [InlineData("unknown")]
    [InlineData("WC-6")]
    public async Task Unknown_questionnaire_returns_404(string id)
    {
        var (status, _) = await Submit(new { answers = CompleteAnswers() }, $"/api/questionnaires/{id}/submissions");

        Assert.Equal(HttpStatusCode.NotFound, status);
    }
}
