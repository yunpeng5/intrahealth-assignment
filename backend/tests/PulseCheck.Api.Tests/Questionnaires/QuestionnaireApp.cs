using System.Collections.Concurrent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PulseCheck.Api.Tests.Questionnaires;

/// <summary>
/// Starts the app with its questionnaire definitions directory pointed elsewhere (D-5), and keeps
/// every exception the app logs so a test can see why startup failed.
/// </summary>
internal sealed class QuestionnaireApp(string definitionsPath) : WebApplicationFactory<Program>
{
    public ConcurrentQueue<Exception> LoggedExceptions { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(
            new Dictionary<string, string?> { ["Questionnaires:DefinitionsPath"] = definitionsPath }));
        builder.ConfigureLogging(logging => logging.AddProvider(new ExceptionLoggerProvider(LoggedExceptions)));
    }

    private sealed class ExceptionLoggerProvider(ConcurrentQueue<Exception> exceptions) : ILoggerProvider, ILogger
    {
        public ILogger CreateLogger(string categoryName) => this;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (exception is not null)
            {
                exceptions.Enqueue(exception);
            }
        }

        public void Dispose()
        {
        }
    }
}
