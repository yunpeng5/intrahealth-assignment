using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-2, 2.3, D-7: completing a questionnaire leaves nothing behind on the server: no files, no
/// cookies or identifiers, and nothing derived from the answers in the logs. Runs the whole flow
/// (load, then submit valid and invalid answers) and requires it to succeed, so these tests
/// cannot pass on missing endpoints. In-memory state is covered by NoPersistenceSourceTests.
/// Pending until T3, which may only remove the Pending trait from this file (D-13).
/// </summary>
[Trait("Category", "Pending")]
public class NoServerStateInvariantTests
{
    private static async Task<List<HttpResponseMessage>> CompleteFlow(HttpClient client)
    {
        var responses = new List<HttpResponseMessage>
        {
            await client.GetAsync(Wc6.QuestionnaireUrl),
            await Wc6.Submit(client, Wc6.AnswersScoring13()),
            await Wc6.Submit(client, Wc6.IncompleteAnswersPartial15()),
        };
        Assert.Equal(HttpStatusCode.OK, responses[0].StatusCode);
        Assert.Equal(HttpStatusCode.OK, responses[1].StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, responses[2].StatusCode);
        return responses;
    }

    [Fact]
    public async Task Completing_a_questionnaire_writes_no_files()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();
        var contentRoot = factory.Services.GetRequiredService<IWebHostEnvironment>().ContentRootPath;
        var before = FileSnapshot.Take(contentRoot, AppContext.BaseDirectory);

        await CompleteFlow(client);

        var changes = FileSnapshot.Take(contentRoot, AppContext.BaseDirectory).ChangesSince(before);
        Assert.True(changes.Count == 0,
            $"INVARIANT VIOLATION (T-2, 2.3): completing a questionnaire changed files on the server: {string.Join("; ", changes)}. " +
            "FIX: do not write answers, scores or anything about a submission to disk.");
    }

    [Fact]
    public async Task Completing_a_questionnaire_sets_no_cookies()
    {
        await using var factory = new WebApplicationFactory<Program>();
        using var client = factory.CreateClient();

        var responses = await CompleteFlow(client);

        var cookies = responses.Where(r => r.Headers.Contains("Set-Cookie")).SelectMany(r => r.Headers.GetValues("Set-Cookie")).ToList();
        Assert.True(cookies.Count == 0,
            $"INVARIANT VIOLATION (2.3, D-7): responses set cookies: {string.Join("; ", cookies)}. " +
            "FIX: no session, identifier or cookie of any kind in sections 1 and 2.");
    }

    [Fact]
    public async Task Completing_a_questionnaire_logs_nothing_derived_from_answers()
    {
        var capture = new CapturingLoggerProvider();
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging =>
            {
                logging.AddProvider(capture);
                // A provider-specific rule beats the appsettings filters: capture every level and category.
                logging.AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace);
            }));
        using var client = factory.CreateClient();
        // CreateClient started the host. Only logs written while handling the flow are checked:
        // startup output (content root path, environment) is machine-specific, not answer data.
        capture.Messages.Clear();

        await CompleteFlow(client);

        var forbidden = new List<(string What, Regex Pattern)>
        {
            ("a submitted option ID", new Regex(string.Join("|", Wc6.OptionIds.Select(Regex.Escape)), RegexOptions.IgnoreCase)),
            ("a severity label", new Regex(string.Join("|", Wc6.Labels.Select(Regex.Escape)), RegexOptions.IgnoreCase)),
            // The score (13) or partial score (15) as a standalone number, in any wording.
            ("the score", new Regex(@"\b(13|15)\b")),
        };
        // Elapsed times ("13.4ms", "15 ms") and stack-frame locations ("in C:\src\13\Program.cs:line 13")
        // are framework output, not scores: removed before matching.
        var frameworkNumbers = new Regex(@"\b\d+(\.\d+)?\s*ms\b| in [^\r\n]*?:line \d+", RegexOptions.IgnoreCase);
        var leaks = capture.Messages
            .Select(message => (Original: message, Checked: frameworkNumbers.Replace(message, "<framework>")))
            .SelectMany(m => forbidden.Where(f => f.Pattern.IsMatch(m.Checked)).Select(f => $"{f.What} in: {m.Original}"))
            .ToList();
        Assert.True(leaks.Count == 0,
            $"INVARIANT VIOLATION (D-7): logs contain data derived from answers: {string.Join(" || ", leaks)}. " +
            "FIX: never log request bodies, answers, scores or labels.");
    }
}
