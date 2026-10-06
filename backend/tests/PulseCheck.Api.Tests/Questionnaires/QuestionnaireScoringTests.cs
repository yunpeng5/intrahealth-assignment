using PulseCheck.Api.Questionnaires;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>Scoring and band lookup (1.2, D-6) on a small definition built in the test, independent of WC-6.</summary>
public class QuestionnaireScoringTests
{
    // Two pages, so scoring is shown to span pages; values differ per question and include a negative.
    private static readonly QuestionnaireDefinition Definition = new(
        "test",
        "Test",
        null,
        [
            new PageDefinition("p1", null,
            [
                new QuestionDefinition("a", "A", [new OptionDefinition("low", "Low", -1), new OptionDefinition("high", "High", 4)]),
                new QuestionDefinition("b", "B", [new OptionDefinition("low", "Low", 0), new OptionDefinition("high", "High", 2)]),
            ]),
            new PageDefinition("p2", null,
            [
                new QuestionDefinition("c", "C", [new OptionDefinition("only", "Only", 1)]),
            ]),
        ],
        [
            new BandDefinition(0, 2, "Low band", "Low steps"),
            new BandDefinition(-1, -1, "Negative band", "Negative steps"),
            new BandDefinition(3, 7, "High band", "High steps"),
        ]);

    /// <summary>Answers for questions a, b and c; a null argument leaves that question out.</summary>
    private static Dictionary<string, string?> Answers(string? a, string? b, string? c) =>
        new[] { ("a", a), ("b", b), ("c", c) }
            .Where(answer => answer.Item2 is not null)
            .ToDictionary(answer => answer.Item1, answer => answer.Item2);

    [Theory]
    [InlineData("low", "low", 0)]
    [InlineData("low", "high", 2)]
    [InlineData("high", "low", 5)]
    [InlineData("high", "high", 7)]
    public void Score_is_the_sum_of_the_selected_option_values_across_pages(string a, string b, int expected)
    {
        Assert.Equal(expected, QuestionnaireScoring.Score(Definition, Answers(a, b, "only")));
    }

    [Theory]
    [InlineData(-1, "Negative band")]
    [InlineData(0, "Low band")]
    [InlineData(2, "Low band")]
    [InlineData(3, "High band")]
    [InlineData(7, "High band")]
    public void Band_is_the_one_whose_inclusive_range_contains_the_score(int score, string expected)
    {
        Assert.Equal(expected, QuestionnaireScoring.BandFor(Definition, score).Label);
    }

    [Fact]
    public void Complete_valid_answers_have_no_errors()
    {
        Assert.Empty(QuestionnaireScoring.Validate(Definition, Answers("high", "low", "only")));
    }

    [Fact]
    public void Each_unanswered_question_is_reported_by_its_id()
    {
        var answers = Answers("high", null, null);
        answers["c"] = "";

        var errors = QuestionnaireScoring.Validate(Definition, answers);

        Assert.Equal(["b", "c"], errors.Keys.Order());
        Assert.Equal(["Question 'b' has no answer."], errors["b"]);
        Assert.Equal(["Question 'c' has no answer."], errors["c"]);
    }

    [Fact]
    public void A_null_answer_counts_as_unanswered()
    {
        var answers = Answers("high", "low", null);
        answers["c"] = null;

        var errors = QuestionnaireScoring.Validate(Definition, answers);

        Assert.Equal(["c"], errors.Keys);
    }

    [Fact]
    public void An_unknown_question_id_is_reported()
    {
        var answers = Answers("high", "low", "only");
        answers["z"] = "low";

        var errors = QuestionnaireScoring.Validate(Definition, answers);

        Assert.Equal(["z"], errors.Keys);
        Assert.Equal(["Question 'z' is not part of this questionnaire."], errors["z"]);
    }

    [Fact]
    public void An_option_from_another_question_is_reported_without_echoing_it()
    {
        // "only" exists, but belongs to question c, not a.
        var errors = QuestionnaireScoring.Validate(Definition, Answers("only", "low", "only"));

        Assert.Equal(["a"], errors.Keys);
        var message = Assert.Single(errors["a"]);
        Assert.Equal("The answer to question 'a' is not one of its options.", message);
    }
}
