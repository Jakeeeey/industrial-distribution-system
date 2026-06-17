param(
    [string]$FilePath,
    [string]$PrinterName = "POS-58",
    [string]$LogoPath = ""
)

try {
    if (-not (Test-Path $FilePath)) {
        throw "File not found: $FilePath"
    }

    # CRITICAL CHANGE: Read the file as raw bytes, not as a string.
    # This preserves all ESC/POS binary commands (like cut, align, bold).
    $contentBytes = [System.IO.File]::ReadAllBytes($FilePath)

    # Removed debug logging to print-debug.log to avoid file size bloat and improve raw print speed


    # PROCESS LOGO IF SPECIFIED
    $logoBytes = $null
    if ($LogoPath -and (Test-Path $LogoPath)) {
        try {
            Add-Type -AssemblyName System.Drawing
            $bmp = [System.Drawing.Bitmap]::new($LogoPath)
            
            # Target width in dots for POS-58 is typically 384. 260 is centered nicely.
            $TargetWidth = 260
            $aspectRatio = $bmp.Height / $bmp.Width
            $targetHeight = [int]($TargetWidth * $aspectRatio)
            
            # Resize bitmap
            $resized = [System.Drawing.Bitmap]::new($TargetWidth, $targetHeight)
            $g = [System.Drawing.Graphics]::FromImage($resized)
            $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $g.DrawImage($bmp, 0, 0, $TargetWidth, $targetHeight)
            $g.Dispose()
            $bmp.Dispose()
            
            # Pad width to multiple of 8
            $widthBytes = [Math]::Ceiling($TargetWidth / 8)
            $paddedWidth = $widthBytes * 8
            
            $xL = $widthBytes % 256
            $xH = [Math]::Floor($widthBytes / 256)
            $yL = $targetHeight % 256
            $yH = [Math]::Floor($targetHeight / 256)
            
            # ESC @ (Init), ESC a 1 (Center alignment), GS v 0 (Print raster graphic)
            $header = [byte[]](0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1D, 0x76, 0x30, 0x00, $xL, $xH, $yL, $yH)
            $data = [byte[]]::new($widthBytes * $targetHeight)
            
            for ($y = 0; $y -lt $targetHeight; $y++) {
                for ($x = 0; $x -lt $paddedWidth; $x++) {
                    $isBlack = $false
                    if ($x -lt $TargetWidth) {
                        $pixel = $resized.GetPixel($x, $y)
                        if ($pixel.A -ge 128) {
                            $luminance = (0.299 * $pixel.R) + (0.587 * $pixel.G) + (0.114 * $pixel.B)
                            $isBlack = ($luminance -lt 128)
                        }
                    }
                    if ($isBlack) {
                        $byteIndex = ($y * $widthBytes) + [Math]::Floor($x / 8)
                        $bitIndex = 7 - ($x % 8)
                        $data[$byteIndex] = $data[$byteIndex] -bor (1 -shl $bitIndex)
                    }
                }
            }
            $resized.Dispose()
            
            # Line Feed, ESC a 0 (Align left)
            $footer = [byte[]](0x0A, 0x1B, 0x61, 0x00)
            
            $logoBytes = [byte[]]::new($header.Length + $data.Length + $footer.Length)
            [System.Buffer]::BlockCopy($header, 0, $logoBytes, 0, $header.Length)
            [System.Buffer]::BlockCopy($data, 0, $logoBytes, $header.Length, $data.Length)
            [System.Buffer]::BlockCopy($footer, 0, $logoBytes, ($header.Length + $data.Length), $footer.Length)
            
            # Developer Comment: Replaced Out-File redirect with stdout message to avoid dependency on removed debug logPath
            Write-Output "Logo processed successfully. Target size: $TargetWidth x $targetHeight ($($logoBytes.Length) ESC/POS bytes)"
        }
        catch {
            # Developer Comment: Log converting errors to warnings standard stream to keep process transparent
            Write-Warning "Error converting logo: $_"
            $logoBytes = $null
        }
    }

    if ($null -ne $logoBytes) {
        $combinedBytes = [byte[]]::new($logoBytes.Length + $contentBytes.Length)
        [System.Buffer]::BlockCopy($logoBytes, 0, $combinedBytes, 0, $logoBytes.Length)
        [System.Buffer]::BlockCopy($contentBytes, 0, $combinedBytes, $logoBytes.Length, $contentBytes.Length)
        $contentBytes = $combinedBytes
    }

    # Verify if printer is installed on this local system
    $printer = Get-CimInstance -ClassName Win32_Printer -Filter "Name = '$PrinterName'"
    if ($null -eq $printer) {
        throw "Printer '$PrinterName' not found on this system. Please check if the printer is installed."
    }

    # Verify if printer is online/connected
    if ($printer.WorkOffline -eq $true) {
        throw "Printer '$PrinterName' is offline. Please check if it is turned on and connected."
    }

    # Define the C# class for Raw Printing (Modified for Byte Arrays)
    $code = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        public string pDocName;
        public string pOutputFile;
        public string pDatatype;
    }

    // CRITICAL CHANGE: Accept byte[] instead of string
    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "POS-58 Receipt Print";
        di.pDatatype = "RAW";

        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    
                    // Allocate unmanaged memory for the byte array
                    IntPtr unmanagedPointer = Marshal.AllocCoTaskMem(pBytes.Length);
                    Marshal.Copy(pBytes, 0, unmanagedPointer, pBytes.Length);
                    
                    int dwWritten = 0;
                    bool success = WritePrinter(hPrinter, unmanagedPointer, pBytes.Length, out dwWritten);
                    
                    // Free the unmanaged memory
                    Marshal.FreeCoTaskMem(unmanagedPointer);
                    
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return success;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@

    # Add the type definition to the PowerShell session
    Add-Type -TypeDefinition $code

    # Print using the raw printer helper
    $success = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $contentBytes)
    if (-not $success) {
        throw "Failed to spool raw bytes to printer '$PrinterName' via winspool API."
    }

    Write-Output "Successfully sent to printer $PrinterName."
}
catch {
    # Log errors too
    if ($null -ne $logPath) {
        "Error: $_" | Out-File -FilePath $logPath -Append
    }
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}