param(
    [Parameter(Mandatory = $true)]
    [string]$EnvPath,

    [Parameter(Mandatory = $true)]
    [string]$InputImage,

    [Parameter(Mandatory = $true)]
    [string]$OutputVideo
)

$ErrorActionPreference = 'Stop'
$apiBase = 'https://api.higgsfield.ai'

if (-not (Test-Path -LiteralPath $EnvPath)) {
    throw "Environment file not found."
}

if (-not (Test-Path -LiteralPath $InputImage)) {
    throw "Input image not found."
}

$keyLine = Get-Content -LiteralPath $EnvPath | Where-Object {
    $_ -match '^\s*HIGGSFIELD_API_KEY\s*='
} | Select-Object -First 1

if (-not $keyLine) {
    throw "HIGGSFIELD_API_KEY is missing."
}

$apiKey = ($keyLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    throw "HIGGSFIELD_API_KEY is empty."
}

$authHeaders = @{ Authorization = "Key $apiKey" }

Write-Output 'Requesting secure image upload...'
$uploadTicket = Invoke-RestMethod `
    -Method Post `
    -Uri "$apiBase/files/generate-upload-url" `
    -Headers $authHeaders `
    -ContentType 'application/json' `
    -Body '{"content_type":"image/png"}'

$uploadHeaders = @{}
if ($uploadTicket.upload_headers) {
    foreach ($property in $uploadTicket.upload_headers.PSObject.Properties) {
        $uploadHeaders[$property.Name] = [string]$property.Value
    }
}

Write-Output 'Uploading source image...'
Invoke-WebRequest `
    -Method Put `
    -Uri $uploadTicket.upload_url `
    -Headers $uploadHeaders `
    -ContentType 'image/png' `
    -InFile $InputImage `
    -UseBasicParsing | Out-Null

$prompt = @'
Create a perfectly seamless luxury moonlit wedding garden background loop from this exact still image. The camera is completely locked off with zero zoom, pan, tilt, crop change, or parallax. Preserve the moon, pavilion, bridge, marble terrace, white rose arrangements, lantern placement, trees, water, composition, colors, and all proportions exactly. Animate only subtle natural details: clouds drift almost imperceptibly around the moon, a few leaves and white blossoms sway gently in a light night breeze, candle and hanging-lantern flames flicker softly, sparse fireflies twinkle, and the warm gold reflections ripple very slowly on the water and polished marble. Motion must be elegant, calm, minimal, photorealistic, and suitable behind readable website content. The last frame must match the first frame exactly for an invisible infinite loop. No new objects, no falling petals, no people, no text, no architecture changes, no morphing, no warping, no exposure jumps, no camera motion.
'@

$payload = @{
    image_url = $uploadTicket.public_url
    end_image_url = $uploadTicket.public_url
    prompt = $prompt
    duration = 5
    resolution = '720p'
} | ConvertTo-Json -Depth 4

Write-Output 'Starting Higgsfield animation...'
$submission = Invoke-RestMethod `
    -Method Post `
    -Uri "$apiBase/kling-video/v4.0/image-to-video" `
    -Headers $authHeaders `
    -ContentType 'application/json' `
    -Body $payload

if (-not $submission.request_id) {
    throw "Generation did not return a request ID."
}

Write-Output "Generation queued: $($submission.request_id)"
$statusUri = if ($submission.status_url) {
    $submission.status_url
} else {
    "$apiBase/requests/$($submission.request_id)/status"
}

$terminalStates = @('completed', 'failed', 'nsfw', 'canceled')
do {
    Start-Sleep -Seconds 8
    $status = Invoke-RestMethod -Method Get -Uri $statusUri -Headers $authHeaders
    Write-Output "Status: $($status.status)"
} while ($terminalStates -notcontains $status.status)

if ($status.status -ne 'completed') {
    $detail = if ($status.error) { $status.error | ConvertTo-Json -Compress -Depth 5 } else { 'No error details returned.' }
    throw "Generation ended with status '$($status.status)'. $detail"
}

$videoUrl = $status.video.url
if (-not $videoUrl -and $status.output.video.url) {
    $videoUrl = $status.output.video.url
}
if (-not $videoUrl) {
    throw "Completed generation did not return a video URL."
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
