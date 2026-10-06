using System.Text;
using System.Text.RegularExpressions;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-2, D-7: the back end contains no mechanism for persisting visitor data. A static scan of
/// backend/src for known persistence, caching, session, cookie, body-logging and visitor-state
/// store patterns. It is heuristic: a denylist of common APIs, not an exhaustive proof, and it
/// does not replace review. Reading files (questionnaire definitions, D-5) and immutable lookup
/// data are allowed; comment lines are ignored. Baseline: must pass at all times.
/// Section 3 (stretch) changes what the server may store; this test may only be changed by a
/// ticket that explicitly authorizes it (D-13, D-14).
/// </summary>
public class NoPersistenceSourceTests
{
    private sealed record Rule(string Name, Regex Pattern, string Fix);

    private static Rule R(string name, string pattern, string fix, RegexOptions options = RegexOptions.None) =>
        new(name, new Regex(pattern, RegexOptions.Compiled | options), fix);

    private static readonly Rule[] Rules =
    [
        R("file write",
            @"\bFile\.(WriteAll\w*|AppendAll\w*|AppendText|Create\w*|Move|Copy|Replace|Delete|OpenWrite|SetAttributes)\s*\(" +
            @"|\bnew\s+(FileStream|StreamWriter)\b|\bDirectory\.(CreateDirectory|Move|Delete)\s*\(" +
            @"|\bFileMode\.(Create|CreateNew|Append|Truncate|OpenOrCreate)\b|\bGetTempFileName\s*\(|\.(CreateText|OpenWrite)\s*\(",
            "Do not write files. The server may only read questionnaire definitions."),
        R("database",
            @"EntityFrameworkCore|\bDbContext\b|\bDapper\b|\bSqlConnection\b|Sqlite|Npgsql|MongoDB|LiteDB|StackExchange\.Redis" +
            @"|MySql|Oracle\.|CosmosClient|BlobServiceClient|AmazonS3",
            "Do not add a database or data store. Nothing about a visitor's questionnaire is persisted.",
            RegexOptions.IgnoreCase),
        R("cache",
            @"\bIMemoryCache\b|\bAddMemoryCache\b|\bIDistributedCache\b|\bAddDistributed\w*Cache\b|\bAdd\w*RedisCache\b|\bHybridCache\b" +
            @"|\b(Add|Use)OutputCache\b|\b(Add|Use)ResponseCaching\b",
            "Do not cache requests, responses or answers on the server."),
        R("session or cookie",
            @"\b(Add|Use)Session\b|\bISession\b|\.Session\b|\bCookies\.Append\b|\bCookieOptions\b|\bAddCookie\b",
            "Do not create sessions, cookies or visitor identifiers."),
        R("request/response logging",
            @"\b(Add|Use)HttpLogging\b|\b(Add|Use)W3CLogging\b",
            "Do not enable HTTP request/response logging: it can record answers. Log nothing derived from answers."),
        // Visitor state kept across requests: concurrent collections and static mutable collections.
        // Immutable lookup data (IReadOnlyDictionary, FrozenDictionary, arrays) does not match.
        R("in-memory visitor-state store",
            @"\bConcurrent(Dictionary|Bag|Queue|Stack)\b|\bstatic\s+(readonly\s+)?(List|Dictionary|SortedDictionary|HashSet|Queue|Stack)<",
            "Do not keep answers, scores or progress in memory across requests; compute the result within the request. " +
            "Hold questionnaire definitions in immutable types (IReadOnlyDictionary, FrozenDictionary, arrays)."),
    ];

    [Fact]
    public void Backend_source_has_no_persistence_mechanisms()
    {
        var src = Path.Combine(RepoPaths.Root(), "backend", "src");
        var files = Directory.EnumerateFiles(src, "*", SearchOption.AllDirectories)
            .Where(f => f.EndsWith(".cs") || f.EndsWith(".csproj") || f.EndsWith(".json"))
            .Where(f => !f.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar).Any(part => part is "bin" or "obj"))
            .ToList();
        Assert.NotEmpty(files);

        var violations = new StringBuilder();
        foreach (var file in files)
        {
            var lines = File.ReadAllLines(file);
            for (var i = 0; i < lines.Length; i++)
            {
                var trimmed = lines[i].TrimStart();
                if (trimmed.StartsWith("//") || trimmed.StartsWith("/*") || trimmed.StartsWith('*'))
                {
                    continue;
                }
                foreach (var rule in Rules.Where(rule => rule.Pattern.IsMatch(lines[i])))
                {
                    violations.AppendLine(
                        $"INVARIANT VIOLATION (D-7, T-2): {Path.GetRelativePath(RepoPaths.Root(), file)}:{i + 1} matches the {rule.Name} pattern: " +
                        $"`{trimmed}`. FIX: {rule.Fix}");
                }
            }
        }

        Assert.True(violations.Length == 0,
            violations + "Section 3 persistence is allowed only under a ticket that explicitly authorizes it (D-14).");
    }
}
