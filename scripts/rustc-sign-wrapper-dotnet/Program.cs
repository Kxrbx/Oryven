using System.Diagnostics;

if (args.Length < 1)
{
    Console.Error.WriteLine("rustc-sign-wrapper expected rustc path as the first argument.");
    return 2;
}

var rustc = args[0];
var rustcArgs = args.Skip(1).ToArray();

var rustcStart = new ProcessStartInfo(rustc)
{
    UseShellExecute = false,
};

foreach (var arg in rustcArgs)
{
    rustcStart.ArgumentList.Add(arg);
}

using (var rustcProcess = Process.Start(rustcStart))
{
    if (rustcProcess is null)
    {
        Console.Error.WriteLine("Failed to start rustc.");
        return 1;
    }

    rustcProcess.WaitForExit();
    if (rustcProcess.ExitCode != 0)
    {
        return rustcProcess.ExitCode;
    }
}

var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
var outDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
string? crateName = null;
for (var i = 0; i < rustcArgs.Length; i++)
{
    var arg = rustcArgs[i];
    if (arg == "-o" && i + 1 < rustcArgs.Length)
    {
        candidates.Add(rustcArgs[i + 1]);
    }
    else if (arg == "--out-dir" && i + 1 < rustcArgs.Length)
    {
        outDirs.Add(rustcArgs[i + 1]);
    }
    else if (arg == "--crate-name" && i + 1 < rustcArgs.Length)
    {
        crateName = rustcArgs[i + 1];
    }
    else if (arg.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
    {
        candidates.Add(arg);
    }
}

var toSign = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
foreach (var candidate in candidates)
{
    if (!Path.GetExtension(candidate).Equals(".exe", StringComparison.OrdinalIgnoreCase))
    {
        continue;
    }

    if (File.Exists(candidate))
    {
        toSign.Add(candidate);
    }

    var dir = Path.GetDirectoryName(candidate);
    if (!string.IsNullOrWhiteSpace(dir) && Directory.Exists(dir))
    {
        foreach (var exe in Directory.EnumerateFiles(dir, "*.exe", SearchOption.TopDirectoryOnly))
        {
            toSign.Add(exe);
        }
    }
}

if (string.Equals(crateName, "build_script_build", StringComparison.Ordinal))
{
    foreach (var outDir in outDirs)
    {
        if (!Directory.Exists(outDir))
        {
            continue;
        }

        foreach (var exe in Directory.EnumerateFiles(outDir, "*.exe", SearchOption.TopDirectoryOnly))
        {
            toSign.Add(exe);
        }
    }
}

var targetDir = Environment.GetEnvironmentVariable("CARGO_TARGET_DIR");
if (!string.IsNullOrWhiteSpace(targetDir))
{
    var buildDir = Path.Combine(targetDir, "release", "build");
    if (Directory.Exists(buildDir))
    {
        foreach (var exe in Directory.EnumerateFiles(buildDir, "*.exe", SearchOption.AllDirectories))
        {
            toSign.Add(exe);
        }
    }
}

if (toSign.Count == 0)
{
    return 0;
}

var signer = Path.Combine(AppContext.BaseDirectory, "rustc-sign-wrapper.ps1");
foreach (var batch in toSign.Chunk(20))
{
    var signStart = new ProcessStartInfo("powershell.exe")
    {
        UseShellExecute = false,
    };
    signStart.ArgumentList.Add("-NoProfile");
    signStart.ArgumentList.Add("-ExecutionPolicy");
    signStart.ArgumentList.Add("Bypass");
    signStart.ArgumentList.Add("-File");
    signStart.ArgumentList.Add(signer);
    foreach (var exe in batch)
    {
        signStart.ArgumentList.Add(exe);
    }

    using var signProcess = Process.Start(signStart);
    if (signProcess is null)
    {
        Console.Error.WriteLine("Failed to start PowerShell signer.");
        return 1;
    }

    signProcess.WaitForExit();
    if (signProcess.ExitCode != 0)
    {
        return signProcess.ExitCode;
    }
}

return 0;
