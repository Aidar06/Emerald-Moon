param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,

    [Parameter(Mandatory = $true)]
    [string]$RequestId,

    [Parameter(Mandatory = $true)]
    [string]$OutputVideo
)

$ErrorActionPreference = 'Stop'
$apiBase = 'https://api.higgsfield.ai'

$keyLine = Get-Content -LiteralPath $EnvPath | Where-Object {
    $_ -match '^\s*HIGGSFIELD_API_KEY\s*='
} | Select-Object -First 1

if (-not $keyLine) {
    throw 'HIGGSFIELD_API_KEY is missing.'
}

$apiKey = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
$authHeaders = @{ Authorization = "Key $apiKey" }
$statusUri = "$apiBase/requests/$RequestId/status"
$terminalStates = @('completed', 'failed', 'nsfw', 'canceled')

do {
    $status = Invoke-RestMethod -Method Get -Uri $statusUri -Headers $authHeaders
    Write-Output "Status: $($status.status)"
    if ($terminalStates -notcontains $status.status) {
        Start-Sleep -Seconds 8
    }
} while ($terminalStates -notcontains $status.status)

if ($status.status -ne 'completed') {
    $detail = if ($status.error) {
        $status.error | ConvertTo-Json -Compress -Depth 5
    } else {
        'No error details returned.'
    }
    throw "Generation ended with status '$($status.status)'. $detail"
}

$videoUrl = $status.video.url
if (-not $videoUrl -and $status.output.video.url) {
    $videoUrl = $status.output.video.url
}
if (-not $videoUrl) {
    throw 'Completed generation did not return a video URL.'
}

$outputDirectory = Split-Path -Parent $OutputVideo
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

Write-Output 'Downloading generated video...'
Invoke-WebRequest -Uri $videoUrl -OutFile $OutputVideo -UseBasicParsing
$video = Get-Item -LiteralPath $OutputVideo
Write-Output "Saved: $($video.FullName)"
Write-Output "Bytes: $($video.Length)"
