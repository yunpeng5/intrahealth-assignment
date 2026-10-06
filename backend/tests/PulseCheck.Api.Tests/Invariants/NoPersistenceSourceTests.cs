using System.Text;
using System.Text.RegularExpressions;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-2, D-7: the back end contains no mechanism for persisting visitor data. A static scan of
/// backend/src for persistence, caching, session, cookie, body-logging and in-memory-store APIs.
/// Reading files (questionnaire definitions, D-5) is allowed. Baseline: must pass at all times.
/// Section 3 (stretch) changes what the server may store; this test may only be changed by a
/// ticket that explicitly authorizes it (D-13, D-14).
/// </summary>
public class NoPersistenceSourceTests
{
    private sealed record Rule(string Name, Regex Pattern, string Fix);

    private static Rule R(string name, string pattern, string fix) => new(name, new Regex(pattern, RegexOptions.Compiled), fix);

    private static readonly Rule[] Rules =
    [
        R("file write",
            @"\bFile\.(WriteAll\w*|AppendAll\w*|AppendText|Create\w*|Move|Copy|Replace|Delete|OpenWrite|SetAttributes)\s*\(|\bnew\s+(FileStream|StreamWriter)\b|\bDirectory\.(CreateDirectory|Move|Delete)\s*\(",
            "Do not write files. The server may only read questionnaire definitions."),
        R("database",
            @"EntityFrameworkCore|\bDbContext\b|\bDapper\b|\bSqlConnection\b|Sqlite|Npgsql|MongoDB|LiteDB|StackExchange\.Redis",
            "Do not add a database or data store. Nothing about a visitor's questionnaire is persisted."),
        R("cache",
            @"\bIMemoryCache\b|\bAddMemoryCache\b|\bIDistributedCache\b|\bAddDistributedMemoryCache\b|\bAdd\w*RedisCache\b|\bHybridCache\b|\b(Add|Use)OutputCache\b|\b(Add|Use)ResponseCaching\b",
            "Do not cache requests, responses or answers on the server."),
        R("session or cookie",
            @"\b(Add|Use)Session\b|\bISession\b|\.Session\b|\bCookies\.Append\b|\bCookieOptions\b|\bAddCookie\b",
            "Do not create sessions, cookies or visitor identifiers."),
        R("request/response logging",
            @"\b(Add|Use)HttpLogging\b|\b(Add|Use)W3CLogging\b",
            "Do not enable HTTP request/response logging: it can record answers. Log nothing derived from answers."),
        R("in-memory store",
            @"\bConcurrent(Dictionary|Bag|Queue|Stack)\b|\bstatic\s+(List|Dictionary|HashSet|Queue|Stack)<",
            "Do not keep answers, scores or progress in memory across requests. Compute the result within the request."),
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
                foreach (var rule in Rules.Where(rule => rule.Pattern.IsMatch(lines[i])))
                {
                    violations.AppendLine(
                        $"INVARIANT VIOLATION (D-7, T-2): {Path.GetRelativePath(RepoPaths.Root(), file)}:{i + 1} uses a {rule.Name} API: " +
                        $"`{lines[i].Trim()}`. FIX: {rule.Fix}");
                }
            }
        }

        Assert.True(violations.Length == 0,
            violations + "Section 3 persistence is allowed only under a ticket that explicitly authorizes it (D-14).");
    }
}
