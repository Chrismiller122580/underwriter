# Load required assemblies with error handling and logging
$assemblies = @(
    "DnsClient.dll",
    "Microsoft.Extensions.Logging.Abstractions.dll",
    "MongoDB.Bson.dll",
    "MongoDB.Driver.Core.dll",
    "MongoDB.Driver.dll",
    "SharpCompress.dll",
    "System.Memory.dll"
)

foreach ($assembly in $assemblies) {
    try {
        Add-Type -Path (Join-Path -Path $PSScriptRoot -ChildPath $assembly)
        Write-Output "Successfully loaded $assembly"
    } catch {
        Write-Output "Failed to load $assembly: $_"
    }
}
