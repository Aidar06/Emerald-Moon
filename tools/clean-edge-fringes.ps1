param(
    [Parameter(Mandatory = $true)]
    [string]$InputDirectory,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assemblies = [AppDomain]::CurrentDomain.GetAssemblies() |
    ForEach-Object Location |
    Where-Object { $_ }

Add-Type -ReferencedAssemblies $assemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class EdgeFringeCleaner {
    private static bool IsFringeColor(int r, int g, int b) {
        bool red = r > 175 && g < 105 && b < 125;
        bool green = g > 175 && r < 115 && b < 120;
        bool yellow = r > 195 && g > 175 && b < 85;
        bool magenta = r > 165 && b > 145 && g < 115;
        return red || green || yellow || magenta;
    }

    public static Bitmap Clean(Bitmap source, bool softenGlow) {
        int width = source.Width;
        int height = source.Height;
        int count = width * height;
        var rect = new Rectangle(0, 0, width, height);
        var sourceData = source.LockBits(rect, ImageLockMode.ReadOnly, source.PixelFormat);
        byte[] sourceBytes;
        int sourceStride = Math.Abs(sourceData.Stride);
        int sourceBpp = Image.GetPixelFormatSize(source.PixelFormat) / 8;
        try {
            sourceBytes = new byte[sourceStride * height];
            Marshal.Copy(sourceData.Scan0, sourceBytes, 0, sourceBytes.Length);
        }
        finally {
            source.UnlockBits(sourceData);
        }

        byte[] blue = new byte[count];
        byte[] green = new byte[count];
        byte[] red = new byte[count];
        byte[] alpha = new byte[count];
        bool hasSourceAlpha = sourceBpp >= 4 && (source.PixelFormat & PixelFormat.Alpha) != 0;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int sourceIndex = y * sourceStride + x * sourceBpp;
                int index = y * width + x;
                int b = sourceBytes[sourceIndex];
                int g = sourceBytes[sourceIndex + 1];
                int r = sourceBytes[sourceIndex + 2];
                int a;
                if (hasSourceAlpha) {
                    a = sourceBytes[sourceIndex + 3];
                }
                else {
                    int max = Math.Max(r, Math.Max(g, b));
                    a = max <= 4 ? 0 : (int)Math.Round(255.0 * Math.Pow(max / 255.0, 0.72));
                }
                blue[index] = (byte)b;
                green[index] = (byte)g;
                red[index] = (byte)r;
                alpha[index] = (byte)Math.Max(0, Math.Min(255, a));
            }
        }

        const int infinity = 1 << 20;
        int[] distance = new int[count];
        for (int i = 0; i < count; i++) distance[i] = alpha[i] <= 4 ? 0 : infinity;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int i = y * width + x;
                if (distance[i] == 0) continue;
                int best = distance[i];
                if (x > 0) best = Math.Min(best, distance[i - 1] + 1);
                if (y > 0) best = Math.Min(best, distance[i - width] + 1);
                if (x > 0 && y > 0) best = Math.Min(best, distance[i - width - 1] + 1);
                if (x + 1 < width && y > 0) best = Math.Min(best, distance[i - width + 1] + 1);
                distance[i] = best;
            }
        }
        for (int y = height - 1; y >= 0; y--) {
            for (int x = width - 1; x >= 0; x--) {
                int i = y * width + x;
                if (distance[i] == 0) continue;
                int best = distance[i];
                if (x + 1 < width) best = Math.Min(best, distance[i + 1] + 1);
                if (y + 1 < height) best = Math.Min(best, distance[i + width] + 1);
                if (x + 1 < width && y + 1 < height) best = Math.Min(best, distance[i + width + 1] + 1);
                if (x > 0 && y + 1 < height) best = Math.Min(best, distance[i + width - 1] + 1);
                distance[i] = best;
            }
        }

        int[] nearest = new int[count];
        for (int i = 0; i < count; i++) nearest[i] = -1;
        int[] queue = new int[count];
        int queueHead = 0;
        int queueTail = 0;
        for (int i = 0; i < count; i++) {
            if (alpha[i] >= 180 && !IsFringeColor(red[i], green[i], blue[i])) {
                nearest[i] = i;
                queue[queueTail++] = i;
            }
        }
        while (queueHead < queueTail) {
            int i = queue[queueHead++];
            int x = i % width;
            int y = i / width;
            if (x > 0) queueTail = Propagate(i - 1, i, alpha, nearest, queue, queueTail);
            if (x + 1 < width) queueTail = Propagate(i + 1, i, alpha, nearest, queue, queueTail);
            if (y > 0) queueTail = Propagate(i - width, i, alpha, nearest, queue, queueTail);
            if (y + 1 < height) queueTail = Propagate(i + width, i, alpha, nearest, queue, queueTail);
        }

        for (int i = 0; i < count; i++) {
            if (alpha[i] == 0) continue;
            if (!softenGlow && nearest[i] >= 0 && distance[i] <= 5) {
                int n = nearest[i];
                red[i] = red[n];
                green[i] = green[n];
                blue[i] = blue[n];
            }
            if (distance[i] == 1) alpha[i] = (byte)Math.Min((int)alpha[i], 40);
            else if (distance[i] == 2) alpha[i] = (byte)Math.Min((int)alpha[i], 100);
            else if (distance[i] == 3) alpha[i] = (byte)Math.Min((int)alpha[i], 170);
            else if (distance[i] == 4) alpha[i] = (byte)Math.Min((int)alpha[i], 225);

            // Generated luminous objects often contain a broad, low-opacity matte.
            // Compressing only its alpha removes the polygonal halo boundary while
            // preserving the opaque object and its warm light.
            if (softenGlow && alpha[i] < 245) {
                double normalized = alpha[i] / 255.0;
                alpha[i] = (byte)Math.Max(0, Math.Min(255,
                    (int)Math.Round(255.0 * Math.Pow(normalized, 2.15))));
            }
        }

        var output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var outputData = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        try {
            int outputStride = Math.Abs(outputData.Stride);
            byte[] outputBytes = new byte[outputStride * height];
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int index = y * width + x;
                    int target = y * outputStride + x * 4;
                    outputBytes[target] = blue[index];
                    outputBytes[target + 1] = green[index];
                    outputBytes[target + 2] = red[index];
                    outputBytes[target + 3] = alpha[index];
                }
            }
            Marshal.Copy(outputBytes, 0, outputData.Scan0, outputBytes.Length);
        }
        finally {
            output.UnlockBits(outputData);
        }
        return output;
    }

    private static int Propagate(int target, int source, byte[] alpha, int[] nearest, int[] queue, int tail) {
        if (alpha[target] == 0 || nearest[target] >= 0) return tail;
        nearest[target] = nearest[source];
        queue[tail] = target;
        return tail + 1;
    }
}
'@

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
Get-ChildItem -LiteralPath $InputDirectory -Filter '*.png' | ForEach-Object {
    $source = [System.Drawing.Bitmap]::FromFile($_.FullName)
    try {
        $softenGlow = $_.Name -match '^decor-(01|02|07)-'
        $cleaned = [EdgeFringeCleaner]::Clean($source, $softenGlow)
        try {
            $destination = Join-Path $OutputDirectory $_.Name
            $cleaned.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
            Write-Output "Cleaned: $($_.Name)"
        }
        finally {
            $cleaned.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }
}
