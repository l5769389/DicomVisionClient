using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Windows.Forms;

[assembly: AssemblyTitle("DicomVisionShellExtension")]
[assembly: AssemblyDescription("Windows shell preview and thumbnail handler for DICOM files")]
[assembly: AssemblyCompany("DicomVision")]
[assembly: AssemblyProduct("DicomVision")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: ComVisible(false)]

namespace DicomVision.ShellExtension
{
    internal static class ShellIds
    {
        public const string HandlerClsid = "6F5351BB-0C26-45B5-94C5-B5C90FAE55DC";
        public const string PreviewHandlerCategory = "{8895b1c6-b41f-4c1c-a562-0d564250836f}";
        public const string ThumbnailProviderCategory = "{e357fccd-a995-4576-b01f-234630154e96}";
        public const string ProgId = "DicomVision.DICOM";
        public const string HandlerName = "DicomVision DICOM Preview Handler";
    }

    [ComVisible(true)]
    [Guid(ShellIds.HandlerClsid)]
    [ProgId("DicomVision.DicomShellHandler")]
    [ClassInterface(ClassInterfaceType.None)]
    public sealed class DicomShellHandler : IPreviewHandler, IOleWindow, IInitializeWithStream, IInitializeWithFile, IThumbnailProvider, IObjectWithSite
    {
        private byte[] _content;
        private string _filePath;
        private IntPtr _parentHwnd = IntPtr.Zero;
        private NativeMethods.RECT _previewRect;
        private PreviewControl _previewControl;
        private object _site;
        private string _initializationError;

        public int Initialize(IStream stream, uint grfMode)
        {
            try
            {
                _content = StreamReader.ReadAllBytes(stream);
                _filePath = null;
                _initializationError = null;
                return NativeMethods.S_OK;
            }
            catch (Exception ex)
            {
                _content = null;
                _filePath = null;
                _initializationError = ex.Message;
                ShellPreviewLog.Write("IInitializeWithStream failed: " + ex);
                return NativeMethods.S_OK;
            }
        }

        public int Initialize(string filePath, uint grfMode)
        {
            _filePath = filePath;
            _content = null;
            _initializationError = null;
            return NativeMethods.S_OK;
        }

        public int SetWindow(IntPtr hwnd, ref NativeMethods.RECT rect)
        {
            _parentHwnd = hwnd;
            _previewRect = rect;
            PositionPreviewControl();
            return NativeMethods.S_OK;
        }

        public int SetRect(ref NativeMethods.RECT rect)
        {
            _previewRect = rect;
            PositionPreviewControl();
            return NativeMethods.S_OK;
        }

        public int DoPreview()
        {
            try
            {
                var result = ResolveRenderResult();
                ReplacePreviewControl(result);
            }
            catch (Exception ex)
            {
                ShellPreviewLog.Write("DoPreview failed: " + ex);
                try
                {
                    ReplacePreviewControl(DicomRenderer.RenderError("Preview handler failed: " + ex.Message));
                }
                catch
                {
                    return NativeMethods.E_FAIL;
                }
            }
            return NativeMethods.S_OK;
        }

        public int Unload()
        {
            if (_previewControl != null)
            {
                _previewControl.Dispose();
                _previewControl = null;
            }
            _content = null;
            _filePath = null;
            _initializationError = null;
            return NativeMethods.S_OK;
        }

        public int SetFocus()
        {
            if (_previewControl != null)
            {
                _previewControl.Focus();
            }
            return NativeMethods.S_OK;
        }

        public int GetWindow(out IntPtr phwnd)
        {
            phwnd = _previewControl != null && !_previewControl.IsDisposed
                ? _previewControl.Handle
                : _parentHwnd;
            return phwnd == IntPtr.Zero ? NativeMethods.E_FAIL : NativeMethods.S_OK;
        }

        public int ContextSensitiveHelp(bool enterMode)
        {
            return NativeMethods.E_NOTIMPL;
        }

        public int QueryFocus(out IntPtr phwnd)
        {
            phwnd = NativeMethods.GetFocus();
            return phwnd == IntPtr.Zero ? NativeMethods.E_FAIL : NativeMethods.S_OK;
        }

        public int TranslateAccelerator(ref NativeMethods.MSG pmsg)
        {
            return NativeMethods.S_FALSE;
        }

        public int GetThumbnail(uint cx, out IntPtr hBitmap, out WTS_ALPHATYPE bitmapType)
        {
            hBitmap = IntPtr.Zero;
            bitmapType = WTS_ALPHATYPE.WTSAT_RGB;

            try
            {
                using (var image = DicomRenderer.Render(ResolveContent()).CreateThumbnail((int)Math.Max(32, cx)))
                {
                    hBitmap = image.GetHbitmap();
                }
                return hBitmap == IntPtr.Zero ? NativeMethods.E_FAIL : NativeMethods.S_OK;
            }
            catch
            {
                return NativeMethods.E_FAIL;
            }
        }

        public int SetSite(object site)
        {
            _site = site;
            return NativeMethods.S_OK;
        }

        public int GetSite(ref Guid riid, out IntPtr ppvSite)
        {
            ppvSite = IntPtr.Zero;
            if (_site == null)
            {
                return NativeMethods.E_FAIL;
            }

            IntPtr unknown = Marshal.GetIUnknownForObject(_site);
            try
            {
                return Marshal.QueryInterface(unknown, ref riid, out ppvSite);
            }
            finally
            {
                Marshal.Release(unknown);
            }
        }

        private byte[] ResolveContent()
        {
            if (!string.IsNullOrWhiteSpace(_initializationError))
            {
                throw new InvalidOperationException(_initializationError);
            }

            if (_content != null)
            {
                return _content;
            }

            if (string.IsNullOrWhiteSpace(_filePath))
            {
                throw new InvalidOperationException("No DICOM file was provided.");
            }

            return File.ReadAllBytes(_filePath);
        }

        private RenderResult ResolveRenderResult()
        {
            try
            {
                return DicomRenderer.Render(ResolveContent());
            }
            catch (Exception ex)
            {
                ShellPreviewLog.Write("ResolveRenderResult failed: " + ex);
                return DicomRenderer.RenderError(ex.Message);
            }
        }

        private void ReplacePreviewControl(RenderResult result)
        {
            if (_previewControl != null)
            {
                _previewControl.Dispose();
            }

            _previewControl = new PreviewControl(result);
            _previewControl.CreateControl();
            NativeMethods.SetWindowLongPtr(
                _previewControl.Handle,
                NativeMethods.GWL_STYLE,
                new IntPtr(NativeMethods.WS_CHILD | NativeMethods.WS_VISIBLE | NativeMethods.WS_CLIPSIBLINGS)
            );
            AttachPreviewControl();
            PositionPreviewControl();
            _previewControl.Show();
        }

        private void AttachPreviewControl()
        {
            if (_parentHwnd == IntPtr.Zero || _previewControl == null || _previewControl.IsDisposed || _previewControl.Handle == IntPtr.Zero)
            {
                return;
            }

            NativeMethods.SetParent(_previewControl.Handle, _parentHwnd);
        }

        private void PositionPreviewControl()
        {
            if (_previewControl == null || _previewControl.IsDisposed || _previewControl.Handle == IntPtr.Zero)
            {
                return;
            }

            AttachPreviewControl();
            NativeMethods.SetWindowPos(
                _previewControl.Handle,
                IntPtr.Zero,
                _previewRect.Left,
                _previewRect.Top,
                Math.Max(0, _previewRect.Right - _previewRect.Left),
                Math.Max(0, _previewRect.Bottom - _previewRect.Top),
                NativeMethods.SWP_NOZORDER | NativeMethods.SWP_NOACTIVATE
            );
        }

        [ComRegisterFunction]
        public static void Register(Type type)
        {
            RegistryWriter.Register(type.Assembly.Location);
        }

        [ComUnregisterFunction]
        public static void Unregister(Type type)
        {
            RegistryWriter.Unregister();
        }
    }

    [ComImport]
    [Guid("b824b49d-22ac-4161-ac8a-9916e8fa3f7f")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IInitializeWithStream
    {
        [PreserveSig]
        int Initialize(IStream stream, uint grfMode);
    }

    [ComImport]
    [Guid("b7d14566-0509-4cce-a71f-0a554233bd9b")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IInitializeWithFile
    {
        [PreserveSig]
        int Initialize([MarshalAs(UnmanagedType.LPWStr)] string filePath, uint grfMode);
    }

    [ComImport]
    [Guid("8895b1c6-b41f-4c1c-a562-0d564250836f")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPreviewHandler
    {
        [PreserveSig]
        int SetWindow(IntPtr hwnd, ref NativeMethods.RECT rect);
        [PreserveSig]
        int SetRect(ref NativeMethods.RECT rect);
        [PreserveSig]
        int DoPreview();
        [PreserveSig]
        int Unload();
        [PreserveSig]
        int SetFocus();
        [PreserveSig]
        int QueryFocus(out IntPtr phwnd);
        [PreserveSig]
        int TranslateAccelerator(ref NativeMethods.MSG pmsg);
    }

    [ComImport]
    [Guid("00000114-0000-0000-C000-000000000046")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IOleWindow
    {
        [PreserveSig]
        int GetWindow(out IntPtr phwnd);
        [PreserveSig]
        int ContextSensitiveHelp([MarshalAs(UnmanagedType.Bool)] bool enterMode);
    }

    [ComImport]
    [Guid("e357fccd-a995-4576-b01f-234630154e96")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IThumbnailProvider
    {
        [PreserveSig]
        int GetThumbnail(uint cx, out IntPtr hBitmap, out WTS_ALPHATYPE bitmapType);
    }

    [ComImport]
    [Guid("fc4801a3-2ba9-11cf-a229-00aa003d7352")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IObjectWithSite
    {
        [PreserveSig]
        int SetSite([MarshalAs(UnmanagedType.IUnknown)] object site);
        [PreserveSig]
        int GetSite(ref Guid riid, out IntPtr ppvSite);
    }

    public enum WTS_ALPHATYPE
    {
        WTSAT_UNKNOWN = 0,
        WTSAT_RGB = 1,
        WTSAT_ARGB = 2
    }

    internal static class StreamReader
    {
        public static byte[] ReadAllBytes(IStream stream)
        {
            TrySeekStart(stream);

            long size = TryResolveStreamSize(stream);
            if (size > 0 && size <= int.MaxValue)
            {
                return ReadKnownLength(stream, (int)size);
            }

            return ReadUntilEnd(stream);
        }

        private static long TryResolveStreamSize(IStream stream)
        {
            try
            {
                System.Runtime.InteropServices.ComTypes.STATSTG stat;
                stream.Stat(out stat, 1);
                return stat.cbSize;
            }
            catch
            {
                return 0;
            }
        }

        private static void TrySeekStart(IStream stream)
        {
            try
            {
                stream.Seek(0, 0, IntPtr.Zero);
            }
            catch
            {
            }
        }

        private static byte[] ReadKnownLength(IStream stream, int size)
        {
            var bytes = new byte[size];
            int offset = 0;
            while (offset < size)
            {
                int read = ReadChunk(stream, bytes, offset, size - offset);
                if (read <= 0)
                {
                    break;
                }
                offset += read;
            }

            if (offset == size)
            {
                return bytes;
            }

            var resized = new byte[offset];
            Buffer.BlockCopy(bytes, 0, resized, 0, offset);
            return resized;
        }

        private static byte[] ReadUntilEnd(IStream stream)
        {
            const int ChunkSize = 65536;
            using (var output = new MemoryStream())
            {
                var buffer = new byte[ChunkSize];
                while (true)
                {
                    int read = ReadChunk(stream, buffer, 0, buffer.Length);
                    if (read <= 0)
                    {
                        break;
                    }
                    output.Write(buffer, 0, read);
                    if (read < buffer.Length)
                    {
                        break;
                    }
                }
                return output.ToArray();
            }
        }

        private static int ReadChunk(IStream stream, byte[] buffer, int offset, int count)
        {
            var chunk = offset == 0 && count == buffer.Length ? buffer : new byte[count];
            IntPtr readPtr = Marshal.AllocHGlobal(sizeof(int));
            try
            {
                Marshal.WriteInt32(readPtr, 0);
                stream.Read(chunk, count, readPtr);
                int read = Marshal.ReadInt32(readPtr);
                if (read > 0 && !ReferenceEquals(chunk, buffer))
                {
                    Buffer.BlockCopy(chunk, 0, buffer, offset, read);
                }
                return read;
            }
            finally
            {
                Marshal.FreeHGlobal(readPtr);
            }
        }
    }

    internal static class ShellPreviewLog
    {
        public static void Write(string message)
        {
            try
            {
                string logDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "DicomVision", "logs");
                Directory.CreateDirectory(logDir);
                string logPath = Path.Combine(logDir, "shell-preview.log");
                File.AppendAllText(logPath, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff") + " | " + message + Environment.NewLine, Encoding.UTF8);
            }
            catch
            {
            }
        }
    }

    internal sealed class PreviewControl : UserControl
    {
        private readonly RenderResult _result;

        public PreviewControl(RenderResult result)
        {
            _result = result;
            BackColor = Color.Black;
            DoubleBuffered = true;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.Clear(Color.Black);
            e.Graphics.SmoothingMode = SmoothingMode.HighQuality;
            e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            e.Graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;

            if (_result.Image != null)
            {
                var imageRect = FitRect(_result.Image.Width, _result.Image.Height, ClientRectangle, 18, 58);
                e.Graphics.DrawImage(_result.Image, imageRect);
            }

            using (var titleBrush = new SolidBrush(Color.FromArgb(255, 255, 178, 0)))
            using (var bodyBrush = new SolidBrush(Color.FromArgb(220, 255, 214, 89)))
            using (var titleFont = new Font("Segoe UI", 10f, FontStyle.Bold))
            using (var bodyFont = new Font("Segoe UI", 9f, FontStyle.Regular))
            {
                var y = 10f;
                foreach (var line in _result.MetadataLines.Take(5))
                {
                    var size = e.Graphics.MeasureString(line, line == _result.MetadataLines.FirstOrDefault() ? titleFont : bodyFont);
                    e.Graphics.DrawString(
                        line,
                        line == _result.MetadataLines.FirstOrDefault() ? titleFont : bodyFont,
                        line == _result.MetadataLines.FirstOrDefault() ? titleBrush : bodyBrush,
                        Math.Max(10f, ClientSize.Width - size.Width - 12f),
                        y
                    );
                    y += size.Height + 1f;
                }

                e.Graphics.DrawString("DicomVision DICOM Preview", bodyFont, titleBrush, 12f, Math.Max(8f, ClientSize.Height - 28f));
            }
        }

        private static Rectangle FitRect(int imageWidth, int imageHeight, Rectangle bounds, int margin, int topReserved)
        {
            int availableWidth = Math.Max(1, bounds.Width - margin * 2);
            int availableHeight = Math.Max(1, bounds.Height - topReserved - margin * 2);
            double scale = Math.Min((double)availableWidth / imageWidth, (double)availableHeight / imageHeight);
            int width = Math.Max(1, (int)Math.Round(imageWidth * scale));
            int height = Math.Max(1, (int)Math.Round(imageHeight * scale));
            int x = bounds.Left + (bounds.Width - width) / 2;
            int y = bounds.Top + topReserved + (availableHeight - height) / 2;
            return new Rectangle(x, y, width, height);
        }
    }

    internal sealed class RenderResult
    {
        public RenderResult(Bitmap image, IReadOnlyList<string> metadataLines)
        {
            Image = image;
            MetadataLines = metadataLines;
        }

        public Bitmap Image { get; private set; }
        public IReadOnlyList<string> MetadataLines { get; private set; }

        public Bitmap CreateThumbnail(int size)
        {
            var bitmap = new Bitmap(size, size, PixelFormat.Format24bppRgb);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Black);
                graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                graphics.SmoothingMode = SmoothingMode.HighQuality;
                if (Image != null)
                {
                    double scale = Math.Min((double)(size - 8) / Image.Width, (double)(size - 8) / Image.Height);
                    int width = Math.Max(1, (int)Math.Round(Image.Width * scale));
                    int height = Math.Max(1, (int)Math.Round(Image.Height * scale));
                    graphics.DrawImage(Image, new Rectangle((size - width) / 2, (size - height) / 2, width, height));
                }
            }
            return bitmap;
        }
    }

    internal static class DicomRenderer
    {
        public static RenderResult Render(byte[] content)
        {
            try
            {
                var dataset = DicomParser.Parse(content);
                var bitmap = dataset.RenderBitmap();
                return new RenderResult(bitmap, dataset.BuildMetadataLines());
            }
            catch (Exception ex)
            {
                return RenderError(ex.Message);
            }
        }

        public static RenderResult RenderError(string message)
        {
            return new RenderResult(RenderErrorBitmap(message), new[] { "DICOM preview unavailable", message });
        }

        private static Bitmap RenderErrorBitmap(string message)
        {
            var bitmap = new Bitmap(512, 512, PixelFormat.Format24bppRgb);
            using (var graphics = Graphics.FromImage(bitmap))
            using (var titleFont = new Font("Segoe UI", 18f, FontStyle.Bold))
            using (var bodyFont = new Font("Segoe UI", 10f, FontStyle.Regular))
            using (var titleBrush = new SolidBrush(Color.FromArgb(255, 255, 178, 0)))
            using (var bodyBrush = new SolidBrush(Color.Gainsboro))
            {
                graphics.Clear(Color.Black);
                graphics.DrawString("DICOM preview unavailable", titleFont, titleBrush, new RectangleF(28, 180, 456, 60));
                graphics.DrawString(message, bodyFont, bodyBrush, new RectangleF(28, 250, 456, 120));
            }
            return bitmap;
        }
    }

    internal sealed class DicomDataset
    {
        public DicomDataset()
        {
            SamplesPerPixel = 1;
            PhotometricInterpretation = "MONOCHROME2";
            BitsAllocated = 16;
            BitsStored = 16;
            RescaleSlope = 1.0;
        }

        public int Rows { get; set; }
        public int Columns { get; set; }
        public int SamplesPerPixel { get; set; }
        public string PhotometricInterpretation { get; set; }
        public int BitsAllocated { get; set; }
        public int BitsStored { get; set; }
        public int PixelRepresentation { get; set; }
        public double RescaleSlope { get; set; }
        public double RescaleIntercept { get; set; }
        public double? WindowCenter { get; set; }
        public double? WindowWidth { get; set; }
        public string PatientName { get; set; }
        public string PatientId { get; set; }
        public string StudyDate { get; set; }
        public string InstanceNumber { get; set; }
        public byte[] PixelData { get; set; }
        public bool BigEndian { get; set; }

        public Bitmap RenderBitmap()
        {
            if (Rows <= 0 || Columns <= 0 || PixelData == null || PixelData.Length == 0)
            {
                throw new InvalidDataException("DICOM file does not contain renderable pixel data.");
            }

            if (SamplesPerPixel >= 3 && BitsAllocated == 8)
            {
                return RenderRgbBitmap();
            }

            return RenderGrayscaleBitmap();
        }

        public IReadOnlyList<string> BuildMetadataLines()
        {
            var lines = new List<string>();
            AddIfPresent(lines, PatientName == null ? null : PatientName.Replace('^', ' '));
            AddIfPresent(lines, PatientId);
            AddIfPresent(lines, InstanceNumber);
            AddIfPresent(lines, StudyDate);
            lines.Add(string.Format("{0} x {1}", Columns, Rows));
            return lines;
        }

        private Bitmap RenderGrayscaleBitmap()
        {
            double[] values = DecodeMonoPixels();
            double low;
            double high;
            if (WindowCenter.HasValue && WindowWidth.HasValue && WindowWidth.Value > 0)
            {
                low = WindowCenter.Value - WindowWidth.Value / 2.0;
                high = WindowCenter.Value + WindowWidth.Value / 2.0;
            }
            else
            {
                ResolvePercentileWindow(values, out low, out high);
            }

            double scale = high - low;
            if (scale <= 0)
            {
                scale = 1.0;
            }

            bool inverse = string.Equals(PhotometricInterpretation, "MONOCHROME1", StringComparison.OrdinalIgnoreCase);
            var bitmap = new Bitmap(Columns, Rows, PixelFormat.Format24bppRgb);
            for (int y = 0; y < Rows; y++)
            {
                for (int x = 0; x < Columns; x++)
                {
                    double clipped = Math.Max(low, Math.Min(high, values[y * Columns + x]));
                    int gray = (int)Math.Round((clipped - low) * 255.0 / scale);
                    gray = Math.Max(0, Math.Min(255, inverse ? 255 - gray : gray));
                    bitmap.SetPixel(x, y, Color.FromArgb(gray, gray, gray));
                }
            }
            return bitmap;
        }

        private Bitmap RenderRgbBitmap()
        {
            var bitmap = new Bitmap(Columns, Rows, PixelFormat.Format24bppRgb);
            int expected = Rows * Columns * SamplesPerPixel;
            if (PixelData.Length < expected)
            {
                throw new InvalidDataException("DICOM RGB pixel data is truncated.");
            }

            int index = 0;
            for (int y = 0; y < Rows; y++)
            {
                for (int x = 0; x < Columns; x++)
                {
                    byte r = PixelData[index++];
                    byte g = PixelData[index++];
                    byte b = PixelData[index++];
                    if (SamplesPerPixel > 3)
                    {
                        index += SamplesPerPixel - 3;
                    }
                    bitmap.SetPixel(x, y, Color.FromArgb(r, g, b));
                }
            }
            return bitmap;
        }

        private double[] DecodeMonoPixels()
        {
            int pixelCount = Rows * Columns;
            var values = new double[pixelCount];
            if (BitsAllocated == 8)
            {
                for (int i = 0; i < pixelCount && i < PixelData.Length; i++)
                {
                    values[i] = PixelData[i] * RescaleSlope + RescaleIntercept;
                }
                return values;
            }

            if (BitsAllocated != 16)
            {
                throw new InvalidDataException(string.Format("Unsupported DICOM bit depth: {0}.", BitsAllocated));
            }

            int byteCount = Math.Min(pixelCount * 2, PixelData.Length);
            for (int i = 0, offset = 0; offset + 1 < byteCount; i++, offset += 2)
            {
                ushort raw = BigEndian
                    ? (ushort)((PixelData[offset] << 8) | PixelData[offset + 1])
                    : (ushort)(PixelData[offset] | (PixelData[offset + 1] << 8));
                int value = PixelRepresentation == 0 ? raw : SignExtend(raw, BitsStored);
                values[i] = value * RescaleSlope + RescaleIntercept;
            }
            return values;
        }

        private static int SignExtend(ushort raw, int bitsStored)
        {
            if (bitsStored <= 0 || bitsStored >= 16)
            {
                return unchecked((short)raw);
            }

            int signBit = 1 << (bitsStored - 1);
            int mask = (1 << bitsStored) - 1;
            int value = raw & mask;
            return (value & signBit) != 0 ? value | ~mask : value;
        }

        private static void ResolvePercentileWindow(double[] values, out double low, out double high)
        {
            var finite = values.Where(value => !double.IsNaN(value) && !double.IsInfinity(value)).OrderBy(value => value).ToArray();
            if (finite.Length == 0)
            {
                low = 0;
                high = 1;
                return;
            }

            low = finite[Math.Max(0, (int)Math.Floor((finite.Length - 1) * 0.01))];
            high = finite[Math.Min(finite.Length - 1, (int)Math.Ceiling((finite.Length - 1) * 0.99))];
            if (high <= low)
            {
                low = finite.First();
                high = finite.Last();
            }
            if (high <= low)
            {
                high = low + 1;
            }
        }

        private static void AddIfPresent(List<string> lines, string value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                lines.Add(value.Trim());
            }
        }
    }

    internal static class DicomParser
    {
        private static readonly HashSet<string> LongVr = new HashSet<string> { "OB", "OD", "OF", "OL", "OV", "OW", "SQ", "UC", "UN", "UR", "UT" };

        public static DicomDataset Parse(byte[] bytes)
        {
            var dataset = new DicomDataset();
            int position = HasPreamble(bytes) ? 132 : 0;
            string transferSyntax = ParseMeta(bytes, ref position);
            bool explicitVr = transferSyntax != "1.2.840.10008.1.2";
            bool bigEndian = transferSyntax == "1.2.840.10008.1.2.2";
            dataset.BigEndian = bigEndian;

            if (transferSyntax.StartsWith("1.2.840.10008.1.2.4.", StringComparison.Ordinal) ||
                transferSyntax.StartsWith("1.2.840.10008.1.2.5", StringComparison.Ordinal))
            {
                throw new InvalidDataException("Compressed DICOM transfer syntax is not supported by the shell preview handler.");
            }

            while (position + 8 <= bytes.Length)
            {
                var element = ReadElement(bytes, ref position, explicitVr, bigEndian);
                if (element.Length == uint.MaxValue)
                {
                    SkipUndefinedLength(bytes, ref position, bigEndian);
                    continue;
                }

                if (position + element.Length > bytes.Length)
                {
                    break;
                }

                byte[] value = new byte[element.Length];
                Buffer.BlockCopy(bytes, position, value, 0, (int)element.Length);
                position += (int)element.Length;
                ApplyElement(dataset, element.Group, element.Element, element.Vr, value, bigEndian);
                if (element.Group == 0x7FE0 && element.Element == 0x0010)
                {
                    break;
                }
            }

            return dataset;
        }

        private static bool HasPreamble(byte[] bytes)
        {
            return bytes.Length > 132 &&
                bytes[128] == (byte)'D' &&
                bytes[129] == (byte)'I' &&
                bytes[130] == (byte)'C' &&
                bytes[131] == (byte)'M';
        }

        private static string ParseMeta(byte[] bytes, ref int position)
        {
            string transferSyntax = "1.2.840.10008.1.2.1";
            int cursor = position;
            while (cursor + 8 <= bytes.Length)
            {
                int before = cursor;
                var element = ReadElement(bytes, ref cursor, true, false);
                if (element.Group != 0x0002)
                {
                    cursor = before;
                    break;
                }
                if (cursor + element.Length > bytes.Length)
                {
                    break;
                }
                byte[] value = new byte[element.Length];
                Buffer.BlockCopy(bytes, cursor, value, 0, (int)element.Length);
                cursor += (int)element.Length;
                if (element.Element == 0x0010)
                {
                    transferSyntax = ReadString(value);
                }
            }
            position = cursor;
            return transferSyntax.Trim('\0', ' ');
        }

        private static DicomElement ReadElement(byte[] bytes, ref int position, bool explicitVr, bool bigEndian)
        {
            ushort group = ReadUInt16(bytes, position, bigEndian);
            ushort element = ReadUInt16(bytes, position + 2, bigEndian);
            position += 4;

            string vr = "";
            uint length;
            if (explicitVr)
            {
                vr = Encoding.ASCII.GetString(bytes, position, 2);
                position += 2;
                if (LongVr.Contains(vr))
                {
                    position += 2;
                    length = ReadUInt32(bytes, position, bigEndian);
                    position += 4;
                }
                else
                {
                    length = ReadUInt16(bytes, position, bigEndian);
                    position += 2;
                }
            }
            else
            {
                length = ReadUInt32(bytes, position, bigEndian);
                position += 4;
            }

            return new DicomElement(group, element, vr, length);
        }

        private static void ApplyElement(DicomDataset dataset, ushort group, ushort element, string vr, byte[] value, bool bigEndian)
        {
            if (group == 0x0010 && element == 0x0010) dataset.PatientName = ReadString(value);
            else if (group == 0x0010 && element == 0x0020) dataset.PatientId = ReadString(value);
            else if (group == 0x0008 && element == 0x0020) dataset.StudyDate = ReadString(value);
            else if (group == 0x0020 && element == 0x0013) dataset.InstanceNumber = ReadString(value);
            else if (group == 0x0028 && element == 0x0002) dataset.SamplesPerPixel = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x0004) dataset.PhotometricInterpretation = ReadString(value);
            else if (group == 0x0028 && element == 0x0010) dataset.Rows = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x0011) dataset.Columns = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x0100) dataset.BitsAllocated = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x0101) dataset.BitsStored = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x0103) dataset.PixelRepresentation = ReadInt(value, bigEndian);
            else if (group == 0x0028 && element == 0x1050) dataset.WindowCenter = ReadDouble(value);
            else if (group == 0x0028 && element == 0x1051) dataset.WindowWidth = ReadDouble(value);
            else if (group == 0x0028 && element == 0x1052) dataset.RescaleIntercept = ReadDouble(value) ?? 0.0;
            else if (group == 0x0028 && element == 0x1053) dataset.RescaleSlope = ReadDouble(value) ?? 1.0;
            else if (group == 0x7FE0 && element == 0x0010) dataset.PixelData = value;
        }

        private static void SkipUndefinedLength(byte[] bytes, ref int position, bool bigEndian)
        {
            while (position + 8 <= bytes.Length)
            {
                ushort group = ReadUInt16(bytes, position, bigEndian);
                ushort element = ReadUInt16(bytes, position + 2, bigEndian);
                uint length = ReadUInt32(bytes, position + 4, bigEndian);
                position += 8;
                if (group == 0xFFFE && element == 0xE0DD)
                {
                    return;
                }
                if (length == uint.MaxValue)
                {
                    SkipUndefinedLength(bytes, ref position, bigEndian);
                }
                else
                {
                    position = Math.Min(bytes.Length, position + (int)length);
                }
            }
        }

        private static ushort ReadUInt16(byte[] bytes, int offset, bool bigEndian)
        {
            return bigEndian
                ? (ushort)((bytes[offset] << 8) | bytes[offset + 1])
                : (ushort)(bytes[offset] | (bytes[offset + 1] << 8));
        }

        private static uint ReadUInt32(byte[] bytes, int offset, bool bigEndian)
        {
            return bigEndian
                ? (uint)((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
                : (uint)(bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24));
        }

        private static int ReadInt(byte[] value, bool bigEndian)
        {
            if (value.Length >= 2)
            {
                return ReadUInt16(value, 0, bigEndian);
            }
            return value.Length == 1 ? value[0] : 0;
        }

        private static string ReadString(byte[] value)
        {
            return Encoding.ASCII.GetString(value).Trim('\0', ' ');
        }

        private static double? ReadDouble(byte[] value)
        {
            string first = ReadString(value).Split('\\').FirstOrDefault();
            double parsed;
            if (double.TryParse(first, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out parsed))
            {
                return parsed;
            }
            return null;
        }

        private struct DicomElement
        {
            public DicomElement(ushort group, ushort element, string vr, uint length)
            {
                Group = group;
                Element = element;
                Vr = vr;
                Length = length;
            }

            public readonly ushort Group;
            public readonly ushort Element;
            public readonly string Vr;
            public readonly uint Length;
        }
    }

    internal static class RegistryWriter
    {
        private const string PreviewHandlersPath = @"Software\Microsoft\Windows\CurrentVersion\PreviewHandlers";
        private const string ClassesPath = @"Software\Classes";

        public static void Register(string assemblyPath)
        {
            string codeBase = new Uri(assemblyPath).AbsoluteUri;
            using (var clsid = Registry.CurrentUser.CreateSubKey(string.Format(@"{0}\CLSID\{{{1}}}", ClassesPath, ShellIds.HandlerClsid)))
            {
                clsid.SetValue("", ShellIds.HandlerName);
                clsid.SetValue("AppID", string.Format("{{{0}}}", ShellIds.HandlerClsid));
                clsid.SetValue("DisableLowILProcessIsolation", 1, RegistryValueKind.DWord);
                clsid.SetValue("DisableProcessIsolation", 0, RegistryValueKind.DWord);
                using (var inproc = clsid.CreateSubKey("InprocServer32"))
                {
                    WriteInprocValues(inproc, codeBase, true);
                    using (var version = inproc.CreateSubKey("1.0.0.0"))
                    {
                        WriteInprocValues(version, codeBase, false);
                    }
                }
            }

            using (var appId = Registry.CurrentUser.CreateSubKey(string.Format(@"{0}\AppID\{{{1}}}", ClassesPath, ShellIds.HandlerClsid)))
            {
                appId.SetValue("", ShellIds.HandlerName);
                appId.SetValue("DllSurrogate", "Prevhost.exe");
            }

            using (var previewHandlers = Registry.CurrentUser.CreateSubKey(PreviewHandlersPath))
            {
                previewHandlers.SetValue(string.Format("{{{0}}}", ShellIds.HandlerClsid), ShellIds.HandlerName);
            }

            RegisterFileClass(".dcm");
            RegisterFileClass(".dicom");
        }

        public static void Unregister()
        {
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\CLSID\{{{1}}}", ClassesPath, ShellIds.HandlerClsid), false);
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\AppID\{{{1}}}", ClassesPath, ShellIds.HandlerClsid), false);
            using (var previewHandlers = Registry.CurrentUser.OpenSubKey(PreviewHandlersPath, true))
            {
                if (previewHandlers != null)
                {
                    previewHandlers.DeleteValue(string.Format("{{{0}}}", ShellIds.HandlerClsid), false);
                }
            }
            UnregisterFileClass(".dcm");
            UnregisterFileClass(".dicom");
        }

        private static void WriteInprocValues(RegistryKey key, string codeBase, bool includeServerValues)
        {
            if (includeServerValues)
            {
                key.SetValue("", "mscoree.dll");
                key.SetValue("ThreadingModel", "Apartment");
            }
            key.SetValue("Class", "DicomVision.ShellExtension.DicomShellHandler");
            key.SetValue("Assembly", "DicomVisionShellExtension, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null");
            key.SetValue("RuntimeVersion", "v4.0.30319");
            key.SetValue("CodeBase", codeBase);
        }

        private static void RegisterFileClass(string extension)
        {
            using (var ext = Registry.CurrentUser.CreateSubKey(string.Format(@"{0}\{1}", ClassesPath, extension)))
            {
                ext.SetValue("", ShellIds.ProgId);
                using (var shellEx = ext.CreateSubKey(string.Format(@"ShellEx\{0}", ShellIds.PreviewHandlerCategory)))
                {
                    shellEx.SetValue("", string.Format("{{{0}}}", ShellIds.HandlerClsid));
                }
                using (var shellEx = ext.CreateSubKey(string.Format(@"ShellEx\{0}", ShellIds.ThumbnailProviderCategory)))
                {
                    shellEx.SetValue("", string.Format("{{{0}}}", ShellIds.HandlerClsid));
                }
            }

            using (var progId = Registry.CurrentUser.CreateSubKey(string.Format(@"{0}\{1}", ClassesPath, ShellIds.ProgId)))
            {
                progId.SetValue("", "DICOM medical image");
                progId.SetValue("FriendlyTypeName", "DICOM medical image");
                using (var shellEx = progId.CreateSubKey(string.Format(@"ShellEx\{0}", ShellIds.PreviewHandlerCategory)))
                {
                    shellEx.SetValue("", string.Format("{{{0}}}", ShellIds.HandlerClsid));
                }
                using (var shellEx = progId.CreateSubKey(string.Format(@"ShellEx\{0}", ShellIds.ThumbnailProviderCategory)))
                {
                    shellEx.SetValue("", string.Format("{{{0}}}", ShellIds.HandlerClsid));
                }
            }
        }

        private static void UnregisterFileClass(string extension)
        {
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\{1}\ShellEx\{2}", ClassesPath, extension, ShellIds.PreviewHandlerCategory), false);
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\{1}\ShellEx\{2}", ClassesPath, extension, ShellIds.ThumbnailProviderCategory), false);
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\{1}\ShellEx\{2}", ClassesPath, ShellIds.ProgId, ShellIds.PreviewHandlerCategory), false);
            Registry.CurrentUser.DeleteSubKeyTree(string.Format(@"{0}\{1}\ShellEx\{2}", ClassesPath, ShellIds.ProgId, ShellIds.ThumbnailProviderCategory), false);
        }
    }

    public static class NativeMethods
    {
        public const int S_OK = 0;
        public const int S_FALSE = 1;
        public const int E_NOTIMPL = unchecked((int)0x80004001);
        public const int E_FAIL = unchecked((int)0x80004005);
        public const int GWL_STYLE = -16;
        public const int WS_CHILD = 0x40000000;
        public const int WS_VISIBLE = 0x10000000;
        public const int WS_CLIPSIBLINGS = 0x04000000;
        public const uint SWP_NOZORDER = 0x0004;
        public const uint SWP_NOACTIVATE = 0x0010;

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct MSG
        {
            public IntPtr Hwnd;
            public uint Message;
            public IntPtr WParam;
            public IntPtr LParam;
            public uint Time;
            public POINT Point;
        }

        [DllImport("user32.dll")]
        public static extern IntPtr SetParent(IntPtr child, IntPtr newParent);

        [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
        private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

        [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
        private static extern int SetWindowLong32(IntPtr hWnd, int nIndex, int dwNewLong);

        public static IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong)
        {
            return IntPtr.Size == 8
                ? SetWindowLongPtr64(hWnd, nIndex, dwNewLong)
                : new IntPtr(SetWindowLong32(hWnd, nIndex, dwNewLong.ToInt32()));
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int x, int y, int cx, int cy, uint flags);

        [DllImport("user32.dll")]
        public static extern IntPtr GetFocus();
    }
}
