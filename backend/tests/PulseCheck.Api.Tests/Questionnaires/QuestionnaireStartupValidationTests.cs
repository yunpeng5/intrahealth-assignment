using System.Net;
using System.Text.Json.Nodes;
using PulseCheck.Api.Questionnaires;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>
/// D-5, D-6: every definition is checked at startup, and an invalid one stops startup with an error
/// naming the file and the rule it breaks. Each test starts the app on a directory holding one
/// broken copy of a valid definition. The directories live under the system temp path, outside the
/// app's content root and the test output.
/// </summary>
public sealed class QuestionnaireStartupValidationTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "pulsecheck-tests", Guid.NewGuid().ToString("N"));

    public QuestionnaireStartupValidationTests() => Directory.CreateDirectory(directory);

    public void Dispose() => Directory.Delete(directory, recursive: true);

    /// <summary>Two pages, one question each, options worth 0 to 2: possible scores 0 to 4, covered by two bands.</summary>
    private static JsonNode ValidDefinition() => JsonNode.Parse("""
        {
          "id": "fixture",
          "title": "Fixture",
          "instructions": "Answer both questions.",
          "scoring": "sum",
          "pages": [
            { "id": "p1", "title": "Page 1", "questions": [
              { "id": "q1", "prompt": "Question 1", "options": [
                { "id": "low", "label": "Low", "value": 0 },
                { "id": "mid", "label": "Mid", "value": 1 },
                { "id": "high", "label": "High", "value": 2 } ] } ] },
            { "id": "p2", "title": "Page 2", "questions": [
              { "id": "q2", "prompt": "Question 2", "options": [
                { "id": "low", "label": "Low", "value": 0 },
                { "id": "mid", "label": "Mid", "value": 1 },
                { "id": "high", "label": "High", "value": 2 } ] } ] }
          ],
          "bands": [
            { "min": 0, "max": 1, "label": "Fine", "nextSteps": "Carry on." },
            { "min": 2, "max": 4, "label": "Not fine", "nextSteps": "Get support." }
          ]
        }
        """)!;

    private void Write(string fileName, JsonNode definition) =>
        File.WriteAllText(Path.Combine(directory, fileName), definition.ToJsonString());

    /// <summary>Starts the app on the directory and returns the definition error that stopped it.</summary>
    private async Task<QuestionnaireDefinitionException> StartupFailure()
    {
        var app = new QuestionnaireApp(directory);
        var exception = Record.Exception(() => app.CreateClient());
        try
        {
            await app.DisposeAsync();
        }
        catch (Exception)
        {
            // The host never started; disposing it has nothing left to clean up.
        }

        Assert.True(exception is not null, "The app started with an invalid definition.");
        // When startup fails fast, WebApplicationFactory may surface an ObjectDisposedException
        // instead of the cause, so the cause is also taken from the host's "failed to start" log.
        var failure = app.LoggedExceptions.Prepend(exception).SelectMany(Flatten)
            .OfType<QuestionnaireDefinitionException>().FirstOrDefault();
        Assert.True(failure is not null, $"Startup failed, but not with a definition error: {exception}");
        return failure;

        static IEnumerable<Exception> Flatten(Exception e) =>
            e is AggregateException aggregate
                ? aggregate.InnerExceptions.SelectMany(Flatten).Prepend(e)
                : e.InnerException is null ? [e] : Flatten(e.InnerException).Prepend(e);
    }

    private async Task AssertStartupFails(string fileName, string expectedRule)
    {
        var failure = await StartupFailure();
        Assert.Equal(fileName, Path.GetFileName(failure.FilePath));
        Assert.Contains(fileName, failure.Message);
        Assert.Contains(expectedRule, failure.Message);
    }

    [Fact]
    public async Task Valid_definition_starts_and_is_served()
    {
        // Guards the tests below: the base definition is valid, so each failure comes from its one change.
        Write("fixture.json", ValidDefinition());
        await using var app = new QuestionnaireApp(directory);
        using var client = app.CreateClient();

        using var response = await client.GetAsync("/api/questionnaires/fixture");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Duplicate_questionnaire_ids_across_files_stop_startup()
    {
        Write("a.json", ValidDefinition());
        Write("b.json", ValidDefinition());

        await AssertStartupFails("b.json", "questionnaire IDs must be unique");
    }

    [Fact]
    public async Task Duplicate_page_ids_stop_startup()
    {
        var definition = ValidDefinition();
        definition["pages"]![1]!["id"] = "p1";
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "page IDs must be unique");
    }

    [Fact]
    public async Task Duplicate_question_ids_across_pages_stop_startup()
    {
        var definition = ValidDefinition();
        definition["pages"]![1]!["questions"]![0]!["id"] = "q1";
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "question IDs must be unique");
    }

    [Fact]
    public async Task Duplicate_option_ids_within_a_question_stop_startup()
    {
        var definition = ValidDefinition();
        definition["pages"]![0]!["questions"]![0]!["options"]![1]!["id"] = "low";
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "option IDs must be unique within a question");
    }

    [Fact]
    public async Task Question_without_options_stops_startup()
    {
        var definition = ValidDefinition();
        definition["pages"]![0]!["questions"]![0]!["options"] = new JsonArray();
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "every question needs at least one option");
    }

    [Theory]
    [InlineData("1.5")]
    [InlineData("\"1\"")]
    public async Task Non_integer_option_value_stops_startup(string value)
    {
        var definition = ValidDefinition();
        definition["pages"]![0]!["questions"]![0]!["options"]![1]!["value"] = JsonNode.Parse(value);
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "option values must be integers");
    }

    [Theory]
    [InlineData("average")]
    [InlineData("Sum")]
    public async Task Scoring_method_other_than_sum_stops_startup(string scoring)
    {
        var definition = ValidDefinition();
        definition["scoring"] = scoring;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "the only supported scoring method is 'sum'");
    }

    [Fact]
    public async Task Overlapping_bands_stop_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![1]!["min"] = 1;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "bands must not overlap");
    }

    [Fact]
    public async Task Gap_between_bands_stops_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![1]!["min"] = 3;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "no band covers score 2");
    }

    [Fact]
    public async Task Bands_not_reaching_the_highest_possible_score_stop_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![1]!["max"] = 3;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "no band covers score 4");
    }

    [Fact]
    public async Task Bands_not_starting_at_the_lowest_possible_score_stop_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![0]!["min"] = 1;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "no band covers score 0");
    }

    [Fact]
    public async Task Non_integer_band_bound_stops_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![0]!["max"] = 1.5;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "band min and max must be integers");
    }

    [Fact]
    public async Task Band_with_min_above_max_stops_startup()
    {
        var definition = ValidDefinition();
        definition["bands"]![1]!["min"] = 5;
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "a band's min must not exceed its max");
    }

    [Fact]
    public async Task Missing_required_property_stops_startup()
    {
        var definition = ValidDefinition();
        definition["pages"]![0]!["questions"]![0]!.AsObject().Remove("prompt");
        Write("bad.json", definition);

        await AssertStartupFails("bad.json", "missing required property 'pages[0].questions[0].prompt'");
    }

    [Fact]
    public async Task Malformed_json_stops_startup()
    {
        File.WriteAllText(Path.Combine(directory, "bad.json"), "{ \"id\": ");

        await AssertStartupFails("bad.json", "the file is not a valid definition");
    }

    [Fact]
    public async Task Missing_definitions_directory_stops_startup()
    {
        Directory.Delete(directory);
        try
        {
            var failure = await StartupFailure();

            Assert.Equal(directory, failure.FilePath);
            Assert.Contains("the questionnaire definitions directory does not exist", failure.Message);
        }
        finally
        {
            Directory.CreateDirectory(directory);
        }
    }
}
