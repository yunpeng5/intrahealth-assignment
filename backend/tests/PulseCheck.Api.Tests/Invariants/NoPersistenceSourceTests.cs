using System.Text;
using System.Text.RegularExpressions;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-2, D-7: the back end contains no mechanism for persisting visitor data. A static scan of
/// backend/src for mechanisms with no legitimate use in this design: file writes, databases,
/// out-of-process caches, sessions and cookies, request-body logging and direct console output.
/// It is heuristic: a denylist of common APIs, not an exhaustive proof, and it does not replace
/// review. It does not constrain how in-memory data is held: reading files (questionnaire
/// definitions, D-5), in-memory collections and in-process caches are allowed, and in-memory
/// visitor state is left to review. Comment lines are ignored. Baseline: must pass at all times.
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
            // A read-only FileStream (FileMode.Open, FileAccess.Read) is allowed for loading definitions;
            // write modes and write access are flagged.
            @"|\bnew\s+StreamWriter\b|\bDirectory\.(CreateDirectory|Move|Delete)\s*\(" +
            @"|\bFileMode\.(Create|CreateNew|Append|Truncate|OpenOrCreate)\b|\bFileAccess\.(Write|ReadWrite)\b" +
            @"|\bGetTempFileName\s*\(|\.(CreateText|OpenWrite)\s*\(",
            "Do not write files. The server may only read questionnaire definitions."),
        R("database",
            @"EntityFrameworkCore|\bDbContext\b|\bDapper\b|\bSqlConnection\b|Sqlite|Npgsql|MongoDB|LiteDB|StackExchange\.Redis" +
            @"|MySql|Oracle\.|CosmosClient|BlobServiceClient|AmazonS3",
            "Do not add a database or data store. Nothing about a visitor's questionnaire is persisted.",
            RegexOptions.IgnoreCase),
        // Out-of-process caches persist whatever they hold. In-process caches and response/output
        // caching are not flagged: they can legitimately hold questionnaire definitions or GET
        // responses, and a static scan cannot tell that apart from visitor state (review covers it).
        R("distributed cache",
            @"\bIDistributedCache\b|\bAddDistributed\w*Cache\b|\bAdd\w*RedisCache\b",
            "Do not store anything in an out-of-process cache: that persists it outside the request."),
        R("session or cookie",
            @"\b(Add|Use)Session\b|\bISession\b|\.Session\b|\bCookies\.Append\b|\bCookieOptions\b|\bAddCookie\b",
            "Do not create sessions, cookies or visitor identifiers."),
        // Direct console/debug/trace output bypasses ILogger, so the runtime log check cannot see it.
        R("request/response or direct logging",
            @"\b(Add|Use)HttpLogging\b|\b(Add|Use)W3CLogging\b|\b(Console|Debug|Trace)\.Write",
            "Do not enable HTTP request/response logging or write to Console/Debug/Trace: either can record answers. " +
            "Use ILogger, and log nothing derived from answers."),
        // No rule for in-memory collections: a definition registry and a store of answers look the same
        // to a static scan. In-memory visitor state is left to review (the review bot checks D-7 on every PR).
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
