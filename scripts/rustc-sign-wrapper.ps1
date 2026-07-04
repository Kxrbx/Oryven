param(
    [string[]]$Paths
)

$ErrorActionPreference = "Continue"

function Get-LocalBuildCert {
    $subject = "CN=Oryven Local Build"
    $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
        Where-Object { $_.Subject -eq $subject } |
        Sort-Object NotAfter -Descending |
        Select-Object -First 1

    if (-not $cert) {
        $cert = New-SelfSignedCertificate `
            -Type CodeSigningCert `
            -Subject $subject `
            -CertStoreLocation Cert:\CurrentUser\My `
            -KeyUsage DigitalSignature `
            -KeyExportPolicy Exportable
    }

    return $cert
}

function Sign-IfNeeded {
    param([string]$Path)

    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) {
        return
    }

    try {
        $sig = Get-AuthenticodeSignature -LiteralPath $Path
        if ($sig.Status -ne "NotSigned") {
            return
        }

        $cert = Get-LocalBuildCert
        Set-AuthenticodeSignature -LiteralPath $Path -Certificate $cert | Out-Null
    } catch {
        Write-Warning ("Could not sign generated executable '{0}': {1}" -f $Path, $_.Exception.Message)
    }
}

foreach ($path in $Paths) {
    Sign-IfNeeded -Path $path
}

exit 0
