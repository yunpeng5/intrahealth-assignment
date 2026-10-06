using System.Text;
using System.Text.RegularExpressions;

namespace PulseCheck.Api.Tests.Invariants;

/// <summary>
/// T-2, 2.3, D-7: a static scan of backend/src for the mechanisms that map directly to the
/// requirements: file writes and databases ("nothing is written on the server", T-2) and sessions
/// and cookies (no visitor identifier or state, 2.3). It does not ban technologies or output
/// channels as proxies for what they might contain. Allowed: reading files (questionnaire
/// definitions, D-5), in-memory collections, in-process and distributed caches, logging and
/// console output. Left to review (D-7) and the runtime invariant tests: in-memory visitor state,
/// direct console output, and persistence mechanisms this list does not name. It is a denylist
/// of common APIs, not an exhaustive proof. Comment lines are ignored. Baseline: must pass at all times.
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
            "Do not write files (T-2: nothing is written on the server). The server may only read questionnaire definitions."),
        R("database",
            @"EntityFrameworkCore|\bDbContext\b|\bDapper\b|\bSqlConnection\b|Sqlite|Npgsql|MongoDB|LiteDB|MySql|Oracle\.|CosmosClient",
            "Do not add a database (T-2: nothing is written on the server; D-5: definitions are read-only files).",
            RegexOptions.IgnoreCase),
        R("session or cookie",
            @"\b(Add|Use)Session\b|\bISession\b|\.Session\b|\bCookies\.Append\b|\bCookieOptions\b|\bAddCookie\b",
            "Do not create sessions, cookies or visitor identifiers (2.3: no identifier)."),
        // Deliberately no rules for caches, logging middleware, console output or in-memory collections:
        // they are technologies or channels, not visitor state, and a static scan cannot tell what they
        // hold. The runtime tests check logged content; review covers the rest (D-7).
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
