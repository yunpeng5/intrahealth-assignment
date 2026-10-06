using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// Shared support for the protected invariant tests (D-13). These tests are black-box: they use
/// only URLs and the JSON contract in docs/decisions.md (D-1, D-2), never application types, so
/// they compile before the features exist.
/// </summary>
internal static class Wc6
{
    public const string Id = "wc-6";
    public const string QuestionnaireUrl = "/api/questionnaires/wc-6";
    public const string SubmissionUrl = "/api/questionnaires/wc-6/submissions";

    public static readonly string[] QuestionIds = ["tired", "sleep", "nervous", "interest", "concentration", "piling-up"];

    public static readonly string[] OptionIds = ["not-at-all", "several-days", "more-than-half", "nearly-every-day"];

    public static readonly string[] Labels = ["Doing well", "Some strain", "Under pressure", "Struggling"];

    public static readonly string[] NextSteps =
    [
        "Keep doing what works for you. You can check in again any time.",
        "Consider a self-guided resource. Checking in weekly helps you see patterns.",
        "It may help to talk to someone. You can request care from this portal.",
        "Please consider reaching out for support soon. If you are in crisis, contact a crisis line now.",
    ];

    /// <summary>Answers with a total score of 13 ("Under pressure"): 3 + 3 + 3 + 2 + 2 + 0.</summary>
    public static Dictionary<string, string> AnswersScoring13() => new()
    {
        ["tired"] = "nearly-every-day",
        ["sleep"] = "nearly-every-day",
        ["nervous"] = "nearly-every-day",
        ["interest"] = "more-than-half",
        ["concentration"] = "more-than-half",
        ["piling-up"] = "not-at-all",
    };

    /// <summary>Five of six questions answered "nearly every day": a partial score of 15.</summary>
    public static Dictionary<string, string> IncompleteAnswersPartial15() => new()
    {
        ["tired"] = "nearly-every-day",
        ["sleep"] = "nearly-every-day",
        ["nervous"] = "nearly-every-day",
        ["interest"] = "nearly-every-day",
        ["concentration"] = "nearly-every-day",
    };

    public static Task<HttpResponseMessage> Submit(HttpClient client, Dictionary<string, string> answers) =>
        client.PostAsJsonAsync(SubmissionUrl, new { answers });
}

internal static class Json
{
    /// <summary>Every number anywhere in the document, with its JSON path.</summary>
    public static List<string> Numbers(JsonElement element, string path = "$")
    {
        var found = new List<string>();
        switch (element.ValueKind)
        {
            case JsonValueKind.Number:
                found.Add($"{path} = {element.GetRawText()}");
                break;
            case JsonValueKind.Object:
                foreach (var property in element.EnumerateObject())
                {
                    found.AddRange(Numbers(property.Value, $"{path}.{property.Name}"));
                }
                break;
            case JsonValueKind.Array:
                var i = 0;
                foreach (var item in element.EnumerateArray())
                {
                    found.AddRange(Numbers(item, $"{path}[{i++}]"));
                }
                break;
        }
        return found;
    }

    /// <summary>
    /// The client-visible values of a response body: every string and number in a JSON body,
    /// except the standard ProblemDetails "type" URI (e.g. "...rfc9110#section-15.5.1") and
    /// "status" code. A body that is not JSON is returned whole.
    /// </summary>
    public static List<string> VisibleValues(string raw)
    {
        try
        {
            using var doc = JsonDocument.Parse(raw);
            var values = new List<string>();
            Collect(doc.RootElement, null, values);
            return values;
        }
        catch (JsonException)
        {
            return [raw];
        }

        static void Collect(JsonElement element, string? property, List<string> values)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var p in element.EnumerateObject())
                    {
                        Collect(p.Value, p.Name, values);
                    }
                    break;
                case JsonValueKind.Array:
                    foreach (var item in element.EnumerateArray())
                    {
                        Collect(item, property, values);
                    }
                    break;
                case JsonValueKind.String when property != "type":
                    values.Add(element.GetString()!);
                    break;
                case JsonValueKind.Number when property != "status":
                    values.Add(element.GetRawText());
                    break;
            }
        }
    }

    /// <summary>Every property name anywhere in the document.</summary>
    public static HashSet<string> PropertyNames(JsonElement element)
    {
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                names.Add(property.Name);
                names.UnionWith(PropertyNames(property.Value));
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                names.UnionWith(PropertyNames(item));
            }
        }
        return names;
    }
}

/// <summary>Captures every log message the app writes, at every level and category.</summary>
internal sealed class CapturingLoggerProvider : ILoggerProvider
{
    public ConcurrentQueue<string> Messages { get; } = new();

    public ILogger CreateLogger(string categoryName) => new CapturingLogger(categoryName, Messages);

    public void Dispose()
    {
    }

    private sealed class CapturingLogger(string category, ConcurrentQueue<string> messages) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            messages.Enqueue($"{logLevel} {category}: {formatter(state, exception)} {exception}");
        }
    }
}

/// <summary>A snapshot of the files under some directories: path, size and last write time.</summary>
internal sealed record FileSnapshot(IReadOnlyDictionary<string, (long Length, DateTime LastWriteUtc)> Files)
{
    public static FileSnapshot Take(params string[] roots)
    {
        var files = new Dictionary<string, (long, DateTime)>(StringComparer.OrdinalIgnoreCase);
        foreach (var root in roots.Where(Directory.Exists).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            foreach (var path in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
            {
                var info = new FileInfo(path);
                files[info.FullName] = (info.Length, info.LastWriteTimeUtc);
            }
        }
        return new FileSnapshot(files);
    }

    /// <summary>Files that were created, changed or deleted since <paramref name="before"/>.</summary>
    public List<string> ChangesSince(FileSnapshot before)
    {
        var changes = new List<string>();
        foreach (var (path, now) in Files)
        {
            if (!before.Files.TryGetValue(path, out var then))
            {
                changes.Add($"created: {path}");
            }
            else if (then != now)
            {
                changes.Add($"changed: {path}");
            }
        }
        changes.AddRange(before.Files.Keys.Where(path => !Files.ContainsKey(path)).Select(path => $"deleted: {path}"));
        return changes;
    }
}

internal static class RepoPaths
{
    /// <summary>The repository root: the nearest ancestor of the test output containing backend/PulseCheck.slnx.</summary>
    public static string Root()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "backend", "PulseCheck.slnx")))
            {
                return dir.FullName;
            }
        }
        throw new InvalidOperationException("Could not find the repository root (backend/PulseCheck.slnx) above the test output.");
    }
}
