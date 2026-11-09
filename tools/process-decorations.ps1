param(
    [Parameter(Mandatory = $true)]
    [string]$Directory,

    [int]$MaxEdge = 900,

    [switch]$ChromaGreen,

    [switch]$ChromaMagenta
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$drawingAssemblies = [AppDomain]::CurrentDomain.GetAssemblies() |
    ForEach-Object Location |
    Where-Object { $_ }
Add-Type -ReferencedAssemblies $drawingAssemblies -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class BlackMatteRemoval {
    public static Bitmap Convert(Bitmap source, int maxEdge) {
        int width = source.Width;
        int height = source.Height;
        var output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, width, height);
        var inputData = source.LockBits(rect, ImageLockMode.ReadOnly, source.PixelFormat);
        try {
            var outputData = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try {
                int inputStride = Math.Abs(inputData.Stride);
                int outputStride = Math.Abs(outputData.Stride);
                int inputByteCount = inputStride * height;
                int outputByteCount = outputStride * height;
                int inputBpp = Image.GetPixelFormatSize(source.PixelFormat) / 8;
                byte[] input = new byte[inputByteCount];
                byte[] result = new byte[outputByteCount];
                Marshal.Copy(inputData.Scan0, input, 0, inputByteCount);

                for (int y = 0; y < height; y++) {
                    for (int x = 0; x < width; x++) {
                        int inputIndex = y * inputStride + x * inputBpp;
                        int outputIndex = y * outputStride + x * 4;
                        int b = input[inputIndex];
                        int g = input[inputIndex + 1];
                        int r = input[inputIndex + 2];
                        int max = Math.Max(r, Math.Max(g, b));
                        if (max <= 4) continue;

                        // Convert an image composited on black back to straight alpha.
                        // This preserves candle glow and soft translucent fabric edges.
                        double normalized = max / 255.0;
                        int alpha = (int)Math.Round(255.0 * Math.Pow(normalized, 0.72));
                        alpha = Math.Min(255, Math.Max(0, alpha));
                        if (alpha < 8) continue;
                        double factor = 255.0 / Math.Max(alpha, 1);
                        result[outputIndex] = (byte)Math.Min(255, Math.Round(b * factor));
                        result[outputIndex + 1] = (byte)Math.Min(255, Math.Round(g * factor));
                        result[outputIndex + 2] = (byte)Math.Min(255, Math.Round(r * factor));
                        result[outputIndex + 3] = (byte)alpha;
                    }
                }

                Marshal.Copy(result, 0, outputData.Scan0, outputByteCount);
            }
            finally {
                output.UnlockBits(outputData);
            }
        }
        finally {
            source.UnlockBits(inputData);
        }
        return output;
    }

    public static Bitmap ConvertGreen(Bitmap source) {
        int width = source.Width;
        int height = source.Height;
        var output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, width, height);
        var inputData = source.LockBits(rect, ImageLockMode.ReadOnly, source.PixelFormat);
        try {
            var outputData = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try {
                int inputStride = Math.Abs(inputData.Stride);
                int outputStride = Math.Abs(outputData.Stride);
                int inputBpp = Image.GetPixelFormatSize(source.PixelFormat) / 8;
                byte[] input = new byte[inputStride * height];
                byte[] result = new byte[outputStride * height];
                Marshal.Copy(inputData.Scan0, input, 0, input.Length);
                for (int y = 0; y < height; y++) {
                    for (int x = 0; x < width; x++) {
                        int i = y * inputStride + x * inputBpp;
                        int o = y * outputStride + x * 4;
                        int b = input[i], g = input[i + 1], r = input[i + 2];
                        int alpha = Math.Max(r, b);
                        if (alpha <= 7 || (g > 235 && r < 22 && b < 22)) continue;
                        double a = alpha / 255.0;
                        int foregroundR = (int)Math.Round(r / a);
                        int foregroundB = (int)Math.Round(b / a);
                        int foregroundG = (int)Math.Round((g - (1.0 - a) * 255.0) / a);
                        result[o] = (byte)Math.Min(255, Math.Max(0, foregroundB));
                        result[o + 1] = (byte)Math.Min(255, Math.Max(0, foregroundG));
                        result[o + 2] = (byte)Math.Min(255, Math.Max(0, foregroundR));
                        result[o + 3] = (byte)alpha;
                    }
                }
                Marshal.Copy(result, 0, outputData.Scan0, result.Length);
            }
            finally { output.UnlockBits(outputData); }
        }
        finally { source.UnlockBits(inputData); }
        return output;
    }

    public static Bitmap ConvertMagenta(Bitmap source) {
        int width = source.Width;
        int height = source.Height;
        var output = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, width, height);
        var inputData = source.LockBits(rect, ImageLockMode.ReadOnly, source.PixelFormat);
        try {
            var outputData = output.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try {
                int inputStride = Math.Abs(inputData.Stride);
                int outputStride = Math.Abs(outputData.Stride);
                int inputBpp = Image.GetPixelFormatSize(source.PixelFormat) / 8;
                byte[] input = new byte[inputStride * height];
                byte[] result = new byte[outputStride * height];
                Marshal.Copy(inputData.Scan0, input, 0, input.Length);
                for (int y = 0; y < height; y++) {
                    for (int x = 0; x < width; x++) {
                        int i = y * inputStride + x * inputBpp;
                        int o = y * outputStride + x * 4;
                        int b = input[i], g = input[i + 1], r = input[i + 2];
                        int keyDistance = Math.Max(g, Math.Max(255 - r, 255 - b));
                        double edge = Math.Max(0.0, Math.Min(1.0, (keyDistance - 8.0) / 90.0));
                        int alpha = (int)Math.Round(255.0 * edge * edge);
                        int magentaBias = Math.Min(r - g, b - g);
                        if (magentaBias > 12) {
                            double spillKeep = Math.Max(0.0, Math.Min(1.0, (72.0 - magentaBias) / 60.0));
                            alpha = (int)Math.Round(alpha * spillKeep);
                        }
                        if (alpha <= 4 || (r > 245 && b > 245 && g < 12)) continue;
                        result[o] = (byte)b;
                        result[o + 1] = (byte)g;
                        result[o + 2] = (byte)r;
                        result[o + 3] = (byte)alpha;
                    }
                }
                Marshal.Copy(result, 0, outputData.Scan0, result.Length);
            }
            finally { output.UnlockBits(outputData); }
        }
        finally { source.UnlockBits(inputData); }
        return output;
    }
}
'@

Get-ChildItem -LiteralPath $Directory -Filter '*.png' | ForEach-Object {
    $source = [System.Drawing.Bitmap]::FromFile($_.FullName)
    try {
        $processed = if ($ChromaGreen) {
            [BlackMatteRemoval]::ConvertGreen($source)
        }
        elseif ($ChromaMagenta) {
            [BlackMatteRemoval]::ConvertMagenta($source)
        }
        else {
            [BlackMatteRemoval]::Convert($source, $MaxEdge)
        }
        try {
            $temporary = "$($_.FullName).processed.png"
            $processed.Save($temporary, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $processed.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }

    Move-Item -LiteralPath $temporary -Destination $_.FullName -Force
    Write-Output "Processed: $($_.Name)"
}
